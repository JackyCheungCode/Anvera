# ANVERA CMS Editorial Operations

This is an editorial operating procedure for the EmDash collections described in `product-content-model.md`. It does not apply schema changes or write to production D1.

## Finish library

1. Create a finish with a unique `finish_code` and a concise public title.
2. Select one finish family: `paint`, `metal`, `machined`, or `special`.
3. Add a representative sample image and a six-digit hex swatch only when the colour is accurately represented by that value.
4. Set `active=true` only after the sample and description are approved.
5. Link the finish to the relevant wheel products through `available_finishes`.
6. Set `display_order` to control its position.

Inactive finishes are hidden from public product pages and are not offered for new inquiry briefs. Existing historical inquiry records must retain the finish code originally submitted.

## Fitment review lifecycle

### Status meanings

| Status | Meaning | Public display |
|---|---|---|
| `pending` | Awaiting engineering review or evidence | Never |
| `verified` | Engineering review completed and approved | Yes, on linked published products |
| `retired` | Previously reviewed record withdrawn or superseded | Never |

### Required review before verification

- Confirm vehicle make, model and exact model-year range.
- Confirm wheel diameter and width for front and rear axles.
- Confirm PCD, offset and centre bore.
- Review brake package / caliper clearance and any vehicle-specific constraints.
- Confirm product references point to the correct wheel designs.
- Record the evidence and any limitations in `verification_note`.
- Set `verified_at` only when the engineering review is complete.
- Change `verification_status` to `verified` only after all required checks pass.

If a customer vehicle has modifications or a non-standard brake package, do not treat a model-level fitment as a guarantee. Request a vehicle-specific review.

### Changes after verification

- Any change to a technical specification returns the record to `pending` until reviewed again.
- Use `retired` when a record is no longer valid; do not silently overwrite its historical meaning.
- Create a new record for materially different model years, brake packages or wheel specifications.
- Never mark a fitment verified based solely on a customer inquiry, competitor listing, marketing copy or unverified online source.

## Product publishing checklist

- [ ] Product title and unique model code approved.
- [ ] Construction type and short description reviewed.
- [ ] Hero image and gallery images are actual approved ANVERA product photography.
- [ ] Every informative image has meaningful alt text.
- [ ] Available finishes are linked and active.
- [ ] Technical disclaimer is present where required.
- [ ] Fitment records are linked only when relevant; public display is restricted to verified records.
- [ ] Product page preview reviewed on desktop and mobile.
- [ ] Custom inquiry CTA points to the correct model code.

## Safety boundary

The public site reads published EmDash records only. Public templates must never expose internal verification notes, pending records, retired records, unpublished finishes, supplier details or other editorial-only data. No schema or production database changes are authorized by this document.
