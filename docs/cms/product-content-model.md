# ANVERA Product CMS — Content Model Draft

Status: **design draft only — not applied to the production D1 database**

This document defines the first product-catalog model for the EmDash 1.5.0 admin. The schema is intentionally kept outside `seed/seed.json` until the production migration plan is reviewed and explicitly approved. Do not run `emdash seed`, schema API writes, or D1 migrations from this draft.

## Operating principles

- EmDash owns editorial product records and media metadata; Cloudflare R2 stores the actual media objects.
- Astro reads only published records at request time. Drafts remain private to the CMS.
- A wheel design is a product record; construction family is a controlled attribute, not a hard-coded product catalogue.
- Finishes and fitment records are separate reusable records, related to products through EmDash references.
- No public prices, cart, checkout, payment, or inventory promises. The commercial CTA is a custom inquiry.
- Technical values are informational until reviewed and approved by ANVERA. Never infer fitment compatibility from a marketing description.
- Preserve EmDash core tables and current production content. Any schema change is a separately reviewed migration.

## Collections

### 1. `wheel_products` — Wheel designs

| Field slug | Type | Required | Purpose |
|---|---|---:|---|
| `title` | string | yes | Public product/design name |
| `model_code` | string | yes | Unique internal model identifier |
| `construction_type` | select | yes | `monoblock`, `two_piece`, `three_piece` |
| `short_description` | text | yes | Catalogue card copy |
| `design_story` | portableText | no | Product detail narrative |
| `hero_image` | image | no | Main product image |
| `gallery_images` | repeater | no | Ordered image set with alt text and caption |
| `available_finishes` | reference (many) | no | References to `wheel_finishes` |
| `featured` | boolean | no | Featured placement |
| `display_order` | integer | no | Explicit catalogue order |
| `technical_disclaimer` | text | no | Product-specific qualification |

Collection behavior: drafts, revisions, preview, SEO, search. Public route: `/wheels/models/{slug}`.

### 2. `wheel_finishes` — Finish library

| Field slug | Type | Required | Purpose |
|---|---|---:|---|
| `title` | string | yes | Finish display name |
| `finish_code` | string | yes | Unique internal finish code |
| `finish_family` | select | yes | `paint`, `metal`, `machined`, `special` |
| `finish_description` | text | no | Appearance and care notes |
| `swatch_hex` | string | no | UI swatch only; validate as a six-digit hex value |
| `sample_image` | image | no | Approved finish reference image |
| `active` | boolean | no | Whether it may be selected for new inquiries |
| `display_order` | integer | no | Stable display order |

### 3. `wheel_fitments` — Verified fitment records

| Field slug | Type | Required | Purpose |
|---|---|---:|---|
| `title` | string | yes | Human-readable fitment label |
| `vehicle_make` | string | yes | Vehicle make |
| `vehicle_model` | string | yes | Vehicle model |
| `model_year_from` | integer | no | First verified model year |
| `model_year_to` | integer | no | Last verified model year |
| `front_spec` | json | no | Front diameter, width, PCD, offset, centre bore |
| `rear_spec` | json | no | Rear diameter, width, PCD, offset, centre bore |
| `products` | reference (many) | no | Applicable wheel designs |
| `verification_status` | select | yes | `pending`, `verified`, `retired` |
| `verification_note` | text | no | Evidence, brake clearance and review notes |
| `verified_at` | datetime | no | Last engineering verification date |

Only records with `verification_status=verified` may be described publicly as verified fitments. A customer inquiry is not a compatibility confirmation.

## Editorial workflow

1. Create or update a wheel product in EmDash.
2. Attach approved hero/gallery media from the EmDash media library (R2-backed).
3. Link applicable active finishes.
4. Add fitment records only after engineering review.
5. Preview the product page.
6. Publish when imagery, copy, model code and disclosures have passed review.

## Media conventions

- Hero image: landscape 16:9, high-resolution master, with a deliberate crop-safe focal point.
- Product detail images: consistent angles and lighting; no AI-generated image presented as a real manufactured wheel.
- Every image requires meaningful alt text. Decorative renders use empty alt text only when implemented as CSS.
- Keep original masters in R2; public delivery should use responsive image transformations where supported.

## Query and publication contract

- Public catalogue queries: `getEmDashCollection("wheel_products", { status: "published" })`.
- Product detail lookup: `getEmDashEntry("wheel_products", slug)`.
- Do not expose draft, pending-fitment, unpublished finish, dealer-only, or internal notes on public routes.
- Public product pages omit pricing and route all commercial actions to the custom inquiry workflow.

## Migration gate

Before any production application:
1. Inspect current D1 schema and EmDash schema state again.
2. Confirm collection slugs and field slugs are unused.
3. Review a generated schema diff and exact SQL operations.
4. Back up the production D1 database.
5. Obtain explicit user approval for the exact migration plan.
6. Apply once, verify row counts and admin editing, then test published content rendering.

This draft alone does not create tables, fields, or content in any database.
