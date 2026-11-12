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
  const specification = inputRecord(document.specification) ?? {};
  const products = Array.isArray(document.products) ? document.products.map(inputRecord).filter(Boolean) : [];
  const required = [
    factory.factoryName, factory.factoryCode, factory.country,
    material.materialGrade, material.forgingMethod,
    specification.diameterRange, specification.widthRange, specification.boltPatterns
  ];
  const validProducts = products.length > 0 && products.every((product) => {
    const selectedConstruction = inputString(product?.construction, 40);
    const selectedMaterial = inputString(product?.materialProfile, 200);
    const selectedForging = inputString(product?.forgingProfile, 200);
    const specifications = Array.isArray(product?.specifications) ? product.specifications.map(inputRecord).filter(Boolean) : [];
    const validSpecifications = specifications.length > 0 && specifications.every((row) => {
      const diameter = Number(row?.diameter);
      const width = Number(row?.width);
      const boltCount = Number(row?.boltCount);
      const pcd = Number(row?.pcd);
      const offset = Number(row?.offset);
      const centerBore = Number(row?.centerBore);
      const loadRating = row?.loadRating === undefined || row?.loadRating === "" ? null : Number(row.loadRating);
      return ["Front", "Rear", "Front & Rear"].includes(inputString(row?.role, 24)) &&
        Number.isFinite(diameter) && diameter > 0 &&
        Number.isFinite(width) && width > 0 &&
        Number.isInteger(boltCount) && boltCount > 0 &&
        Number.isFinite(pcd) && pcd > 0 &&
        Boolean(inputString(row?.offset, 32)) && Number.isFinite(offset) &&
        Number.isFinite(centerBore) && centerBore > 0 &&
        (loadRating === null || (Number.isFinite(loadRating) && loadRating > 0)) &&
        ["Draft", "Factory Supported", "Engineering Review", "Engineering Approved", "Restricted"].includes(inputString(row?.status, 32));
    });
    return Boolean(inputString(product?.productCode, 80)) &&
      Boolean(inputString(product?.productName, 120)) &&
      Boolean(selectedConstruction) &&
      Boolean(selectedMaterial) &&
      Boolean(selectedForging) &&
      validSpecifications;
  });
  return required.every((value) => typeof value === "string" && value.trim().length > 0) && validProducts;
}


async function validateProductConstructionCapabilities(db: D1Database, document: Record<string, unknown>) {
  const products = Array.isArray(document.products) ? document.products.map(inputRecord).filter(Boolean) : [];
  const construction = inputRecord(document.construction) ?? {};
  const legacy = inputString(construction.constructionTypes, 1000).split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
  const selected = [...new Set(products.map((product) => inputString(product?.construction, 40)).filter(Boolean))];
  if (!selected.length) return false;
  try {
    const rows = await db.prepare(`SELECT construction_type, status FROM anvera_pi_construction_capabilities WHERE construction_type IN (${selected.map(() => "?").join(",")})`)
      .bind(...selected).all<{ construction_type: string; status: string }>();
    const statuses = new Map(rows.results.map((item) => [item.construction_type, item.status]));
    return products.every((product) => statuses.get(inputString(product?.construction, 40)) === "approved");
  } catch (cause) {
    if (!String(cause).toLowerCase().includes("no such table")) throw cause;
    return products.every((product) => legacy.includes(inputString(product?.construction, 40)));
  }
}

async function validateProductCapabilityReferences(db: D1Database, document: Record<string, unknown>) {
  const products = Array.isArray(document.products) ? document.products.map(inputRecord).filter(Boolean) : [];
  const material = inputRecord(document.material) ?? {};
  const legacyGrades = inputString(material.materialGrade, 2000).split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
  const legacyProcesses = inputString(material.forgingMethod, 2000).split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
  const materialIds = [...new Set(products.map((product) => inputString(product?.materialProfile, 128)).filter(Boolean))];
  const processIds = [...new Set(products.map((product) => inputString(product?.forgingProfile, 128)).filter(Boolean))];
  if (!materialIds.length || !processIds.length) return false;

  try {
    const [materials, processes] = await Promise.all([
      db.prepare(`SELECT id, status FROM anvera_pi_material_profiles WHERE id IN (${materialIds.map(() => "?").join(",")})`)
        .bind(...materialIds).all<{ id: string; status: string }>(),
      db.prepare(`SELECT id, status FROM anvera_pi_forging_processes WHERE id IN (${processIds.map(() => "?").join(",")})`)
        .bind(...processIds).all<{ id: string; status: string }>()
    ]);
    const materialStatus = new Map(materials.results.map((item) => [item.id, item.status]));
    const processStatus = new Map(processes.results.map((item) => [item.id, item.status]));
    return products.every((product) =>
      materialStatus.get(inputString(product?.materialProfile, 128)) === "approved" &&
      processStatus.get(inputString(product?.forgingProfile, 128)) === "approved"
    );
  } catch (cause) {
    if (!String(cause).toLowerCase().includes("no such table")) throw cause;
    return products.every((product) =>
      legacyGrades.includes(inputString(product?.materialProfile, 200)) &&
      legacyProcesses.includes(inputString(product?.forgingProfile, 200))
    );
  }
}

async function syncWheelSpecifications(db: D1Database, sessionId: string, document: Record<string, unknown>, actorId: string) {
  const products = Array.isArray(document.products) ? document.products.map(inputRecord).filter(Boolean) : [];
  for (const product of products) {
    const productCode = inputString(product?.productCode, 80);
    if (!productCode) continue;
    const rows = Array.isArray(product?.specifications) ? product.specifications.map(inputRecord).filter(Boolean) : [];
    const existing = await db.prepare("SELECT specification_id, position, diameter, width, bolt_count, pcd, offset, center_bore, load_rating, evidence_ref, status, revision FROM anvera_pi_wheel_specifications WHERE setup_session_id = ? AND product_code = ?")
      .bind(sessionId, productCode).all<{ specification_id: string; position: string; diameter: number; width: number; bolt_count: number; pcd: number; offset: number; center_bore: number; load_rating: number | null; evidence_ref: string | null; status: string; revision: number }>();
    const existingById = new Map(existing.results.map((row) => [row.specification_id, row]));
    const activeIds = new Set<string>();
    for (const row of rows) {
      const id = inputString(row?.id, 128);
      const position = inputString(row?.role, 24);
      const diameter = Number(row?.diameter);
      const width = Number(row?.width);
      const boltCount = Number(row?.boltCount);
      const pcd = Number(row?.pcd);
      const offset = Number(row?.offset);
      const centerBore = Number(row?.centerBore);
      const loadRating = row?.loadRating === undefined || row?.loadRating === "" ? null : Number(row.loadRating);
      const evidenceRef = inputString(row?.evidenceRef, 200);
      if (!id || !["Front", "Rear", "Front & Rear"].includes(position) || ![diameter, width, boltCount, pcd, offset, centerBore].every(Number.isFinite)) continue;
      activeIds.add(id);
      const previous = existingById.get(id);
      const unchanged = previous && previous.position === position && previous.diameter === diameter && previous.width === width &&
        previous.bolt_count === boltCount && previous.pcd === pcd && previous.offset === offset &&
        previous.center_bore === centerBore && previous.load_rating === loadRating && previous.evidence_ref === (evidenceRef || null);
      const requested = inputString(row?.status, 32);
      const nextStatus = unchanged && ["approved", "restricted"].includes(previous?.status ?? "") ? previous!.status :
        requested === "Engineering Review" ? "pending_review" :
        requested === "Factory Supported" ? "factory_supported" : "draft";
      if (!previous) {
        await db.prepare("INSERT INTO anvera_pi_wheel_specifications (id, setup_session_id, product_code, specification_id, position, diameter, width, bolt_count, pcd, offset, center_bore, load_rating, evidence_ref, status, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), sessionId, productCode, id, position, diameter, width, boltCount, pcd, offset, centerBore, loadRating, evidenceRef || null, nextStatus, actorId, actorId).run();
      } else if (!unchanged || previous.status !== nextStatus) {
        await db.prepare("UPDATE anvera_pi_wheel_specifications SET position = ?, diameter = ?, width = ?, bolt_count = ?, pcd = ?, offset = ?, center_bore = ?, load_rating = ?, evidence_ref = ?, status = ?, revision = revision + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE setup_session_id = ? AND product_code = ? AND specification_id = ?")
          .bind(position, diameter, width, boltCount, pcd, offset, centerBore, loadRating, evidenceRef || null, nextStatus, actorId, sessionId, productCode, id).run();
      }
    }
    for (const previous of existing.results) {
      if (!activeIds.has(previous.specification_id) && previous.status !== "superseded") {
        await db.prepare("UPDATE anvera_pi_wheel_specifications SET status = 'superseded', revision = revision + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE setup_session_id = ? AND product_code = ? AND specification_id = ?")
          .bind(actorId, sessionId, productCode, previous.specification_id).run();
      }
    }
  }
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
  let specificationStatuses: Record<string, string> = {};
  try {
    const specifications = await access.db.prepare("SELECT specification_id, status FROM anvera_pi_wheel_specifications WHERE setup_session_id = ? AND status != 'superseded'")
      .bind(session.id).all<{ specification_id: string; status: string }>();
    specificationStatuses = Object.fromEntries(specifications.results.map((row) => [row.specification_id, row.status]));
  } catch (cause) {
    if (!String(cause).toLowerCase().includes("no such table")) throw cause;
  }
  return {
    available: true,
    session: { id: session.id, status: session.status, revision: session.revision, updated_at: session.updated_at },
    document, stepState, events: events.results, versions: versions.results, specificationStatuses
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
  if (action === "submit") {
    if (!setupDocumentIsSubmittable(document)) return { saved: false, reason: "validation_failed" };
    if (!await validateProductConstructionCapabilities(access.db, document)) {
      return { saved: false, reason: "product_construction_capability_invalid" };
    }
    if (!await validateProductCapabilityReferences(access.db, document)) {
      return { saved: false, reason: "product_capability_reference_invalid" };
    }
    if (!await validateProductFinishMappings(access.db, document)) {
      return { saved: false, reason: "product_finish_mapping_invalid" };
    }
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
    const mappingWarning = await trySyncProductFinishMappings(access.db, id, document, actorId);
    await syncWheelSpecifications(access.db, id, document, actorId);
    return { saved: true, sessionId: id, revision: nextRevision, status: nextStatus, mappingWarning };
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
  const mappingWarning = await trySyncProductFinishMappings(access.db, existing.id, document, actorId);
  await syncWheelSpecifications(access.db, existing.id, document, actorId);
  return { saved: true, sessionId: existing.id, revision: nextRevision, status: nextStatus, mappingWarning };
}


type MaterialProfileInput = {
  code: string; name: string; family: string; grade: string; standard: string;
  supplier: string; certificateRef: string; evidenceNote: string; status: string;
};

type ForgingProcessInput = {
  code: string; name: string; processType: string; equipment: string;
  capacityNotes: string; heatTreatment: string; cncCapability: string;
  evidenceRef: string; status: string;
};

async function getProductLibraryDatabase(ctx: AdminContext) {
  if (ctx.user?.role !== 50) return { error: { available: false, reason: "forbidden" } as const };
  const { env } = await import("cloudflare:workers");
  if (env.ANVERA_PRODUCT_INTELLIGENCE_ENABLED !== "true") {
    return { error: { available: false, reason: "feature_disabled" } as const };
  }
  return { db: env.DB };
}

function libraryStatus(value: unknown) {
  const status = inputString(value, 32) || "draft";
  return ["draft", "pending_review"].includes(status) ? status : "";
}

async function listProductLibrary(ctx: AdminContext) {
  if (ctx.request.method !== "GET") return { available: false, reason: "method_not_allowed" };
  const access = await getProductLibraryDatabase(ctx);
  if ("error" in access) return access.error;
  try {
    const [materials, forgingProcesses, finishes, constructions] = await Promise.all([
      access.db.prepare("SELECT id, code, name, family, grade, standard, supplier, certificate_ref, evidence_note, status, revision, created_at, updated_at FROM anvera_pi_material_profiles ORDER BY code COLLATE NOCASE").all(),
      access.db.prepare("SELECT id, code, name, process_type, equipment, capacity_notes, heat_treatment, cnc_capability, evidence_ref, status, revision, created_at, updated_at FROM anvera_pi_forging_processes ORDER BY code COLLATE NOCASE").all(),
      access.db.prepare("SELECT id, code, name, finish_type, process_description, appearance_reference, supported_constructions_json, restrictions, evidence_ref, status, revision, created_at, updated_at FROM anvera_pi_finish_profiles ORDER BY code COLLATE NOCASE").all(),
      access.db.prepare("SELECT id, construction_type, capability_scope, assembly_method, fastener_requirements, quality_processes, structural_limitations, evidence_ref, status, revision, created_at, updated_at FROM anvera_pi_construction_capabilities ORDER BY construction_type").all()
    ]);
    return { available: true, materials: materials.results, forgingProcesses: forgingProcesses.results, finishes: finishes.results, constructions: constructions.results };
  } catch (cause) {
    if (String(cause).toLowerCase().includes("no such table")) return { available: false, reason: "migration_pending" };
    throw cause;
  }
}

async function saveMaterialProfile(ctx: AdminContext) {
  if (ctx.request.method !== "POST") return { saved: false, reason: "method_not_allowed" };
  const access = await getProductLibraryDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const id = inputString(body?.id, 128);
  const revision = Math.max(0, Math.floor(Number(body?.revision) || 0));
  const value: MaterialProfileInput = {
    code: inputString(body?.code, 48).toUpperCase(),
    name: inputString(body?.name, 120),
    family: inputString(body?.family, 64),
    grade: inputString(body?.grade, 80),
    standard: inputString(body?.standard, 120),
    supplier: inputString(body?.supplier, 160),
    certificateRef: inputString(body?.certificateRef, 200),
    evidenceNote: inputString(body?.evidenceNote, 2000),
    status: libraryStatus(body?.status)
  };
  if (!value.code || !value.name || !value.family || !value.grade || !value.status) {
    return { saved: false, reason: "invalid_input" };
  }
  const actorId = ctx.user!.id;
  const nextRevision = revision + 1;
  const eventId = crypto.randomUUID();
  try {
    if (!id) {
      const newId = crypto.randomUUID();
      await access.db.batch([
        access.db.prepare("INSERT INTO anvera_pi_material_profiles (id, code, name, family, grade, standard, supplier, certificate_ref, evidence_note, status, revision, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
          .bind(newId, value.code, value.name, value.family, value.grade, value.standard || null, value.supplier || null, value.certificateRef || null, value.evidenceNote || null, value.status, actorId, actorId),
        access.db.prepare("INSERT INTO anvera_pi_library_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) VALUES (?, 'material', ?, ?, ?, 1, ?)")
          .bind(eventId, newId, value.status === "pending_review" ? "submitted_for_review" : "created", actorId, `Material profile ${value.code} created`)
      ]);
      return { saved: true, id: newId, revision: 1 };
    }
    const result = await access.db.batch([
      access.db.prepare("UPDATE anvera_pi_material_profiles SET code = ?, name = ?, family = ?, grade = ?, standard = ?, supplier = ?, certificate_ref = ?, evidence_note = ?, status = ?, revision = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ? AND status IN ('draft', 'pending_review')")
        .bind(value.code, value.name, value.family, value.grade, value.standard || null, value.supplier || null, value.certificateRef || null, value.evidenceNote || null, value.status, nextRevision, actorId, id, revision),
      access.db.prepare("INSERT INTO anvera_pi_library_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) SELECT ?, 'material', ?, ?, ?, ?, ? WHERE changes() > 0")
        .bind(eventId, id, value.status === "pending_review" ? "submitted_for_review" : "updated", actorId, nextRevision, `Material profile ${value.code} updated`)
    ]);
    if ((result[0]?.meta?.changes ?? 0) === 0) return { saved: false, reason: "revision_conflict_or_locked" };
    return { saved: true, id, revision: nextRevision };
  } catch (cause) {
    if (String(cause).toLowerCase().includes("unique")) return { saved: false, reason: "duplicate_code" };
    if (String(cause).toLowerCase().includes("no such table")) return { saved: false, reason: "migration_pending" };
    throw cause;
  }
}

async function saveForgingProcess(ctx: AdminContext) {
  if (ctx.request.method !== "POST") return { saved: false, reason: "method_not_allowed" };
  const access = await getProductLibraryDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const id = inputString(body?.id, 128);
  const revision = Math.max(0, Math.floor(Number(body?.revision) || 0));
  const value: ForgingProcessInput = {
    code: inputString(body?.code, 48).toUpperCase(),
    name: inputString(body?.name, 120),
    processType: inputString(body?.processType, 80),
    equipment: inputString(body?.equipment, 160),
    capacityNotes: inputString(body?.capacityNotes, 2000),
    heatTreatment: inputString(body?.heatTreatment, 1000),
    cncCapability: inputString(body?.cncCapability, 2000),
    evidenceRef: inputString(body?.evidenceRef, 200),
    status: libraryStatus(body?.status)
  };
  if (!value.code || !value.name || !value.processType || !value.status) {
    return { saved: false, reason: "invalid_input" };
  }
  const actorId = ctx.user!.id;
  const nextRevision = revision + 1;
  const eventId = crypto.randomUUID();
  try {
    if (!id) {
      const newId = crypto.randomUUID();
      await access.db.batch([
        access.db.prepare("INSERT INTO anvera_pi_forging_processes (id, code, name, process_type, equipment, capacity_notes, heat_treatment, cnc_capability, evidence_ref, status, revision, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
          .bind(newId, value.code, value.name, value.processType, value.equipment || null, value.capacityNotes || null, value.heatTreatment || null, value.cncCapability || null, value.evidenceRef || null, value.status, actorId, actorId),
        access.db.prepare("INSERT INTO anvera_pi_library_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) VALUES (?, 'forging_process', ?, ?, ?, 1, ?)")
          .bind(eventId, newId, value.status === "pending_review" ? "submitted_for_review" : "created", actorId, `Forging process ${value.code} created`)
      ]);
      return { saved: true, id: newId, revision: 1 };
    }
    const result = await access.db.batch([
      access.db.prepare("UPDATE anvera_pi_forging_processes SET code = ?, name = ?, process_type = ?, equipment = ?, capacity_notes = ?, heat_treatment = ?, cnc_capability = ?, evidence_ref = ?, status = ?, revision = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ? AND status IN ('draft', 'pending_review')")
        .bind(value.code, value.name, value.processType, value.equipment || null, value.capacityNotes || null, value.heatTreatment || null, value.cncCapability || null, value.evidenceRef || null, value.status, nextRevision, actorId, id, revision),
      access.db.prepare("INSERT INTO anvera_pi_library_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) SELECT ?, 'forging_process', ?, ?, ?, ?, ? WHERE changes() > 0")
        .bind(eventId, id, value.status === "pending_review" ? "submitted_for_review" : "updated", actorId, nextRevision, `Forging process ${value.code} updated`)
    ]);
    if ((result[0]?.meta?.changes ?? 0) === 0) return { saved: false, reason: "revision_conflict_or_locked" };
    return { saved: true, id, revision: nextRevision };
  } catch (cause) {
    if (String(cause).toLowerCase().includes("unique")) return { saved: false, reason: "duplicate_code" };
    if (String(cause).toLowerCase().includes("no such table")) return { saved: false, reason: "migration_pending" };
    throw cause;
  }
}



type FinishProfileInput = {
  code: string; name: string; finishType: string; processDescription: string;
  appearanceReference: string; supportedConstructions: string[]; restrictions: string;
  evidenceRef: string; status: string;
};

async function saveFinishProfile(ctx: AdminContext) {
  if (ctx.request.method !== "POST") return { saved: false, reason: "method_not_allowed" };
  const access = await getProductLibraryDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const id = inputString(body?.id, 128);
  const revision = Math.max(0, Math.floor(Number(body?.revision) || 0));
  const rawConstructions = Array.isArray(body?.supportedConstructions) ? body.supportedConstructions : [];
  const supportedConstructions = [...new Set(rawConstructions.map((value) => inputString(value, 32)).filter((value) => ["Monoblock", "Two-piece", "Three-piece"].includes(value)))];
  const value: FinishProfileInput = {
    code: inputString(body?.code, 48).toUpperCase(),
    name: inputString(body?.name, 120),
    finishType: inputString(body?.finishType, 80),
    processDescription: inputString(body?.processDescription, 2000),
    appearanceReference: inputString(body?.appearanceReference, 200),
    supportedConstructions,
    restrictions: inputString(body?.restrictions, 2000),
    evidenceRef: inputString(body?.evidenceRef, 200),
    status: libraryStatus(body?.status)
  };
  if (!value.code || !value.name || !value.finishType || !value.supportedConstructions.length || !value.status) {
    return { saved: false, reason: "invalid_input" };
  }
  const actorId = ctx.user!.id;
  const nextRevision = revision + 1;
  try {
    if (!id) {
      const newId = crypto.randomUUID();
      await access.db.batch([
        access.db.prepare("INSERT INTO anvera_pi_finish_profiles (id, code, name, finish_type, process_description, appearance_reference, supported_constructions_json, restrictions, evidence_ref, status, revision, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
          .bind(newId, value.code, value.name, value.finishType, value.processDescription || null, value.appearanceReference || null, JSON.stringify(value.supportedConstructions), value.restrictions || null, value.evidenceRef || null, value.status, actorId, actorId),
        access.db.prepare("INSERT INTO anvera_pi_finish_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) VALUES (?, 'finish_profile', ?, ?, ?, 1, ?)")
          .bind(crypto.randomUUID(), newId, value.status === "pending_review" ? "submitted_for_review" : "created", actorId, `Finish profile ${value.code} created`)
      ]);
      return { saved: true, id: newId, revision: 1 };
    }
    const result = await access.db.batch([
      access.db.prepare("UPDATE anvera_pi_finish_profiles SET code = ?, name = ?, finish_type = ?, process_description = ?, appearance_reference = ?, supported_constructions_json = ?, restrictions = ?, evidence_ref = ?, status = ?, revision = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ? AND status IN ('draft', 'pending_review')")
        .bind(value.code, value.name, value.finishType, value.processDescription || null, value.appearanceReference || null, JSON.stringify(value.supportedConstructions), value.restrictions || null, value.evidenceRef || null, value.status, nextRevision, actorId, id, revision),
      access.db.prepare("INSERT INTO anvera_pi_finish_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) SELECT ?, 'finish_profile', ?, ?, ?, ?, ? WHERE changes() > 0")
        .bind(crypto.randomUUID(), id, value.status === "pending_review" ? "submitted_for_review" : "updated", actorId, nextRevision, `Finish profile ${value.code} updated`)
    ]);
    if ((result[0]?.meta?.changes ?? 0) === 0) return { saved: false, reason: "revision_conflict_or_locked" };
    return { saved: true, id, revision: nextRevision };
  } catch (cause) {
    if (String(cause).toLowerCase().includes("unique")) return { saved: false, reason: "duplicate_code" };
    if (String(cause).toLowerCase().includes("no such table")) return { saved: false, reason: "migration_pending" };
    throw cause;
  }
}

async function syncProductFinishMappings(db: D1Database, sessionId: string, document: Record<string, unknown>, actorId: string) {
  const products = Array.isArray(document.products) ? document.products.map(inputRecord).filter(Boolean) : [];
  const desired = new Map<string, { productCode: string; finishId: string; construction: string }>();
  for (const product of products) {
    const productCode = inputString(product?.productCode, 80);
    if (!productCode) continue;
    const finishIds = Array.isArray(product?.finishProfiles) ? product.finishProfiles.map((value) => inputString(value, 128)).filter(Boolean) : [];
    for (const finishId of finishIds) desired.set(`${productCode}::${finishId}`, { productCode, finishId, construction: inputString(product?.construction, 40) });
  }
  const existing = await db.prepare("SELECT id, product_code, finish_profile_id, mapping_status, revision FROM anvera_pi_product_finish_mappings WHERE setup_session_id = ?")
    .bind(sessionId).all<{ id: string; product_code: string; finish_profile_id: string; mapping_status: string; revision: number }>();
  const existingByKey = new Map(existing.results.map((item) => [`${item.product_code}::${item.finish_profile_id}`, item]));
  const statements = [];
  for (const item of existing.results) {
    const key = `${item.product_code}::${item.finish_profile_id}`;
    if (!desired.has(key) && item.mapping_status !== "superseded") {
      statements.push(db.prepare("UPDATE anvera_pi_product_finish_mappings SET mapping_status = 'superseded', revision = revision + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ?")
        .bind(actorId, item.id, item.revision));
      statements.push(db.prepare("INSERT INTO anvera_pi_finish_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) VALUES (?, 'product_finish_mapping', ?, 'mapping_removed', ?, ?, ?)")
        .bind(crypto.randomUUID(), item.id, actorId, item.revision + 1, `Finish mapping ${item.product_code} removed`));
    }
  }
  for (const [key, item] of desired) {
    const profile = await db.prepare("SELECT status, supported_constructions_json FROM anvera_pi_finish_profiles WHERE id = ? LIMIT 1")
      .bind(item.finishId).first<{ status: string; supported_constructions_json: string }>();
    let supported: string[] = [];
    try { supported = JSON.parse(profile?.supported_constructions_json ?? "[]") as string[]; } catch { supported = []; }
    const valid = profile?.status === "approved" && supported.includes(item.construction);
    const current = existingByKey.get(key);
    if (current) {
      const nextStatus = !valid ? "restricted" :
        ["superseded", "restricted"].includes(current.mapping_status) ? "pending_review" : current.mapping_status;
      if (current.mapping_status !== nextStatus) {
        statements.push(db.prepare("UPDATE anvera_pi_product_finish_mappings SET mapping_status = ?, revision = revision + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ?")
          .bind(nextStatus, actorId, current.id, current.revision));
        statements.push(db.prepare("INSERT INTO anvera_pi_finish_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) VALUES (?, 'product_finish_mapping', ?, 'mapping_updated', ?, ?, ?)")
          .bind(crypto.randomUUID(), current.id, actorId, current.revision + 1, valid ? "Finish mapping resubmitted for engineering review" : "Finish mapping restricted because its profile is not approved or does not support the product construction"));
      }
      continue;
    }
    if (!valid) continue;
    const mappingId = crypto.randomUUID();
    statements.push(db.prepare("INSERT INTO anvera_pi_product_finish_mappings (id, setup_session_id, product_code, finish_profile_id, mapping_status, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, 'pending_review', ?, ?)")
      .bind(mappingId, sessionId, item.productCode, item.finishId, actorId, actorId));
    statements.push(db.prepare("INSERT INTO anvera_pi_finish_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) VALUES (?, 'product_finish_mapping', ?, 'mapping_created', ?, 1, ?)")
      .bind(crypto.randomUUID(), mappingId, actorId, `Finish profile mapped to product ${item.productCode}; pending engineering review`));
  }
  if (statements.length) await db.batch(statements);
}

async function validateProductFinishMappings(db: D1Database, document: Record<string, unknown>) {
  const products = Array.isArray(document.products) ? document.products.map(inputRecord).filter(Boolean) : [];
  const selected = products.flatMap((product) => {
    const productCode = inputString(product?.productCode, 80);
    const construction = inputString(product?.construction, 40);
    const ids = Array.isArray(product?.finishProfiles) ? product.finishProfiles.map((value) => inputString(value, 128)).filter(Boolean) : [];
    return ids.map((id) => ({ id, construction, productCode }));
  });
  if (!selected.length) return true;
  try {
    const ids = [...new Set(selected.map((item) => item.id))];
    const rows = await db.prepare(`SELECT id, status, supported_constructions_json FROM anvera_pi_finish_profiles WHERE id IN (${ids.map(() => "?").join(",")})`)
      .bind(...ids).all<{ id: string; status: string; supported_constructions_json: string }>();
    const profiles = new Map(rows.results.map((item) => [item.id, item]));
    return selected.every((item) => {
      const profile = profiles.get(item.id);
      if (!profile || profile.status !== "approved") return false;
      try { return (JSON.parse(profile.supported_constructions_json) as string[]).includes(item.construction); } catch { return false; }
    });
  } catch (cause) {
    if (String(cause).toLowerCase().includes("no such table")) return false;
    throw cause;
  }
}

async function trySyncProductFinishMappings(db: D1Database, sessionId: string, document: Record<string, unknown>, actorId: string) {
  try {
    await syncProductFinishMappings(db, sessionId, document, actorId);
    return null;
  } catch (cause) {
    if (String(cause).toLowerCase().includes("no such table")) return null;
    return "The setup draft was saved, but one or more finish mappings could not be synchronized. Check finish approval and construction compatibility.";
  }
}

async function saveConstructionCapability(ctx: AdminContext) {
  if (ctx.request.method !== "POST") return { saved: false, reason: "method_not_allowed" };
  const access = await getProductLibraryDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const id = inputString(body?.id, 128);
  const revision = Math.max(0, Math.floor(Number(body?.revision) || 0));
  const constructionType = inputString(body?.constructionType, 32);
  const status = libraryStatus(body?.status);
  const value = {
    constructionType,
    capabilityScope: inputString(body?.capabilityScope, 2000),
    assemblyMethod: inputString(body?.assemblyMethod, 1000),
    fastenerRequirements: inputString(body?.fastenerRequirements, 1000),
    qualityProcesses: inputString(body?.qualityProcesses, 2000),
    structuralLimitations: inputString(body?.structuralLimitations, 2000),
    evidenceRef: inputString(body?.evidenceRef, 200),
    status
  };
  if (!["Monoblock", "Two-piece", "Three-piece"].includes(value.constructionType) || !value.status) {
    return { saved: false, reason: "invalid_input" };
  }
  if (value.status === "pending_review" && (
    !value.capabilityScope || !value.qualityProcesses || !value.evidenceRef ||
    (["Two-piece", "Three-piece"].includes(value.constructionType) && (!value.assemblyMethod || !value.fastenerRequirements))
  )) {
    return { saved: false, reason: "engineering_evidence_required" };
  }
  const actorId = ctx.user!.id;
  const nextRevision = revision + 1;
  try {
    if (!id) {
      const newId = crypto.randomUUID();
      await access.db.batch([
        access.db.prepare("INSERT INTO anvera_pi_construction_capabilities (id, construction_type, capability_scope, assembly_method, fastener_requirements, quality_processes, structural_limitations, evidence_ref, status, revision, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
          .bind(newId, value.constructionType, value.capabilityScope || null, value.assemblyMethod || null, value.fastenerRequirements || null, value.qualityProcesses || null, value.structuralLimitations || null, value.evidenceRef || null, value.status, actorId, actorId),
        access.db.prepare("INSERT INTO anvera_pi_construction_events (id, construction_capability_id, event_type, actor_user_id, revision, summary) VALUES (?, ?, ?, ?, 1, ?)")
          .bind(crypto.randomUUID(), newId, value.status === "pending_review" ? "submitted_for_review" : "created", actorId, `${value.constructionType} capability created`)
      ]);
      return { saved: true, id: newId, revision: 1 };
    }
    const result = await access.db.batch([
      access.db.prepare("UPDATE anvera_pi_construction_capabilities SET construction_type = ?, capability_scope = ?, assembly_method = ?, fastener_requirements = ?, quality_processes = ?, structural_limitations = ?, evidence_ref = ?, status = ?, revision = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ? AND status IN ('draft', 'pending_review')")
        .bind(value.constructionType, value.capabilityScope || null, value.assemblyMethod || null, value.fastenerRequirements || null, value.qualityProcesses || null, value.structuralLimitations || null, value.evidenceRef || null, value.status, nextRevision, actorId, id, revision),
      access.db.prepare("INSERT INTO anvera_pi_construction_events (id, construction_capability_id, event_type, actor_user_id, revision, summary) SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0")
        .bind(crypto.randomUUID(), id, value.status === "pending_review" ? "submitted_for_review" : "updated", actorId, nextRevision, `${value.constructionType} capability updated`)
    ]);
    if ((result[0]?.meta?.changes ?? 0) === 0) return { saved: false, reason: "revision_conflict_or_locked" };
    return { saved: true, id, revision: nextRevision };
  } catch (cause) {
    if (String(cause).toLowerCase().includes("unique")) return { saved: false, reason: "construction_already_exists" };
    if (String(cause).toLowerCase().includes("no such table")) return { saved: false, reason: "migration_pending" };
    throw cause;
  }
}


async function listProductLibraryReviewQueue(ctx: AdminContext) {
  if (ctx.request.method !== "GET") return { available: false, reason: "method_not_allowed" };
  const access = await getProductLibraryDatabase(ctx);
  if ("error" in access) return access.error;
  try {
    const [materials, forgingProcesses, finishes, finishMappings, constructions, wheelSpecifications] = await Promise.all([
      access.db.prepare("SELECT id, code, name, grade AS detail, status, revision, updated_at FROM anvera_pi_material_profiles WHERE status = 'pending_review' ORDER BY updated_at ASC").all<{ id: string; code: string; name: string; detail: string; status: string; revision: number; updated_at: string }>(),
      access.db.prepare("SELECT id, code, name, process_type AS detail, status, revision, updated_at FROM anvera_pi_forging_processes WHERE status = 'pending_review' ORDER BY updated_at ASC").all<{ id: string; code: string; name: string; detail: string; status: string; revision: number; updated_at: string }>(),
      access.db.prepare("SELECT id, code, name, finish_type AS detail, status, revision, updated_at FROM anvera_pi_finish_profiles WHERE status = 'pending_review' ORDER BY updated_at ASC").all<{ id: string; code: string; name: string; detail: string; status: string; revision: number; updated_at: string }>(),
      access.db.prepare("SELECT m.id, m.product_code AS code, f.name, f.finish_type AS detail, m.mapping_status AS status, m.revision, m.updated_at FROM anvera_pi_product_finish_mappings m JOIN anvera_pi_finish_profiles f ON f.id = m.finish_profile_id WHERE m.mapping_status = 'pending_review' ORDER BY m.updated_at ASC").all<{ id: string; code: string; name: string; detail: string; status: string; revision: number; updated_at: string }>(),
      access.db.prepare("SELECT id, construction_type AS code, construction_type AS name, capability_scope AS detail, status, revision, updated_at FROM anvera_pi_construction_capabilities WHERE status = 'pending_review' ORDER BY updated_at ASC").all<{ id: string; code: string; name: string; detail: string; status: string; revision: number; updated_at: string }>(),
      access.db.prepare("SELECT id, product_code AS code, product_code || ' · ' || position AS name, diameter || ' × ' || width || ' in · ' || bolt_count || '×' || pcd || ' PCD · ET' || offset || ' · Load ' || COALESCE(load_rating, 'not set') || ' kg · Evidence ' || COALESCE(evidence_ref, 'missing') AS detail, status, revision, updated_at FROM anvera_pi_wheel_specifications WHERE status = 'pending_review' ORDER BY updated_at ASC").all<{ id: string; code: string; name: string; detail: string; status: string; revision: number; updated_at: string }>()
    ]);
    return {
      available: true,
      items: [
        ...materials.results.map((item) => ({ ...item, entity_type: "material" })),
        ...forgingProcesses.results.map((item) => ({ ...item, entity_type: "forging_process" })),
        ...finishes.results.map((item) => ({ ...item, entity_type: "finish_profile" })),
        ...finishMappings.results.map((item) => ({ ...item, entity_type: "product_finish_mapping" })),
        ...constructions.results.map((item) => ({ ...item, entity_type: "construction_capability" })),
        ...wheelSpecifications.results.map((item) => ({ ...item, entity_type: "wheel_specification" }))
      ].sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))
    };
  } catch (cause) {
    if (String(cause).toLowerCase().includes("no such table")) return { available: false, reason: "migration_pending" };
    throw cause;
  }
}

async function reviewProductLibraryRecord(ctx: AdminContext) {
  if (ctx.request.method !== "POST") return { reviewed: false, reason: "method_not_allowed" };
  const access = await getProductLibraryDatabase(ctx);
  if ("error" in access) return access.error;
  const body = inputRecord(ctx.input);
  const entityType = inputString(body?.entityType, 40);
  const id = inputString(body?.id, 128);
  const revision = Math.max(0, Math.floor(Number(body?.revision) || 0));
  const decision = inputString(body?.decision, 32);
  const note = inputString(body?.note, 2000);
  if (!id || revision < 1 || !["material", "forging_process", "finish_profile", "product_finish_mapping", "construction_capability", "wheel_specification"].includes(entityType) || !["approved", "needs_revision", "restricted"].includes(decision)) {
    return { reviewed: false, reason: "invalid_input" };
  }
  const isMapping = entityType === "product_finish_mapping";
  const table = entityType === "material" ? "anvera_pi_material_profiles" :
    entityType === "forging_process" ? "anvera_pi_forging_processes" :
    entityType === "finish_profile" ? "anvera_pi_finish_profiles" : entityType === "product_finish_mapping" ? "anvera_pi_product_finish_mappings" : entityType === "wheel_specification" ? "anvera_pi_wheel_specifications" : "anvera_pi_construction_capabilities";
  const statusColumn = isMapping ? "mapping_status" : "status";
  const codeColumn = isMapping ? "product_code" : entityType === "construction_capability" ? "construction_type" : entityType === "wheel_specification" ? "product_code" : "code";
  const current = await access.db.prepare(`SELECT ${codeColumn} AS code, ${statusColumn} AS status, revision FROM ${table} WHERE id = ? LIMIT 1`)
    .bind(id).first<{ code: string; status: string; revision: number }>();
  if (!current) return { reviewed: false, reason: "not_found" };
  if (current.status !== "pending_review") return { reviewed: false, reason: "not_pending_review", status: current.status };
  if (entityType === "wheel_specification" && decision === "approved") {
    const specification = await access.db.prepare("SELECT load_rating, evidence_ref FROM anvera_pi_wheel_specifications WHERE id = ? LIMIT 1")
      .bind(id).first<{ load_rating: number | null; evidence_ref: string | null }>();
    if (!specification?.load_rating || !specification.evidence_ref?.trim()) {
      return { reviewed: false, reason: "engineering_evidence_required" };
    }
  }
  if (current.revision !== revision) return { reviewed: false, reason: "revision_conflict", revision: current.revision };
  const nextStatus = decision === "approved" ? "approved" : decision === "restricted" ? "restricted" : isMapping ? "needs_revision" : entityType === "wheel_specification" ? "draft" : "draft";
  const nextRevision = current.revision + 1;
  const actorId = ctx.user!.id;
  const statements = [
    access.db.prepare(`UPDATE ${table} SET ${statusColumn} = ?, revision = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ? AND ${statusColumn} = 'pending_review'`)
      .bind(nextStatus, nextRevision, actorId, id, revision),
    access.db.prepare("INSERT INTO anvera_pi_library_review_decisions (id, entity_type, entity_id, decision, reviewer_user_id, review_note, previous_revision, resulting_revision) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0")
      .bind(crypto.randomUUID(), entityType, id, decision, actorId, note || null, revision, nextRevision)
  ];
  if (isMapping) {
    statements.push(access.db.prepare("INSERT INTO anvera_pi_finish_events (id, entity_type, entity_id, event_type, actor_user_id, revision, summary) SELECT ?, 'product_finish_mapping', ?, 'mapping_updated', ?, ?, ? WHERE changes() > 0")
      .bind(crypto.randomUUID(), id, actorId, nextRevision, `Product finish mapping ${decision.replaceAll("_", " ")}`));
  }
  const result = await access.db.batch(statements);
  if ((result[0]?.meta?.changes ?? 0) === 0) return { reviewed: false, reason: "revision_conflict" };
  return { reviewed: true, status: nextStatus, revision: nextRevision };
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
      "product-library/review-queue": {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: listProductLibraryReviewQueue
      },
      "product-library/review": {
        methods: ["POST"],
        request: { body: "json", maxBytes: 8 * 1024 },
        permission: "plugins:manage",
        handler: reviewProductLibraryRecord
      },
      "product-library/list": {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: listProductLibrary
      },
      "product-library/material/save": {
        methods: ["POST"],
        request: { body: "json", maxBytes: 12 * 1024 },
        permission: "plugins:manage",
        handler: saveMaterialProfile
      },
      "product-library/forging/save": {
        methods: ["POST"],
        request: { body: "json", maxBytes: 12 * 1024 },
        permission: "plugins:manage",
        handler: saveForgingProcess
      },
      "product-library/finish/save": {
        methods: ["POST"],
        request: { body: "json", maxBytes: 12 * 1024 },
        permission: "plugins:manage",
        handler: saveFinishProfile
      },
      "product-library/construction/save": {
        methods: ["POST"],
        request: { body: "json", maxBytes: 12 * 1024 },
        permission: "plugins:manage",
        handler: saveConstructionCapability
      },
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
        { path: "/dealers", label: "Dealer Accounts", icon: "users", group: "ANVERA Business" },
        { path: "/product-intelligence", label: "Product Intelligence", icon: "database", group: "ANVERA Business" }
      ]
    }
  });
}

export default createPlugin;
