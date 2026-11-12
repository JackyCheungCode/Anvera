import type { APIRoute } from "astro";

export const prerender = false;

type Env = {
  DB?: D1Database;
  ANVERA_CONFIGURATION_API_ENABLED?: string;
  PUBLIC_INTAKE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
};
type RuntimeLocals = { runtime?: { env?: Env } };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" }
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

export const GET: APIRoute = async ({ request, params, locals }) => {
  const env = (locals as RuntimeLocals).runtime?.env;
  if (!env?.DB || env.ANVERA_CONFIGURATION_API_ENABLED !== "true") return json({ ok: false, error: "configuration_service_unavailable" }, 503);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ ok: false, error: "access_denied" }, 401);
  const reference = String(params.reference || "");
  const tokenHash = await sha256(token);
  const order = await env.DB.prepare("SELECT reference_code, status, configuration_json, created_at, updated_at, submitted_at FROM anvera_configuration_orders WHERE reference_code = ? AND access_token_hash = ?")
    .bind(reference, tokenHash).first<{ reference_code: string; status: string; configuration_json: string; created_at: string; updated_at: string; submitted_at: string | null }>();
  if (!order) return json({ ok: false, error: "order_not_found" }, 404);
  let configuration: unknown = {};
  try { configuration = JSON.parse(order.configuration_json); } catch {}
  const events = await env.DB.prepare("SELECT event_type, event_json, created_at FROM anvera_configuration_order_events WHERE order_id = (SELECT id FROM anvera_configuration_orders WHERE reference_code = ?) ORDER BY created_at ASC LIMIT 100")
    .bind(reference).all();
  return json({ ok: true, order: { referenceCode: order.reference_code, status: order.status, configuration, createdAt: order.created_at, updatedAt: order.updated_at, submittedAt: order.submitted_at, events: events.results } });
};
