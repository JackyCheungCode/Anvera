import { definePlugin } from "emdash";

type AdminContext = {
  request: Request;
  user?: { id: string; role: number };
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

function pageParams(url: URL) {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));
  const requestedLimit = Math.floor(Number(url.searchParams.get("limit")) || PAGE_SIZE_DEFAULT);
  const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, requestedLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function normalizedSearch(url: URL) {
  return (url.searchParams.get("q") ?? "").trim().slice(0, 120);
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

function listFilter(url: URL, allowedStatuses: readonly string[]) {
  const status = url.searchParams.get("status") ?? "";
  return allowedStatuses.includes(status) ? status : "";
}

async function listInquiries(ctx: AdminContext) {
  if (ctx.request.method !== "GET") {
    return { available: false, reason: "method_not_allowed" };
  }
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
  if (ctx.request.method !== "GET") {
    return { ok: false, code: "METHOD_NOT_ALLOWED" };
  }
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
  if (ctx.request.method !== "GET") {
    return { ok: false, code: "METHOD_NOT_ALLOWED" };
  }
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
  return { ok: true, data: { items: rows.results, page, limit, total: count?.total ?? 0 } };
}

async function listDealers(ctx: AdminContext) {
  if (ctx.request.method !== "GET") {
    return { ok: false, code: "METHOD_NOT_ALLOWED" };
  }
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
  return { ok: true, data: { items: rows.results, page, limit, total: count?.total ?? 0 } };
}

export function createPlugin() {
  return definePlugin({
    id: "anvera-business",
    displayName: "ANVERA Business",
    description: "Business operations workspace for inquiries and dealer accounts.",
    version: "0.1.0",
    capabilities: [],
    routes: {
      "inquiries/list": {
        permission: "plugins:manage",
        handler: listInquiries
      },
      "inquiries/detail": {
        permission: "plugins:manage",
        handler: inquiryDetail
      },
      "dealer-applications/list": {
        permission: "plugins:manage",
        handler: listDealerApplications
      },
      "dealers/list": {
        permission: "plugins:manage",
        handler: listDealers
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
