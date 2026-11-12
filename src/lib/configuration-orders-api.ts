export type ConfigurationOrderEnv = {
  DB?: D1Database;
  ANVERA_CONFIGURATION_API_ENABLED?: string;
  TURNSTILE_SECRET_KEY?: string;
  PUBLIC_INTAKE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_JSON_BYTES = 48 * 1024;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) : "";
}

function referenceCode(): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return "ANV-" + date + "-" + suffix;
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

async function rateLimit(env: ConfigurationOrderEnv, request: Request, keySuffix: string): Promise<boolean> {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || !env.PUBLIC_INTAKE_LIMITER) return false;
  const ipHash = await sha256(ip);
  const decision = await env.PUBLIC_INTAKE_LIMITER.limit({ key: "configuration-orders:" + keySuffix + ":" + ipHash });
  return decision.success;
}

async function verifyTurnstile(token: string, secret: string, ip: string | null, hostname: string): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; hostname?: string };
    return result.success === true && result.hostname?.toLowerCase() === hostname.toLowerCase();
  } catch {
    return false;
  }
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return null;
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_JSON_BYTES) return null;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) return null;
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function findOwnedOrder(env: ConfigurationOrderEnv, reference: string, request: Request): Promise<{ id: string; status: string } | null> {
  const token = clean(request.headers.get("Authorization")?.replace(/^Bearer\s+/i, ""), 128);
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = await sha256(token);
  return await env.DB!.prepare("SELECT id, status FROM anvera_configuration_orders WHERE reference_code = ? AND access_token_hash = ?")
    .bind(reference, tokenHash).first<{ id: string; status: string }>();
}

export async function handleConfigurationOrdersRequest(request: Request, env: ConfigurationOrderEnv): Promise<Response> {
  const url = new URL(request.url);
  if (request.headers.get("Origin") !== url.origin) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (!env?.DB || env.ANVERA_CONFIGURATION_API_ENABLED !== "true") return json({ ok: false, error: "configuration_service_unavailable" }, 503);
  const body = await parseBody(request);
  if (!body) return json({ ok: false, error: "invalid_request_body" }, 400);

  const action = clean(body.action, 16);
  if (clean(body.website, 200)) return json({ ok: true }, 202);

  if (action === "create") {
    if (!await rateLimit(env, request, "draft")) return json({ ok: false, error: "rate_limit_or_identity_unavailable" }, 429);
    const id = crypto.randomUUID();
    const code = referenceCode();
    const token = newToken();
    const tokenHash = await sha256(token);
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO anvera_configuration_orders (id, reference_code, status, configuration_json, access_token_hash) VALUES (?, ?, 'draft', '{}', ?)")
          .bind(id, code, tokenHash),
        env.DB.prepare("INSERT INTO anvera_configuration_order_events (id, order_id, event_type, event_json) VALUES (?, ?, 'created', '{}')")
          .bind(crypto.randomUUID(), id)
      ]);
      return json({ ok: true, referenceCode: code, accessToken: token }, 201);
    } catch {
      return json({ ok: false, error: "draft_creation_failed" }, 500);
    }
  }

  if (action !== "save" && action !== "submit") return json({ ok: false, error: "invalid_action" }, 422);
  const reference = clean(body.referenceCode, 40);
  if (!/^ANV-\d{6}-[A-F0-9]{6}$/.test(reference)) return json({ ok: false, error: "invalid_reference" }, 422);
  const owned = await findOwnedOrder(env, reference, request);
  if (!owned) return json({ ok: false, error: "order_not_found" }, 404);
  if (owned.status !== "draft") return json({ ok: false, error: "order_already_submitted" }, 409);
  const config = body.configuration;
  if (typeof config !== "object" || config === null || Array.isArray(config)) return json({ ok: false, error: "configuration_required" }, 422);
  const configJson = JSON.stringify(config);
  if (new TextEncoder().encode(configJson).byteLength > MAX_JSON_BYTES - 1024) return json({ ok: false, error: "configuration_too_large" }, 413);

  if (action === "save") {
    if (!await rateLimit(env, request, "save")) return json({ ok: false, error: "rate_limit_or_identity_unavailable" }, 429);
    try {
      await env.DB.batch([
        env.DB.prepare("UPDATE anvera_configuration_orders SET configuration_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'")
          .bind(configJson, owned.id),
        env.DB.prepare("INSERT INTO anvera_configuration_order_events (id, order_id, event_type, event_json) VALUES (?, ?, 'draft_saved', ?)")
          .bind(crypto.randomUUID(), owned.id, JSON.stringify({ step: clean((config as Record<string, unknown>).step, 16) }))
      ]);
      return json({ ok: true, referenceCode: reference, status: "draft" });
    } catch {
      return json({ ok: false, error: "draft_save_failed" }, 500);
    }
  }

  const customerName = clean(body.customerName, 160);
  const email = clean(body.email, 254).toLowerCase();
  const turnstileToken = clean(body.turnstileToken, 2048);
  if (!customerName || !EMAIL.test(email)) return json({ ok: false, error: "contact_details_required" }, 422);
  if (!env.TURNSTILE_SECRET_KEY) return json({ ok: false, error: "verification_not_configured" }, 503);
  if (!await rateLimit(env, request, "submit")) return json({ ok: false, error: "rate_limit_or_identity_unavailable" }, 429);
  const emailHash = await sha256(email);
  const emailDecision = await env.PUBLIC_INTAKE_LIMITER!.limit({ key: "configuration-orders:email:" + emailHash });
  if (!emailDecision.success) return json({ ok: false, error: "email_rate_limit_exceeded" }, 429);
  const verified = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP"), url.hostname);
  if (!verified) return json({ ok: false, error: "verification_failed" }, 403);

  const configRecord = config as Record<string, any>;
  const vehicle = configRecord.vehicle ?? {};
  const product = configRecord.product ?? {};
  const delivery = configRecord.delivery ?? {};
  const specPath = clean(configRecord.specPath, 16);
  if (!["oem", "upgrade", "custom"].includes(specPath)) return json({ ok: false, error: "invalid_specification_path" }, 422);
  const yearText = clean(vehicle.year, 4);
  const year = yearText ? Number(yearText) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1886 || year > new Date().getUTCFullYear() + 2)) return json({ ok: false, error: "invalid_vehicle_year" }, 422);
  const status = specPath === "custom" ? "custom_review" : "submitted";
  try {
    await env.DB.batch([
      env.DB.prepare(`UPDATE anvera_configuration_orders SET status = ?, customer_name = ?, email = ?, phone = ?, country = ?,
        vehicle_make = ?, vehicle_model = ?, vehicle_year = ?, selected_model = ?, specification_path = ?,
        delivery_term = ?, shipping_method = ?, configuration_json = ?, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'draft'`)
        .bind(
          status, customerName, email, clean(body.phone, 60) || null,
          clean(delivery.country, 100) || null, clean(vehicle.make, 100) || null,
          clean(vehicle.model, 120) || null, year, clean(product.title, 160) || null,
          specPath, clean(delivery.term, 12) || null, clean(delivery.method, 12) || null,
          configJson, owned.id
        ),
      env.DB.prepare("INSERT INTO anvera_configuration_order_events (id, order_id, event_type, event_json) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), owned.id, specPath === "custom" ? "custom_review_requested" : "submitted", JSON.stringify({ customerName, email }))
    ]);
    return json({ ok: true, referenceCode: reference, status, responseSla: specPath === "custom" ? "1 business day" : null });
  } catch {
    return json({ ok: false, error: "submission_failed" }, 500);
  }
}

export async function handleConfigurationOrderGetRequest(request: Request, env: ConfigurationOrderEnv, reference: string): Promise<Response> {
  if (!env?.DB || env.ANVERA_CONFIGURATION_API_ENABLED !== "true") return json({ ok: false, error: "configuration_service_unavailable" }, 503);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ ok: false, error: "access_denied" }, 401);
  const tokenHash = await sha256(token);
  const order = await env.DB.prepare("SELECT reference_code, status, configuration_json, created_at, updated_at, submitted_at FROM anvera_configuration_orders WHERE reference_code = ? AND access_token_hash = ?")
    .bind(reference, tokenHash).first<{ reference_code: string; status: string; configuration_json: string; created_at: string; updated_at: string; submitted_at: string | null }>();
  if (!order) return json({ ok: false, error: "order_not_found" }, 404);
  let configuration: unknown = {};
  try { configuration = JSON.parse(order.configuration_json); } catch {}
  const events = await env.DB.prepare("SELECT event_type, event_json, created_at FROM anvera_configuration_order_events WHERE order_id = (SELECT id FROM anvera_configuration_orders WHERE reference_code = ?) ORDER BY created_at ASC LIMIT 100")
    .bind(reference).all();
  return json({ ok: true, order: { referenceCode: order.reference_code, status: order.status, configuration, createdAt: order.created_at, updatedAt: order.updated_at, submittedAt: order.submitted_at, events: events.results } });
}
