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
  email: string;
  phone: string | null;
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

  return { db: env.DB };
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
    access.db.prepare(`SELECT id, reference_code, status, legal_company_name, trading_name, business_type, country, city, contact_name, email, phone, created_at FROM anvera_dealer_applications${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
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

const jsonPost: { methods: ("GET" | "POST" | "HEAD" | "PUT" | "PATCH" | "DELETE")[]; request: { body: "json"; maxBytes: number } } = { methods: ["POST"], request: { body: "json", maxBytes: 16 * 1024 } };

export function createPlugin() {
  return definePlugin({
    id: "anvera-business",
    displayName: "ANVERA Business",
    description: "Business operations workspace for inquiries and dealer accounts.",
    version: "0.1.0",
    capabilities: ["users:read"],
    routes: {
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
