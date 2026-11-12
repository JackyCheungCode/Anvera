import type { APIRoute } from "astro";
import { acceptPublicSubmission, clean, publicJson, referenceCode } from "../../lib/public-business-api";
import { detectAttachmentExtension } from "../../lib/attachment-validation.js";

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

  const uploads: Array<{ file: File; mime: string; extension: string; bytes: ArrayBuffer }> = [];
  for (const file of accepted.files) {
    const mime = file.type.toLowerCase();
    const bytes = await file.arrayBuffer();
    const extension = detectAttachmentExtension(mime, new Uint8Array(bytes));
    if (!extension) return publicJson({ ok: false, error: "attachment_content_mismatch" }, 415);
    uploads.push({ file, mime, extension, bytes });
  }

  const id = crypto.randomUUID();
  const code = referenceCode("ANV");
  const uploadedKeys: string[] = [];
  try {
    const statements = [
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
    ];
    for (const upload of uploads) {
      const attachmentId = crypto.randomUUID();
      const key = "private/inquiries/" + id + "/" + attachmentId + "." + upload.extension;
      const safeName = upload.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || ("attachment." + upload.extension);
      const object = await env.MEDIA!.put(key, upload.bytes, {
        httpMetadata: { contentType: upload.mime, contentDisposition: "attachment; filename=\"" + safeName + "\"" },
        customMetadata: { inquiryId: id, attachmentId }
      });
      if (!object) throw new Error("r2_upload_failed");
      uploadedKeys.push(key);
      statements.push(
        env.DB.prepare("INSERT INTO anvera_inquiry_attachments (id, inquiry_id, r2_object_key, original_filename, content_type, byte_size) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(attachmentId, id, key, safeName, upload.mime, upload.bytes.byteLength),
        env.DB.prepare("INSERT INTO anvera_inquiry_events (id, inquiry_id, event_type, note) VALUES (?, ?, 'attachment_added', ?)")
          .bind(crypto.randomUUID(), id, safeName)
      );
    }
    await env.DB.batch(statements);
    return publicJson({ ok: true, referenceCode: code, attachmentCount: uploads.length }, 201);
  } catch {
    if (uploadedKeys.length) await env.MEDIA?.delete(uploadedKeys).catch(() => undefined);
    return publicJson({ ok: false, error: "submission_failed" }, 500);
  }
};
