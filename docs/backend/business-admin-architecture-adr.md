# ADR: ANVERA Business Admin Extension

- Status: Proposed for implementation
- Date: 2026-11-12
- Scope: Inquiry inbox, dealer application review, dealer account operations
- Production impact: None. This decision does not authorize D1 migrations, seed changes, or deployment.

## Decision

Build ANVERA's business workbench as a **trusted EmDash Native Plugin with custom React admin pages**, while keeping the EmDash core admin unchanged.

The public website remains Astro. Public inquiry and dealer application submissions will use narrowly scoped Astro API routes. The business workbench will be exposed inside EmDash admin through the plugin's declared admin pages and private routes.

## Why Native, not sandboxed Block Kit

EmDash supports sandboxed plugins with declarative Block Kit pages and native plugins with custom React admin components. Block Kit provides tables, forms, stats, actions and other useful primitives, but it does not give ANVERA full control over the React component layer and visual system.

ANVERA's business screens need a consistent IBM Carbon-inspired interaction language, including dense work queues, controlled status actions, detail panels, review forms and responsive layouts. A Native Plugin is the documented extension point for custom React admin components. This is preferred over editing EmDash core files.

Native plugins run in the host process and do not have an isolation boundary. This is a deliberate trust trade-off: keep the plugin small, review every permission-sensitive route, avoid dynamic code, and test all authorization paths. Do not add unrelated third-party runtime dependencies.

## Planned admin navigation

The EmDash core admin remains unchanged. The plugin contributes one grouped navigation area, **ANVERA Business**, with these pages:

1. **Inquiry Inbox**
   - Queue counts: New, In Review, Quoted, Won, Closed.
   - Search by reference, customer email and vehicle.
   - Filters by status, date and market.
   - Strictly aligned, non-wrapping table rows with horizontal overflow on narrow viewports.
   - Detail view with customer contact, vehicle, requested specification, selected model and attachments.
   - Status transition, internal note and assignment actions.
   - Append-only event timeline.

2. **Dealer Applications**
   - Pending/reviewing/approved/rejected/withdrawn queue.
   - Company, country, contact and experience summary.
   - Detail review, internal decision note and request-for-information workflow.
   - Approval does not itself activate access.

3. **Dealer Accounts**
   - Active/suspended/closed accounts.
   - Link an approved application to an existing EmDash user identity.
   - Explicit activation and suspension actions with confirmation.
   - Display linked EmDash user ID only to authorized administrators.
   - Every dealer-facing route must verify the current EmDash user and an active dealer row on the server.

## Data ownership

- Keep business records in the namespaced `anvera_*` D1 tables proposed in `inquiry-dealer-schema-draft.sql`.
- Do not modify EmDash-owned tables.
- Do not create or grant EmDash identities from a public application endpoint.
- Store attachment bytes in R2; D1 stores opaque object keys and metadata.
- Every state change and internal note writes an event in the same D1 transaction/batch as the parent record update.
- Public endpoints cannot read business records or event history.

## Authorization

- Public submission routes: no authenticated session required; strict validation, request-size limits, Turnstile verification and rate limits required.
- Admin pages and all mutating plugin routes: require a server-verified EmDash Admin session.
- Actor IDs come only from the verified session.
- Dealer portal routes: require both a verified EmDash session and a matching active `anvera_dealers.emdash_user_id` row.
- Hiding a menu item is never an authorization control.
- Validate state transitions on the server; never trust submitted status, role, actor ID, timestamps, or R2 object keys.

## API boundaries

Public Astro routes:
- `POST /api/inquiries`
- `POST /api/dealer-applications`

Admin plugin routes (private, authenticated):
- `inquiries-list`
- `inquiry-detail`
- `inquiry-update`
- `inquiry-add-note`
- `dealer-applications-list`
- `dealer-application-detail`
- `dealer-application-review`
- `dealer-activate`
- `dealer-suspend`

Names above are logical route identifiers, not deployed endpoints. Final route schemas and exact EmDash session APIs must be verified against the installed EmDash version before implementation.

## Dependency and version gate

The repository currently declares `emdash: ^1.3.0` and `@emdash-cms/cloudflare: ^1.3.0`, while the project architecture notes refer to EmDash 1.5.0. The repository tree currently has no committed pnpm lockfile. Do not assume the resolved production package version from the semver range.

Before scaffolding the plugin:
1. Resolve and record the exact EmDash and Cloudflare adapter versions used by CI.
2. Confirm that the installed version exposes the current Native Plugin API, custom React admin entry, and native route context.
3. Pin the tested dependency graph with the repository's package manager lockfile.
4. Verify the exact server-side session and Admin-role API from the installed package source/types.
5. Add tests for anonymous, non-admin, admin and dealer-session access.

Do not blindly upgrade packages or regenerate production schema as part of this ADR.

## Migration and deployment gate

The SQL schema remains a draft. A separate migration plan must include:
- Exact CREATE TABLE statements and indexes.
- Backup/restore and rollback procedure.
- Verification queries and expected row counts.
- Staging test evidence.
- Production change window and explicit approval.

No production D1 write, migration, seed update, main-branch write, PR merge or Worker deployment is authorized by this ADR.
