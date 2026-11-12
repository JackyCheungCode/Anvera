import { definePlugin } from "emdash";

type AdminContext = {
  request: Request;
  input?: unknown;
  user?: { id: string; role: number };
  users?: { get(id: string): Promise<{ id: string; role: number } | null> };
};

type InquiryRow = {
  id: string;
  reference_code: string;
  status: string;
  customer_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  selected_model: string | null;
  construction_type: string | null;
  quantity: string | null;
  created_at: string;
  updated_at: string;
};

type ApplicationRow = {
  id: string;
  reference_code: string;
  status: string;
  legal_company_name: string;
  trading_name: string | null;
  business_type: string;
  country: string;
  city: string | null;
  contact_name: string;
  contact_role: string | null;
  email: string;
  phone: string | null;
  years_in_business: number | null;
  represented_brands: string | null;
  notes: string | null;
  created_at: string;
};

type DealerRow = {
  id: string;
  emdash_user_id: string;
  application_id: string;
  legal_company_name: string;
  country: string;
  status: string;
  activated_at: string;
  updated_at: string;
};

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const INQUIRY_TRANSITIONS: Record<string, readonly string[]> = {
  new: ["in_review", "spam", "closed"],
  in_review: ["quoted", "closed", "spam"],
  quoted: ["won", "closed"],
  won: ["closed"],
  closed: [],
  spam: []
};
const APPLICATION_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["reviewing", "withdrawn"],
  reviewing: ["approved", "rejected", "withdrawn"],
  approved: [],
  rejected: [],
  withdrawn: []
};

function pageParams(url: URL) {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));
  const requestedLimit = Math.floor(Number(url.searchParams.get("limit")) || PAGE_SIZE_DEFAULT);
  const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, requestedLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function normalizedSearch(url: URL) {
  return (url.searchParams.get("q") ?? "").trim().slice(0, 120);
}

function listFilter(url: URL, allowedStatuses: readonly string[]) {
  const status = url.searchParams.get("status") ?? "";
  return allowedStatuses.includes(status) ? status : "";
}

function inputRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function inputString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function getAdminDatabase(ctx: AdminContext) {
  if (ctx.user?.role !== 50) {
    return { error: { available: false, reason: "forbidden" } as const };
  }

  const { env } = await import("cloudflare:workers");
  if (env.ANVERA_BUSINESS_API_ENABLED !== "true") {
    return { error: { available: false, reason: "migration_pending" } as const };
  }

  const media = (env as typeof env & {
    MEDIA?: { get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null> };
  }).MEDIA;
  return { db: env.DB, media };
}

async function listInquiries(ctx: AdminContext) {
  if (ctx.request.method !== "GET") return { available: false, reason: "method_not_allowed" };
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;

  const url = new URL(ctx.request.url);
  const { page, limit, offset } = pageParams(url);
  const q = normalizedSearch(url);
  const status = listFilter(url, ["new", "in_review", "quoted", "won", "closed", "spam"]);
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  if (status) {
    clauses.push("status = ?");
    values.push(status);
  }
  if (q) {
    clauses.push("(instr(lower(reference_code), lower(?)) > 0 OR instr(lower(customer_name), lower(?)) > 0 OR instr(lower(email), lower(?)) > 0 OR instr(lower(vehicle_make || ' ' || vehicle_model), lower(?)) > 0)");
    values.push(q, q, q, q);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const [rows, count] = await Promise.all([
    access.db.prepare(`SELECT id, reference_code, status, customer_name, email, phone, country, vehicle_make, vehicle_model, vehicle_year, selected_model, construction_type, quantity, created_at, updated_at FROM anvera_inquiries${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, limit, offset).all<InquiryRow>(),
    access.db.prepare(`SELECT COUNT(*) AS total FROM anvera_inquiries${where}`)
      .bind(...values).first<{ total: number }>()
  ]);
  return { available: true, items: rows.results, page, limit, total: count?.total ?? 0 };
}

async function inquiryDetail(ctx: AdminContext) {
  if (ctx.request.method !== "GET") return { available: false, reason: "method_not_allowed" };
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;

  const url = new URL(ctx.request.url);
  const id = (url.searchParams.get("id") ?? "").trim().slice(0, 128);
  if (!id) return { available: true, found: false, reason: "missing_id" };

  const inquiry = await access.db.prepare("SELECT * FROM anvera_inquiries WHERE id = ? LIMIT 1")
    .bind(id).first<InquiryRow & Record<string, unknown>>();
  if (!inquiry) return { available: true, found: false, reason: "not_found" };

  const [events, attachments] = await Promise.all([
    access.db.prepare("SELECT id, event_type, actor_user_id, previous_value, new_value, note, created_at FROM anvera_inquiry_events WHERE inquiry_id = ? ORDER BY created_at ASC")
      .bind(id).all(),
    access.db.prepare("SELECT id, original_filename, content_type, byte_size, uploaded_at FROM anvera_inquiry_attachments WHERE inquiry_id = ? ORDER BY uploaded_at ASC")
      .bind(id).all()
  ]);
  return { available: true, found: true, inquiry, events: events.results, attachments: attachments.results };
}

async function downloadInquiryAttachment(ctx: AdminContext) {
  if (ctx.request.method !== "GET") return { available: false, reason: "method_not_allowed" };
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;

  const url = new URL(ctx.request.url);
  const attachmentId = (url.searchParams.get("id") ?? "").trim().slice(0, 128);
  if (!attachmentId) return { available: true, found: false, reason: "missing_id" };

  const attachment = await access.db.prepare(
    "SELECT id, r2_object_key, original_filename, content_type, byte_size FROM anvera_inquiry_attachments WHERE id = ? LIMIT 1"
  ).bind(attachmentId).first<{
    id: string; r2_object_key: string; original_filename: string; content_type: string; byte_size: number;
  }>();
  if (!attachment) return { available: true, found: false, reason: "not_found" };

  const object = await access.media?.get(attachment.r2_object_key);
  if (!object) return { available: true, found: false, reason: "object_not_found" };
  const bytes = new Uint8Array(await object.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return {
    available: true,
    found: true,
    filename: attachment.original_filename,
    contentType: attachment.content_type,
    byteSize: attachment.byte_size,
    base64: btoa(binary)
  };
}

async function listDealerApplications(ctx: AdminContext) {
  if (ctx.request.method !== "GET") return { available: false, reason: "method_not_allowed" };
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;

  const url = new URL(ctx.request.url);
  const { page, limit, offset } = pageParams(url);
  const q = normalizedSearch(url);
  const status = listFilter(url, ["pending", "reviewing", "approved", "rejected", "withdrawn"]);
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  if (status) {
    clauses.push("status = ?");
    values.push(status);
  }
  if (q) {
    clauses.push("(instr(lower(reference_code), lower(?)) > 0 OR instr(lower(legal_company_name), lower(?)) > 0 OR instr(lower(contact_name), lower(?)) > 0 OR instr(lower(email), lower(?)) > 0 OR instr(lower(country), lower(?)) > 0)");
    values.push(q, q, q, q, q);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const [rows, count] = await Promise.all([
    access.db.prepare(`SELECT id, reference_code, status, legal_company_name, trading_name, business_type, country, city, years_in_business, represented_brands, contact_name, contact_role, email, phone, notes, created_at FROM anvera_dealer_applications${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, limit, offset).all<ApplicationRow>(),
    access.db.prepare(`SELECT COUNT(*) AS total FROM anvera_dealer_applications${where}`)
      .bind(...values).first<{ total: number }>()
  ]);
  return { available: true, items: rows.results, page, limit, total: count?.total ?? 0 };
}

async function listDealers(ctx: AdminContext) {
  if (ctx.request.method !== "GET") return { available: false, reason: "method_not_allowed" };
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;

  const url = new URL(ctx.request.url);
  const { page, limit, offset } = pageParams(url);
  const q = normalizedSearch(url);
  const status = listFilter(url, ["active", "suspended", "closed"]);
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  if (status) {
    clauses.push("status = ?");
    values.push(status);
  }
  if (q) {
    clauses.push("(instr(lower(legal_company_name), lower(?)) > 0 OR instr(lower(country), lower(?)) > 0 OR instr(lower(emdash_user_id), lower(?)) > 0)");
    values.push(q, q, q);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const [rows, count] = await Promise.all([
    access.db.prepare(`SELECT id, emdash_user_id, application_id, legal_company_name, country, status, activated_at, updated_at FROM anvera_dealers${where} ORDER BY activated_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, limit, offset).all<DealerRow>(),
    access.db.prepare(`SELECT COUNT(*) AS total FROM anvera_dealers${where}`)
      .bind(...values).first<{ total: number }>()
  ]);
  return { available: true, items: rows.results, page, limit, total: count?.total ?? 0 };
}

async function updateInquiry(ctx: AdminContext) {
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const id = inputString(body?.id, 128);
  const nextStatus = inputString(body?.status, 24);
  if (!id || !Object.hasOwn(INQUIRY_TRANSITIONS, nextStatus)) {
    return { updated: false, reason: "invalid_input" };
  }
  const current = await access.db.prepare("SELECT status FROM anvera_inquiries WHERE id = ? LIMIT 1")
    .bind(id).first<{ status: string }>();
  if (!current) return { updated: false, reason: "not_found" };
  if (!INQUIRY_TRANSITIONS[current.status]?.includes(nextStatus)) {
    return { updated: false, reason: "invalid_transition", currentStatus: current.status };
  }

  const eventId = crypto.randomUUID();
  const batch = await access.db.batch([
    access.db.prepare("UPDATE anvera_inquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?")
      .bind(nextStatus, id, current.status),
    access.db.prepare("INSERT INTO anvera_inquiry_events (id, inquiry_id, event_type, actor_user_id, previous_value, new_value) SELECT ?, ?, 'status_changed', ?, ?, ? WHERE changes() > 0")
      .bind(eventId, id, ctx.user!.id, current.status, nextStatus)
  ]);
  return { updated: (batch[0]?.meta?.changes ?? 0) > 0 };
}

async function addInquiryNote(ctx: AdminContext) {
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const id = inputString(body?.id, 128);
  const note = inputString(body?.note, 4000);
  if (!id || !note) return { added: false, reason: "invalid_input" };

  const result = await access.db.prepare("INSERT INTO anvera_inquiry_events (id, inquiry_id, event_type, actor_user_id, note) SELECT ?, ?, 'note_added', ?, ? WHERE EXISTS (SELECT 1 FROM anvera_inquiries WHERE id = ?)")
    .bind(crypto.randomUUID(), id, ctx.user!.id, note, id).run();
  return { added: (result.meta?.changes ?? 0) > 0 };
}

async function reviewDealerApplication(ctx: AdminContext) {
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const id = inputString(body?.id, 128);
  const nextStatus = inputString(body?.status, 24);
  const note = inputString(body?.note, 4000);
  if (!id || !Object.values(APPLICATION_TRANSITIONS).some((statuses) => statuses.includes(nextStatus))) {
    return { reviewed: false, reason: "invalid_input" };
  }
  const current = await access.db.prepare("SELECT status FROM anvera_dealer_applications WHERE id = ? LIMIT 1")
    .bind(id).first<{ status: string }>();
  if (!current) return { reviewed: false, reason: "not_found" };
  if (!APPLICATION_TRANSITIONS[current.status]?.includes(nextStatus)) {
    return { reviewed: false, reason: "invalid_transition", currentStatus: current.status };
  }

  const batch = await access.db.batch([
    access.db.prepare("UPDATE anvera_dealer_applications SET status = ?, reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, decision_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?")
      .bind(nextStatus, ctx.user!.id, note || null, id, current.status),
    access.db.prepare("INSERT INTO anvera_dealer_application_events (id, application_id, event_type, actor_user_id, previous_value, new_value, note) SELECT ?, ?, 'status_changed', ?, ?, ?, ? WHERE changes() > 0")
      .bind(crypto.randomUUID(), id, ctx.user!.id, current.status, nextStatus, note || null)
  ]);
  return { reviewed: (batch[0]?.meta?.changes ?? 0) > 0 };
}

async function activateDealer(ctx: AdminContext) {
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const applicationId = inputString(body?.applicationId, 128);
  const userId = inputString(body?.userId, 128);
  if (!applicationId || !userId) return { activated: false, reason: "invalid_input" };

  const user = await ctx.users?.get(userId);
  if (!user) return { activated: false, reason: "emdash_user_not_found" };
  if (user.role !== 10) return { activated: false, reason: "identity_must_be_subscriber" };

  const dealerId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  try {
    const batch = await access.db.batch([
      access.db.prepare("INSERT INTO anvera_dealers (id, emdash_user_id, application_id, legal_company_name, country, status, activated_by_user_id, activated_at, updated_at) SELECT ?, ?, id, legal_company_name, country, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM anvera_dealer_applications WHERE id = ? AND status = 'approved' AND NOT EXISTS (SELECT 1 FROM anvera_dealers WHERE application_id = ? OR emdash_user_id = ?)")
        .bind(dealerId, userId, ctx.user!.id, applicationId, applicationId, userId),
      access.db.prepare("INSERT INTO anvera_dealer_events (id, dealer_id, event_type, actor_user_id) SELECT ?, ?, 'activated', ? WHERE changes() > 0")
        .bind(eventId, dealerId, ctx.user!.id)
    ]);
    return { activated: (batch[0]?.meta?.changes ?? 0) > 0, reason: (batch[0]?.meta?.changes ?? 0) > 0 ? undefined : "application_not_approved_or_identity_already_linked" };
  } catch {
    return { activated: false, reason: "database_conflict" };
  }
}

async function suspendDealer(ctx: AdminContext) {
  const access = await getAdminDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const id = inputString(body?.id, 128);
  const note = inputString(body?.note, 1000);
  if (!id) return { suspended: false, reason: "invalid_input" };

  const batch = await access.db.batch([
    access.db.prepare("UPDATE anvera_dealers SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'")
      .bind(id),
    access.db.prepare("INSERT INTO anvera_dealer_events (id, dealer_id, event_type, actor_user_id, note) SELECT ?, ?, 'suspended', ?, ? WHERE changes() > 0")
      .bind(crypto.randomUUID(), id, ctx.user!.id, note || null)
  ]);
  return { suspended: (batch[0]?.meta?.changes ?? 0) > 0 };
}


type ProductSetupRow = {
  id: string;
  status: string;
  revision: number;
  document_json: string;
  step_state_json: string;
  updated_at: string;
};

async function getProductSetupDatabase(ctx: AdminContext) {
  if (ctx.user?.role !== 50) return { error: { available: false, reason: "forbidden" } as const };
  const { env } = await import("cloudflare:workers");
  if (env.ANVERA_PRODUCT_INTELLIGENCE_ENABLED !== "true") {
    return { error: { available: false, reason: "migration_pending" } as const };
  }
  return { db: env.DB };
}

function setupDocumentIsSubmittable(document: Record<string, unknown>) {
  const factory = inputRecord(document.factory) ?? {};
  const material = inputRecord(document.material) ?? {};
  const construction = inputRecord(document.construction) ?? {};
  const specification = inputRecord(document.specification) ?? {};
  const products = Array.isArray(document.products) ? document.products.map(inputRecord).filter(Boolean) : [];
  const required = [
    factory.factoryName, factory.factoryCode, factory.country,
    material.materialGrade, material.forgingMethod,
    construction.constructionTypes,
    specification.diameterRange, specification.widthRange, specification.boltPatterns
  ];
  const validProducts = products.length > 0 && products.every((product) =>
    Boolean(inputString(product?.productCode, 80)) &&
    Boolean(inputString(product?.productName, 120)) &&
    Boolean(inputString(product?.construction, 40))
  );
  return required.every((value) => typeof value === "string" && value.trim().length > 0) && validProducts;
}

async function loadProductSetup(ctx: AdminContext) {
  if (ctx.request.method !== "GET") return { available: false, reason: "method_not_allowed" };
  const access = await getProductSetupDatabase(ctx);
  if ("error" in access) return access.error;
  const session = await access.db.prepare(
    "SELECT id, status, revision, document_json, step_state_json, updated_at FROM anvera_product_setup_sessions WHERE setup_key = 'global' LIMIT 1"
  ).first<ProductSetupRow>();
  if (!session) {
    return { available: true, session: null, document: {}, stepState: {}, events: [], versions: [] };
  }
  const [events, versions] = await Promise.all([
    access.db.prepare("SELECT id, event_type, revision, summary, created_at FROM anvera_product_setup_events WHERE session_id = ? ORDER BY created_at DESC LIMIT 20")
      .bind(session.id).all(),
    access.db.prepare("SELECT id, revision, version_type, note, created_at FROM anvera_product_setup_versions WHERE session_id = ? ORDER BY revision DESC LIMIT 20")
      .bind(session.id).all()
  ]);
  let document: Record<string, unknown> = {};
  let stepState: Record<string, unknown> = {};
  try { document = JSON.parse(session.document_json) as Record<string, unknown>; } catch { document = {}; }
  try { stepState = JSON.parse(session.step_state_json) as Record<string, unknown>; } catch { stepState = {}; }
  return {
    available: true,
    session: { id: session.id, status: session.status, revision: session.revision, updated_at: session.updated_at },
    document, stepState, events: events.results, versions: versions.results
  };
}

async function saveProductSetup(ctx: AdminContext) {
  if (ctx.request.method !== "POST") return { saved: false, reason: "method_not_allowed" };
  const access = await getProductSetupDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const document = inputRecord(body?.document);
  const stepState = inputRecord(body?.stepState) ?? {};
  const sessionId = inputString(body?.sessionId, 128);
  const action = inputString(body?.action, 16) || "draft";
  const revision = Math.max(0, Math.floor(Number(body?.revision) || 0));
  if (!document || !["draft", "submit"].includes(action)) return { saved: false, reason: "invalid_input" };

  const documentJson = JSON.stringify(document);
  const stepStateJson = JSON.stringify(stepState);
  if (new TextEncoder().encode(documentJson).byteLength > 64 * 1024 || new TextEncoder().encode(stepStateJson).byteLength > 8 * 1024) {
    return { saved: false, reason: "payload_too_large" };
  }
  if (action === "submit" && !setupDocumentIsSubmittable(document)) {
    return { saved: false, reason: "validation_failed" };
  }

  const existing = await access.db.prepare(
    "SELECT id, status, revision FROM anvera_product_setup_sessions WHERE setup_key = 'global' LIMIT 1"
  ).first<{ id: string; status: string; revision: number }>();
  const nowRevision = existing?.revision ?? 0;
  if ((existing?.id ?? "") !== sessionId || nowRevision !== revision) {
    if (existing || sessionId) return { saved: false, reason: "revision_conflict", revision: nowRevision };
  }
  if (existing && !["draft", "rejected"].includes(existing.status)) {
    return { saved: false, reason: "setup_locked", status: existing.status };
  }

  const nextRevision = nowRevision + 1;
  const eventId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const actorId = ctx.user!.id;
  const nextStatus = action === "submit" ? "in_review" : "draft";

  if (!existing) {
    const id = crypto.randomUUID();
    const statements = [
      access.db.prepare("INSERT INTO anvera_product_setup_sessions (id, setup_key, status, revision, document_json, step_state_json, created_by_user_id, updated_by_user_id, submitted_at) VALUES (?, 'global', ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'submit' THEN CURRENT_TIMESTAMP ELSE NULL END)")
        .bind(id, nextStatus, nextRevision, documentJson, stepStateJson, actorId, actorId, action),
      access.db.prepare("INSERT INTO anvera_product_setup_events (id, session_id, event_type, actor_user_id, revision, summary) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(eventId, id, action === "submit" ? "submitted" : "created", actorId, nextRevision, action === "submit" ? "Global setup submitted for review" : "Initial global setup draft created")
    ];
    if (action === "submit") {
      statements.push(access.db.prepare("INSERT INTO anvera_product_setup_versions (id, session_id, revision, version_type, document_json, step_state_json, actor_user_id, note) VALUES (?, ?, ?, 'submitted', ?, ?, ?, ?)")
        .bind(versionId, id, nextRevision, documentJson, stepStateJson, actorId, "Initial submission"));
    }
    await access.db.batch(statements);
    return { saved: true, sessionId: id, revision: nextRevision, status: nextStatus };
  }

  const statements = [
    access.db.prepare("UPDATE anvera_product_setup_sessions SET status = ?, revision = ?, document_json = ?, step_state_json = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP, submitted_at = CASE WHEN ? = 'submit' THEN CURRENT_TIMESTAMP ELSE submitted_at END WHERE id = ? AND revision = ? AND status IN ('draft', 'rejected')")
      .bind(nextStatus, nextRevision, documentJson, stepStateJson, actorId, action, existing.id, revision),
    access.db.prepare("INSERT INTO anvera_product_setup_events (id, session_id, event_type, actor_user_id, revision, summary) SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0")
      .bind(eventId, existing.id, action === "submit" ? "submitted" : "draft_saved", actorId, nextRevision, action === "submit" ? "Global setup submitted for review" : "Global setup draft saved")
  ];
  if (action === "submit") {
    statements.push(access.db.prepare("INSERT INTO anvera_product_setup_versions (id, session_id, revision, version_type, document_json, step_state_json, actor_user_id, note) SELECT ?, ?, ?, 'submitted', ?, ?, ?, 'Submitted for internal review' WHERE EXISTS (SELECT 1 FROM anvera_product_setup_sessions WHERE id = ? AND revision = ?)")
      .bind(versionId, existing.id, nextRevision, documentJson, stepStateJson, actorId, existing.id, nextRevision));
  }
  const result = await access.db.batch(statements);
  if ((result[0]?.meta?.changes ?? 0) === 0) return { saved: false, reason: "revision_conflict", revision: nowRevision };
  return { saved: true, sessionId: existing.id, revision: nextRevision, status: nextStatus };
}

const jsonPost: { methods: ("GET" | "POST" | "HEAD" | "PUT" | "PATCH" | "DELETE")[]; request: { body: "json"; maxBytes: number } } = { methods: ["POST"], request: { body: "json", maxBytes: 16 * 1024 } };

export function createPlugin() {
  return definePlugin({
    id: "anvera-business",
    displayName: "ANVERA Business",
    description: "Business operations workspace for inquiries and dealer accounts.",
    version: "0.1.0",
    capabilities: ["users:read"],
    routes: {
      "product-setup/load": {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: loadProductSetup
      },
      "product-setup/save": {
        methods: ["POST"],
        request: { body: "json", maxBytes: 80 * 1024 },
        permission: "plugins:manage",
        handler: saveProductSetup
      },
      "inquiries/list": {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: listInquiries
      },
      "inquiries/detail": {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: inquiryDetail
      },
      "inquiries/attachment": {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: downloadInquiryAttachment
      },
      "inquiries/update": {
        ...jsonPost,
        permission: "plugins:manage",
        handler: updateInquiry
      },
      "inquiries/note": {
        ...jsonPost,
        permission: "plugins:manage",
        handler: addInquiryNote
      },
      "dealer-applications/list": {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: listDealerApplications
      },
      "dealer-applications/review": {
        ...jsonPost,
        permission: "plugins:manage",
        handler: reviewDealerApplication
      },
      "dealers/list": {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: listDealers
      },
      "dealers/activate": {
        ...jsonPost,
        permission: "plugins:manage",
        handler: activateDealer
      },
      "dealers/suspend": {
        ...jsonPost,
        permission: "plugins:manage",
        handler: suspendDealer
      }
    },
    admin: {
      entry: "./src/plugins/anvera-business/admin.tsx",
      pages: [
        { path: "/inquiries", label: "Inquiry Inbox", icon: "inbox", group: "ANVERA Business" },
        { path: "/dealer-applications", label: "Dealer Applications", icon: "building-2", group: "ANVERA Business" },
        { path: "/dealers", label: "Dealer Accounts", icon: "users", group: "ANVERA Business" }
      ]
    }
  });
}

export default createPlugin;
