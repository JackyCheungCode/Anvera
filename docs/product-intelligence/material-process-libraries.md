# Product Intelligence — Material and Forging Process Libraries

Status: implementation phase 2; preview-only schema in this release.

## Purpose

The global Product Intelligence wizard now contains reusable Material Profiles and Forging Process records inside step 02 (Material & Forging). These are managed within the existing unified workflow; they are not a separate workspace or a new top-level navigation area.

## Material profile fields

- Code (unique, case-insensitive)
- Display name
- Material family
- Exact material grade
- Standard and revision
- Supplier / source
- Certificate reference
- Evidence notes
- Lifecycle status and revision

## Forging process fields

- Code (unique, case-insensitive)
- Process name and process type
- Equipment / model
- Capacity and working-range notes
- Heat-treatment description
- CNC capability and limitations
- Evidence reference
- Lifecycle status and revision

## Lifecycle and controls

- New records begin as Draft.
- Records can be submitted for Engineering Review.
- Records can be submitted to the integrated Engineering Review Queue. Only the reviewer decision flow can mark records approved or restricted; those records are read-only in the library editor.
- Every create or update appends a library event with actor, revision and event type.
- Updates use optimistic revision checks to prevent overwriting another editor's changes.
- Restricted and archived records are excluded from the product capability option lists.
- Product Intelligence's existing global setup fields remain available as a compatibility fallback when the library migration is not installed.

## Storage

Preview migration: `migrations/0002_product_intelligence_material_process_library.sql`

Tables:
- `anvera_pi_material_profiles`
- `anvera_pi_forging_processes`
- `anvera_pi_library_events`

The new migration is applied only to the isolated Preview D1 database in this implementation phase. Production continues using the first three Product Intelligence setup tables; production migration of the normalized libraries requires a separate explicit approval.

The integrated review queue records the review decision and reviewer note, but does not independently validate the underlying certificate or test evidence. No record created here should be presented as a certified material, process or manufacturing claim.

## Engineering review

The final Review & Activation step includes a Material & Forging Review Queue:
- Approve: changes the record to `approved` and locks direct edits.
- Return for revision: returns the record to `draft` so the owner can revise and resubmit.
- Restrict: marks the record `restricted` and removes it from product capability options.
- Every decision is recorded in the append-only `anvera_pi_library_review_decisions` table with reviewer identity, note and before/after revisions.

Review migration: `migrations/0003_product_intelligence_library_reviews.sql` (Preview only).
