import type { APIRoute } from "astro";

export const prerender = false;

type VehicleEnv = { WHEEL_SIZE_API_KEY?: string; PUBLIC_INTAKE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> } };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

const fields = ["make", "model", "year", "generation", "modification", "region"] as const;

export const POST: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  if (request.headers.get("Origin") !== url.origin) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "unsupported_content_type" }, 415);
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 8192) return json({ ok: false, error: "payload_too_large" }, 413);

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8192) return json({ ok: false, error: "payload_too_large" }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("invalid");
    input = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_request_body" }, 400);
  }

  const params = new URLSearchParams();
  for (const field of fields) {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = String(raw).trim();
    if (!value || value.length > 120 || /[\u0000-\u001f]/.test(value)) {
      return json({ ok: false, error: "invalid_vehicle_parameter", field }, 422);
    }
    params.set(field, value);
  }
  if (!params.has("make") || !params.has("model")) return json({ ok: false, error: "make_and_model_required" }, 422);
  if (!params.has("year") && !params.has("generation") && !params.has("modification")) {
    return json({ ok: false, error: "year_generation_or_modification_required" }, 422);
  }
  if (params.has("year")) {
    const year = Number(params.get("year"));
    if (!Number.isInteger(year) || year < 1886 || year > new Date().getUTCFullYear() + 2) {
      return json({ ok: false, error: "invalid_vehicle_year" }, 422);
    }
  }

  const env = (locals as { runtime?: { env?: VehicleEnv } }).runtime?.env;
  const apiKey = env?.WHEEL_SIZE_API_KEY;
  if (!apiKey) return json({ ok: false, error: "vehicle_fitment_not_configured" }, 503);
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (!clientIp || !env?.PUBLIC_INTAKE_LIMITER) return json({ ok: false, error: "rate_limiting_not_configured" }, 503);
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientIp));
    const clientKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const decision = await env.PUBLIC_INTAKE_LIMITER.limit({ key: "wheel-fitment:" + clientKey });
    if (!decision.success) return json({ ok: false, error: "rate_limit_exceeded" }, 429);
  } catch { return json({ ok: false, error: "rate_limiting_unavailable" }, 503); }
  params.set("user_key", apiKey);

  try {
    const upstream = await fetch(`https://api.wheel-size.com/v2/search/by_model/?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000)
    });
    const text = await upstream.text();
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = { error: "invalid_upstream_response" }; }
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : upstream.status === 404 ? 404 : upstream.status >= 500 ? 502 : 400;
      return json({ ok: false, error: "wheel_size_request_failed", upstreamStatus: upstream.status, details: payload }, status);
    }
    return json({ ok: true, result: payload });
  } catch {
    return json({ ok: false, error: "wheel_size_unreachable" }, 502);
  }
};
