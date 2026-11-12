type BusinessEnv = {
  DB: D1Database;
  ANVERA_BUSINESS_API_ENABLED?: string;
  TURNSTILE_SECRET_KEY?: string;
};

type RequestContext = { request: Request; locals: unknown };

export type PublicResult = { status: number; body: Record<string, unknown> };

const MAX_BODY_BYTES = 12 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) : "";
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

async function verifyTurnstile(token: string, secret: string, remoteIp: string | null): Promise<boolean> {
  if (!token || !secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; hostname?: string };
    return result.success === true;
  } catch {
    return false;
  }
}

export async function acceptPublicSubmission(ctx: RequestContext, required: string[]): Promise<
  { ok: true; env: BusinessEnv; data: Record<string, unknown> } |
  { ok: false; response: Response }
> {
  const { request } = ctx;
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (!origin || origin !== url.origin) {
    return { ok: false, response: json({ ok: false, error: "origin_not_allowed" }, 403) };
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { ok: false, response: json({ ok: false, error: "json_required" }, 415) };
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return { ok: false, response: json({ ok: false, error: "payload_too_large" }, 413) };

  let data: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return { ok: false, response: json({ ok: false, error: "payload_too_large" }, 413) };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("invalid");
    data = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, response: json({ ok: false, error: "invalid_json" }, 400) };
  }

  if (clean(data.website, 300)) {
    return { ok: false, response: json({ ok: true, referenceCode: null }, 202) };
  }
  for (const field of required) {
    if (!clean(data[field], 500)) return { ok: false, response: json({ ok: false, error: "required_fields_missing", field }, 422) };
  }
  const email = clean(data.email, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { ok: false, response: json({ ok: false, error: "invalid_email" }, 422) };

  const locals = ctx.locals as { runtime?: { env?: BusinessEnv } };
  const env = locals.runtime?.env;
  if (!env?.DB || env.ANVERA_BUSINESS_API_ENABLED !== "true") {
    return { ok: false, response: json({ ok: false, error: "submission_temporarily_unavailable" }, 503) };
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    return { ok: false, response: json({ ok: false, error: "verification_not_configured" }, 503) };
  }
  const token = clean(data.turnstileToken, 2048);
  const verified = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP"));
  if (!verified) return { ok: false, response: json({ ok: false, error: "verification_failed" }, 403) };
  return { ok: true, env, data: { ...data, email } };
}

export function publicJson(body: Record<string, unknown>, status: number): Response {
  return json(body, status);
}

export function referenceCode(prefix: string): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}
