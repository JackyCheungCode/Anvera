import type { APIRoute } from "astro";
import { acceptPublicSubmission, clean, publicJson, referenceCode } from "../../lib/public-business-api";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const accepted = await acceptPublicSubmission({ request, locals }, ["legalCompanyName", "businessType", "country", "contactName", "email"]);
  if (!accepted.ok) return accepted.response;
  const { env, data } = accepted;
  const yearsText = clean(data.yearsInBusiness, 4);
  const years = yearsText ? Number(yearsText) : null;
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 150)) {
    return publicJson({ ok: false, error: "invalid_years_in_business" }, 422);
  }
  const website = clean(data.companyWebsite, 300);
  if (website) {
    try {
      const parsed = new URL(website);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid");
    } catch {
      return publicJson({ ok: false, error: "invalid_company_website" }, 422);
    }
  }

  const id = crypto.randomUUID();
  const code = referenceCode("DLR");
  try {
    await env.DB.prepare(`INSERT INTO anvera_dealer_applications
      (id, reference_code, status, legal_company_name, trading_name, website, business_type, country, city, years_in_business, represented_brands, contact_name, contact_role, email, phone, notes)
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id, code, clean(data.legalCompanyName, 200), clean(data.tradingName, 160) || null,
        website || null, clean(data.businessType, 100), clean(data.country, 100),
        clean(data.city, 100) || null, years, clean(data.representedBrands, 500) || null,
        clean(data.contactName, 160), clean(data.contactRole, 100) || null,
        clean(data.email, 254).toLowerCase(), clean(data.phone, 60) || null,
        clean(data.notes, 4000) || null
      ).run();
    return publicJson({ ok: true, referenceCode: code }, 201);
  } catch {
    return publicJson({ ok: false, error: "submission_failed" }, 500);
  }
};
