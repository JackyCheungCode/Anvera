import type { APIRoute } from "astro";
import { acceptPublicSubmission, clean, publicJson, referenceCode } from "../../lib/public-business-api";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const accepted = await acceptPublicSubmission({ request, locals }, ["customerName", "email", "vehicleMake", "vehicleModel"]);
  if (!accepted.ok) return accepted.response;
  const { env, data } = accepted;
  const yearText = clean(data.vehicleYear, 4);
  const year = yearText ? Number(yearText) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1886 || year > new Date().getUTCFullYear() + 2)) {
    return publicJson({ ok: false, error: "invalid_vehicle_year" }, 422);
  }
  const constructionMap: Record<string, string> = {
    monoblock: "monoblock", "two-piece": "two_piece", "three-piece": "three_piece",
    "not-sure": "undecided", undecided: "undecided"
  };
  const constructionInput = clean(data.constructionType, 24);
  if (constructionInput && !constructionMap[constructionInput]) {
    return publicJson({ ok: false, error: "invalid_construction_type" }, 422);
  }
  const quantity = clean(data.quantity, 20);
  if (quantity && !["4", "5", "other"].includes(quantity)) {
    return publicJson({ ok: false, error: "invalid_quantity" }, 422);
  }

  const id = crypto.randomUUID();
  const code = referenceCode("ANV");
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO anvera_inquiries
        (id, reference_code, status, customer_name, email, phone, country, vehicle_make, vehicle_model, vehicle_year, vehicle_trim, selected_model, construction_type, wheel_diameter, wheel_width, pcd, offset, centre_bore, finish_code, quantity, project_notes, source_path)
        VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id, code, clean(data.customerName, 160), clean(data.email, 254).toLowerCase(),
          clean(data.phone, 60) || null, clean(data.country, 100) || null,
          clean(data.vehicleMake, 100), clean(data.vehicleModel, 120), year,
          clean(data.vehicleTrim, 120) || null, clean(data.selectedModel, 120) || null,
          constructionMap[constructionInput] ?? null, clean(data.wheelDiameter, 40) || null,
          clean(data.wheelWidth, 60) || null, clean(data.pcd, 60) || null,
          clean(data.offset, 40) || null, clean(data.centreBore, 40) || null,
          clean(data.finishCode, 80) || null, quantity || null,
          clean(data.projectNotes, 4000) || null, "/custom-inquiry"
        ),
      env.DB.prepare("INSERT INTO anvera_inquiry_events (id, inquiry_id, event_type) VALUES (?, ?, 'created')")
        .bind(crypto.randomUUID(), id)
    ]);
    return publicJson({ ok: true, referenceCode: code }, 201);
  } catch {
    return publicJson({ ok: false, error: "submission_failed" }, 500);
  }
};
