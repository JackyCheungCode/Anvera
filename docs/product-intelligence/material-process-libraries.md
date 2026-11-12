# Product Intelligence — Material and Forging Process Libraries

Status: implementation phase 3; normalized reference data and specification schema are included in the production deployment sequence.

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

Migrations 0002–0007 are applied in order by the Preview and Production deployment workflows. The deployment does not seed sample records or auto-approve any capability.

The integrated review queue records the review decision and reviewer note, but does not independently validate the underlying certificate or test evidence. No record created here should be presented as a certified material, process or manufacturing claim.

## Engineering review

The final Review & Activation step includes a Material & Forging Review Queue:
- Approve: changes the record to `approved` and locks direct edits.
- Return for revision: returns the record to `draft` so the owner can revise and resubmit.
- Restrict: marks the record `restricted` and removes it from product capability options.
- Every decision is recorded in the append-only `anvera_pi_library_review_decisions` table with reviewer identity, note and before/after revisions.

Review migration: `migrations/0003_product_intelligence_library_reviews.sql`; the entity constraint is extended by migrations 0006 and 0007.

## Finish Library and product mappings

The Finish & Customization step now includes a controlled Finish Library with:
- Finish code, name and process type
- Process description and appearance reference
- Explicit supported constructions (Monoblock / Two-piece / Three-piece)
- Restrictions and evidence reference
- Draft, pending review, approved, restricted and archived lifecycle

Only approved finish profiles compatible with the selected product construction appear in the Product Definition finish mapper. Product-to-finish associations are stored in `anvera_pi_product_finish_mappings`, begin as `pending_review`, and are synchronized with the global setup draft. Removed associations become `superseded`; re-added associations return to review.

The engineering review queue now includes finish profiles and product finish mappings. A mapping decision is recorded with reviewer identity, note and before/after revision in `anvera_pi_library_review_decisions`; mapping changes also append to `anvera_pi_finish_events`.

Migration: `migrations/0004_product_intelligence_finish_library.sql`.

## Product capability references

Product Definition now stores the selected approved Material Profile ID and Forging Process ID, not just free-text grade or process labels. The server validates those references against approved library records before a global setup can be submitted. In environments where the normalized library migration is not installed, the existing legacy text fields remain the compatibility path.

Product finish mappings are separately stored and reviewed. Selecting an approved finish does not automatically approve the product mapping.

## Construction capability matrix

The Construction & Engineering step now manages one governed capability record for each construction architecture:
- Monoblock
- Two-piece
- Three-piece

Each record captures capability scope, assembly method, fastener requirements, quality processes, structural limitations and evidence reference. Records must pass engineering review before they become selectable by product profiles.

Product Definition uses the approved construction matrix when the normalized schema is installed. The server rechecks construction approval before a global setup can be submitted. The previous free-text construction list remains a compatibility fallback only when the normalized migration is absent.

Migration: `migrations/0005_product_intelligence_construction_capabilities.sql`.

Constraint upgrade: `migrations/0006_product_intelligence_review_mapping_constraint_upgrade.sql` rebuilds the append-only review decision and product finish mapping tables to extend their allowed entity/status values. It copies existing rows before replacing the tables and is designed to be repeatable when Preview deployment reapplies the migration set.

## Wheel specification system

Product Definition supports multiple exact specification rows per product, including different Front and Rear combinations:
- Position: Front, Rear, or Front & Rear
- Diameter and width (inches)
- Bolt count and PCD (mm)
- Offset (mm)
- Center bore (mm)
- Load rating (kg)
- Evidence reference (drawing, test report or controlled document ID)

Rows are synchronized into `anvera_pi_wheel_specifications`. Updates increment the revision; removed or renamed rows are retained as `superseded` records rather than deleted. The specification record keeps its own lifecycle: Draft, Factory Supported, Pending Engineering Review, Approved, Restricted or Superseded.

Product editors may save Draft, Factory Supported or Engineering Review. They cannot directly mark a row Engineering Approved or Restricted. Those decisions are made only through the Engineering Review Queue and are appended to `anvera_pi_library_review_decisions`. Approval requires both a positive load rating and an evidence reference. A changed approved specification loses its approval and must be reviewed again.

Only Engineering Approved specifications may be treated as eligible inputs to vehicle-fitment validation. Approval does not itself prove a vehicle fitment; each vehicle application still requires separate validation and evidence.

Migration: `migrations/0007_product_intelligence_wheel_specifications.sql`.
