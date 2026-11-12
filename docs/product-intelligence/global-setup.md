# ANVERA Product Intelligence — Global Setup

Status: first implementation slice  
Feature branch: `feat/product-intelligence-global-setup`  
Production D1: three setup tables are applied by the production deployment workflow; feature flag enabled  
Preview D1: isolated schema is applied by the Product Intelligence preview workflow

## Product decision

ANVERA Product Intelligence uses one unified nine-step global configuration workflow:

1. Factory Foundation
2. Material & Forging
3. Construction & Engineering
4. Specification System
5. Finish & Customization
6. Product Definition
7. Vehicle Fitment Validation
8. Media & Content
9. Final Review & Activation

The workflow is an internal EmDash Native Plugin page. It does not alter EmDash core admin screens or public Wheels pages.

## Initial implementation boundary

The first release establishes:
- A dedicated Product Intelligence admin navigation entry.
- A nine-step, responsive Carbon-inspired configuration workspace.
- Multiple product profiles inside the same global setup document.
- Capability-constrained product construction and material selections.
- Admin-only load/save routes.
- Draft persistence with optimistic revision checks.
- Append-only activity events and immutable snapshots on submission.
- A separate feature flag, `ANVERA_PRODUCT_INTELLIGENCE_ENABLED`.

The current editor stores the working configuration as a versioned JSON document in a namespaced D1 aggregate. This is intentional for the first workflow slice: it allows the full wizard and revision lifecycle to be exercised without prematurely creating a brittle set of partially understood domain tables. The JSON document follows the field groups in this specification. Approved activation will later project validated data into normalized product, material, specification, finish and fitment records.

## Data document contract

The aggregate document has these top-level objects:

- `factory`: factory identity, country, city, website, production model and business scope.
- `material`: material family, grade, standard, source, certificate reference, forging method, equipment, heat treatment, CNC and process evidence.
- `construction`: supported construction types, structural notes, assembly, fasteners, quality and test requirements.
- `specification`: diameter and width ranges, PCD patterns, offset, center bore, load basis, disc profiles, brake clearance and restrictions.
- `finish`: standard finishes, surface processes, customization options, restrictions and approval rules.
- `products[]`: product code, name, series, construction, design style, spoke count, face profile, material/process references, intended use, description, design revision and `specifications[]`.
- Each product specification row records position (Front / Rear / Front & Rear), diameter (inch), width (inch), bolt count, PCD (mm), offset (mm), center bore (mm), optional load rating (kg), and a controlled review status.
- `fitment`: vehicle identity, variant, fitment status, evidence and engineering notes.
- `media`: hero and gallery references, rights, product story, public technical content and verified installation references.
- `review`: review notes and change summary.

Numeric technical parameters must be stored with explicit units and evidence when the normalized domain records are introduced. The initial editor uses descriptive range fields for capability discovery; it does not certify individual production combinations.

## Lifecycle and validation

Session states:
- `draft`
- `in_review`
- `approved`
- `rejected`
- `active`
- `archived`

The first slice supports draft save and submit-for-review. Approval and activation remain intentionally unavailable until the engineering review queue and normalized records are implemented.

Submission requires:
- Factory name, code and country.
- Material grade and forging method.
- At least one supported construction.
- Diameter range, width range and PCD patterns.
- At least one product profile.
- Every product has a code, name and construction.
- Every product explicitly maps to a configured material and forging process.
- Every product has at least one complete specification row; numeric values are checked server-side and offset may be negative but cannot be blank.
- Every product construction is included in the configured factory construction capabilities.
- Any selected material reference matches the configured material grade list.

Optional fitment and media information can remain pending. No missing or unverified fitment may be presented as verified.

## Persistence and audit

Tables:
- `anvera_product_setup_sessions`: current global setup aggregate and optimistic revision.
- `anvera_product_setup_versions`: immutable submitted snapshots.
- `anvera_product_setup_events`: append-only lifecycle activity.

Each save increments the revision. A stale revision is rejected rather than overwriting a newer edit. Submissions create an immutable version snapshot. No history row is updated or deleted by the editor.

## Security

- Every route is protected by the EmDash `plugins:manage` permission.
- Runtime additionally checks the verified EmDash Admin role (`role === 50`).
- The feature flag must be explicitly enabled for the environment.
- The request body is size-limited; the stored document is limited to 64 KiB.
- Actor identity is derived from the verified session, never from the request body.
- The editor does not expose public endpoints or public read access.

## Deployment and migration boundary

- The preview workflow applies `migrations/0001_product_intelligence_global_setup.sql` to the isolated `anvera-preview` D1 database.
- The production workflow applies the same idempotent migration to the production `anvera` D1 database before deploying the Worker.
- Preview and production configurations explicitly enable `ANVERA_PRODUCT_INTELLIGENCE_ENABLED`.
- `ANVERA_BUSINESS_API_ENABLED` remains disabled in production.
- The initial release does not seed product records or publish unreviewed data.
