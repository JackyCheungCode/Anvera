import type { APIRoute } from "astro";

export const prerender = false;

type VehicleEnv = { WHEEL_SIZE_API_KEY?: string };
type CatalogResource = "regions" | "makes" | "models" | "years" | "generations" | "modifications";

const resources = new Set<CatalogResource>(["regions", "makes", "models", "years", "generations", "modifications"]);
const allowedParams = ["region", "make", "model", "year", "generation", "fuel", "body", "doors", "powertrain"] as const;

function json(body: unknown, status = 200, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": cache ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" : "no-store"
    }
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: VehicleEnv } }).runtime?.env;
  const apiKey = env?.WHEEL_SIZE_API_KEY;
  if (!apiKey) return json({ ok: false, error: "vehicle_fitment_not_configured" }, 503);

  const incoming = new URL(request.url);
  const resource = incoming.searchParams.get("resource") as CatalogResource | null;
  if (!resource || !resources.has(resource)) return json({ ok: false, error: "invalid_catalog_resource" }, 400);

  const params = new URLSearchParams();
  for (const key of allowedParams) {
    const value = incoming.searchParams.get(key)?.trim();
    if (value) {
      if (value.length > 120 || /[\u0000-\u001f]/.test(value)) return json({ ok: false, error: "invalid_catalog_parameter", field: key }, 422);
      params.set(key, value);
    }
  }
  if (resource === "models" && !params.has("make")) return json({ ok: false, error: "make_required" }, 422);
  if (resource === "generations" && (!params.has("make") || !params.has("model"))) return json({ ok: false, error: "make_and_model_required" }, 422);
  if (resource === "modifications" && (!params.has("make") || !params.has("model") || (!params.has("generation") && !params.has("year")))) {
    return json({ ok: false, error: "vehicle_selection_incomplete" }, 422);
  }

  params.set("user_key", apiKey);
  const url = `https://api.wheel-size.com/v2/${resource}/?${params.toString()}`;
  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    const text = await upstream.text();
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = { error: "invalid_upstream_response" }; }
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : upstream.status === 404 ? 404 : upstream.status >= 500 ? 502 : 400;
      return json({ ok: false, error: "wheel_size_request_failed", upstreamStatus: upstream.status, details: payload }, status);
    }
    return json(payload, 200, true);
  } catch {
    return json({ ok: false, error: "wheel_size_unreachable" }, 502);
  }
};
