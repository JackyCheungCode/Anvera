# ANVERA Inquiry & Dealer Backend — API Contract

Status: **implementation contract draft; no endpoints are enabled and no production database changes have been made.**

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

Accepts JSON from the custom wheel inquiry form.

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
- `website` (honeypot; any non-empty value is rejected)

Success: `201 { ok: true, referenceCode }`.

Validation: reject malformed JSON, invalid email, oversized strings, invalid year/quantity, unsupported enum values and non-empty honeypot. Normalize whitespace; never trust client-provided status, timestamps, assignment, actor IDs or R2 keys.

### `POST /api/dealer-applications`

Accepts JSON from the dealer application form.

Required:
- `legalCompanyName`
- `businessType`
- `country`
- `contactName`
- `email`

Optional:
- `tradingName`, `website`, `city`, `yearsInBusiness`
- `representedBrands`, `contactRole`, `phone`, `notes`
- `website` is also the honeypot field only if a separate hidden field is used; do not reuse the visible company website field as a honeypot.

Success: `201 { ok: true, referenceCode }`. New applications always enter `pending`; public callers cannot approve, reject or activate an application.

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

Planned administrator write routes:
- `POST inquiries/update`: validate the inquiry state transition and append a status event atomically.
- `POST inquiries/note`: append an internal note event.
- `POST dealer-applications/review`: validate the application transition, record reviewer identity and append an audit event atomically.
- `POST dealers/activate`: link an approved application to an existing EmDash Subscriber identity; never create or promote a user.
- `POST dealers/suspend`: suspend an active dealer and append an audit event atomically.

The schema draft includes `anvera_dealer_application_events` so dealer
application review decisions have an append-only audit trail. This is an
additional table in the draft only; it has not been applied to production.

## Security and abuse controls

- Server-side schema validation and strict request-body size limits.
- Honeypot plus Cloudflare Turnstile Siteverify before accepting public submissions.
- Rate limiting by privacy-preserving IP digest and normalized email; do not store raw IP addresses.
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
3. Confirm the exact EmDash server-side session and role-verification API for the installed 1.5.0 version.
4. Select an email provider for acknowledgement and internal notifications.
5. Add integration tests against a disposable D1 database and R2 test bucket.
6. Only after those checks, enable the API feature flag and deploy to a non-production preview first.

## Current UI behavior

The inquiry and dealer forms remain local-copy previews until the secure endpoints and required database tables are approved and enabled. Do not display a success state implying a submission was stored or received.
