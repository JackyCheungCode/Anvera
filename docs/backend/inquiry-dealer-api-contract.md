# ANVERA Inquiry & Dealer Backend — API Contract

Status: **private EmDash admin routes, workbench interactions, and public intake routes are implemented on the development branch. Public intake remains fail-closed until the D1 schema is approved/applied and Turnstile plus edge rate limiting are configured. No production database changes have been made.**

## Scope

This contract covers the first secure server-side workflow for:
- Customer wheel project inquiries.
- Dealer applications and administrator review.
- Dealer activation linked to an existing EmDash identity.
- Append-only business event history.
- R2 attachment metadata.

It deliberately does not create EmDash users, change EmDash core tables, send email, or run migrations.

## Public endpoints

### `POST /api/inquiries`

Accepts JSON without files or multipart form data with repeated `attachments` fields from the custom wheel inquiry form.

Required:
- `customerName`
- `email`
- `vehicleMake`
- `vehicleModel`

Optional:
- `phone`, `country`, `vehicleYear`, `vehicleTrim`
- `selectedModel`, `constructionType`
- `wheelDiameter`, `wheelWidth`, `pcd`, `offset`, `centreBore`
- `finishCode`, `quantity`, `projectNotes`
- `website` (honeypot; any non-empty value is silently discarded with a generic accepted response)
- `turnstileToken` (required for successful server verification)

Success: `201 { ok: true, referenceCode, attachmentCount }` (attachmentCount is zero when no files are attached).

Validation: reject malformed bodies, invalid email, oversized request bodies, invalid year/quantity, unsupported enum values and non-empty honeypot; string fields are normalized and capped before persistence. Multipart files are limited to five, 8 MiB each and 20 MiB total. Normalize whitespace; never trust client-provided status, timestamps, assignment, actor IDs or R2 keys.

### `POST /api/dealer-applications`

Accepts JSON from the dealer application form.

Required:
- `legalCompanyName`
- `businessType`
- `country`
- `contactName`
- `email`

Optional:
- `tradingName`, `companyWebsite`, `city`, `yearsInBusiness`
- `turnstileToken` (required for successful server verification)
- `representedBrands`, `contactRole`, `phone`, `notes`
- The visible company website is submitted as `companyWebsite`; the separate hidden `website` field is the honeypot.

Success: `201 { ok: true, referenceCode }`. New applications always enter `pending`; public callers cannot approve, reject or activate an application.

## Public route implementation

Implemented Astro server endpoints:
- POST /api/inquiries: validates customer and vehicle fields, maps form values to the D1 schema, verifies Turnstile, and creates the inquiry plus its initial created event in one D1 batch.
- POST /api/dealer-applications: validates company/contact fields, verifies Turnstile and creates a pending application. It does not create a dealer identity.

Both endpoints enforce same-origin browser requests, accepted content types, request-body limits, field length limits, basic email validation and a honeypot. Inquiry multipart requests allow up to 22 MiB; JSON and dealer application requests are limited to 12 KiB. The server requires ANVERA_BUSINESS_API_ENABLED=true and TURNSTILE_SECRET_KEY; absent bindings fail closed. The public forms now POST to these endpoints and display a reference code only after a successful response.

The public Turnstile widget also requires PUBLIC_TURNSTILE_SITE_KEY at build time. Configure the public site key and Worker secret in the preview environment before testing.

The Worker Rate Limiting API binding is configured in Wrangler and enforced by the public endpoint helper. It allows five requests per 60 seconds for each endpoint, keyed separately by hashed client IP and normalized email. Cloudflare documents these limits as approximate and local to each edge location, so this is not a strict global quota; Turnstile remains required.

## Inquiry attachments

The inquiry endpoint accepts either JSON (without files) or multipart form data. Multipart uploads use the repeated `attachments` field and are limited to five files, 8 MiB per file, and 20 MiB total. Accepted formats are PDF, JPEG, PNG and WebP; the handler checks the file signature rather than trusting the browser-provided MIME type.

Objects are written to the private `MEDIA` R2 binding under `private/inquiries/{inquiryId}/...`. The D1 attachment metadata and `attachment_added` timeline events are committed in the same D1 batch as the inquiry. If the D1 batch fails, uploaded R2 objects are deleted as compensation. Objects are never served from a public URL; a separately authenticated admin download route is still required before staff can retrieve them from the workbench.

## Administrator-only operations

All review and activation endpoints must:
1. Validate the EmDash session server-side.
2. Require the EmDash Admin role; do not rely on hidden navigation or client state.
3. Derive actor identity from the verified session, never from request JSON.
4. Validate state transitions on the server.
5. Write the business record and corresponding event in one D1 batch/transaction.
6. Return no internal review notes or other applicants' personal data to public callers.

Allowed application transitions:
- `pending -> reviewing`
- `reviewing -> approved`
- `reviewing -> rejected`
- `pending/reviewing -> withdrawn`

Dealer activation is a separate explicit admin action after approval. It links an already-existing EmDash user ID to the dealer record; it does not create an identity or grant access by itself. Every Dealer API must independently verify both the authenticated EmDash user and an active `anvera_dealers` row for that same user ID.


## EmDash Native Plugin routes

The business workbench uses authenticated private plugin routes under
`/_emdash/api/plugins/anvera-business/`. All routes require the EmDash
`plugins:manage` permission; handlers also require the authenticated caller's
role level to equal Admin (50).

Implemented read routes:
- `GET inquiries/list`: bounded pagination, optional status and text search.
- `GET inquiries/detail?id=...`: inquiry fields, append-only event timeline and attachment metadata.
- `GET dealer-applications/list`: bounded pagination, optional status and text search.
- `GET dealers/list`: bounded pagination, optional status and text search.

The read routes are guarded by the Worker binding
`ANVERA_BUSINESS_API_ENABLED=true`. The default is disabled. They return an
explicit unavailable state until the approved D1 migration is applied and the
feature flag is deliberately enabled. They do not create, update, or delete
records.

Implemented administrator write routes:
- `POST inquiries/update`: validates the inquiry state transition and appends a status event in the same D1 batch.
- `POST inquiries/note`: appends an internal note event for an existing inquiry.
- `POST dealer-applications/review`: validates the application transition, records reviewer identity and appends an audit event in the same D1 batch.
- `POST dealers/activate`: links an approved application to an existing EmDash Subscriber identity (role 10); it never creates or promotes a user.
- `POST dealers/suspend`: suspends an active dealer and appends an audit event in the same D1 batch.

All write routes are private, require `plugins:manage`, re-check the Admin
role server-side, and accept bounded JSON request bodies. The runtime also
requires `ANVERA_BUSINESS_API_ENABLED=true`; the binding is unset by default.
The admin workbench pages now call these read and write routes for inquiry details/status/notes, application review/activation, and dealer suspension. These controls remain unavailable until the approved schema is applied and the Worker feature flag is explicitly enabled.

The schema draft includes `anvera_dealer_application_events` so dealer
application review decisions have an append-only audit trail. This is an
additional table in the draft only; it has not been applied to production.

## Security and abuse controls

- Server-side schema validation and strict request-body size limits.
- Honeypot plus Cloudflare Turnstile Siteverify before accepting public submissions.
- The Worker `PUBLIC_INTAKE_LIMITER` binding applies five requests per 60 seconds per endpoint, per hashed client IP and normalized email. Cloudflare's Worker Rate Limiting API is approximate and location-local, not a strict global quota; keep Turnstile enabled and treat this as a defence-in-depth control. Missing or failing rate-limit bindings fail closed.
- Same-origin checks for browser form posts; CORS disabled unless a documented integration requires it.
- No public read endpoint for inquiries, applications, dealer records or event logs.
- Store uploads in R2 under generated opaque object keys; never accept caller-selected object keys.
- Enforce MIME allowlist, file-size limits and authorization before issuing upload/download URLs.
- Escape user content on every admin render; do not interpret notes as HTML.
- Keep secrets in Worker bindings, never in source or client bundles.

## Persistence model

The companion `inquiry-dealer-schema-draft.sql` proposes namespaced `anvera_*` tables. EmDash-owned tables remain untouched. The SQL is review material only and has not been run.

## Delivery dependencies

Before enabling the endpoints:
1. Review and approve the exact D1 schema and migration plan.
2. Configure Turnstile site/secret keys as Worker secrets.
3. Configure Cloudflare edge rate limiting for both public POST routes and test the thresholds.
4. Confirm the exact EmDash server-side session and role-verification API for the installed 1.5.0 version.
5. Select an email provider for acknowledgement and internal notifications.
6. Add integration tests against a disposable D1 database and R2 test bucket.
7. Only after those checks, enable the API feature flag and deploy to a non-production preview first.

## Current UI behavior

The public inquiry and dealer application forms POST to the new server endpoints and show a reference code only after a successful database write. Turnstile Siteverify is implemented server-side. The endpoints remain unavailable while the feature flag is unset. Private R2 attachment upload and Worker-level per-IP/email rate limiting are implemented for inquiry submissions; authenticated staff download and email notifications are not yet implemented.

The private administrator workbench is wired to the plugin route contracts in source, but D1-backed operations are feature-flagged off by default. A successful CI build does not mean these routes have been exercised against a migrated database.
