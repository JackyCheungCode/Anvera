# ANVERA Business Workbench — Screen and Interaction Specification

This specification is for the custom React admin pages contributed by the ANVERA Native Plugin. It does not modify EmDash core admin screens.

## Visual system

- IBM Carbon-inspired controls and interaction patterns.
- Use background layers to organize sections; use borders sparingly.
- No browser-native select controls. Use controlled Carbon-style select/combobox components.
- Dense data tables: fixed row heights, one-line cells, horizontal scrolling rather than wrapping.
- Clear, persistent task/status feedback; status updates must show pending, success and failure states.
- Destructive or access-changing actions require a confirmation step.
- Responsive detail layouts: side panel on wide screens; stacked detail page on narrow screens.
- Accessible labels, keyboard focus, visible focus ring, semantic status text and adequate contrast.

## 1. Inquiry Inbox

### Queue header
- Page title: Inquiry Inbox.
- Summary metrics: New, In Review, Quoted, Won.
- Primary filter row: status, received date, country/market.
- Search accepts reference code, customer email, customer name, vehicle make/model.
- Filters and search are server-side; pagination uses stable cursors.

### Table columns
- Reference
- Received
- Customer
- Vehicle
- Requested wheel setup
- Market
- Status
- Assigned to

Table requirements:
- Single-line cells with ellipsis and accessible full-value title.
- Equal row heights.
- Horizontal scroll on smaller widths.
- Sortable received date and status.
- Empty state, loading state, retry state and no-results state.

### Inquiry detail
- Customer contact and consent information.
- Vehicle details.
- Selected ANVERA model and construction type.
- Diameter, width, PCD, offset, centre bore, finish and quantity.
- Customer project notes.
- Attachments with safe download authorization.
- Internal notes and append-only event timeline.
- Status action with allowed transitions only.
- Assignment action uses verified EmDash Admin identities.

### Status lifecycle
- new -> in_review -> quoted -> won
- new/in_review/quoted -> closed
- new -> spam

A transition outside this set is rejected server-side. Reopening closed/spam records requires a separately specified administrator action and an audit event.

## 2. Dealer Applications

### Queue columns
- Application reference
- Submitted
- Company
- Country / city
- Contact
- Business type
- Years in business
- Status

### Review detail
- Legal company and trading name.
- Website and represented brands.
- Country, city and regional coverage.
- Contact name, role, email and phone.
- Business profile and submitted notes.
- Internal review notes.
- Review history and timestamps.

### Review actions
- Start review: pending -> reviewing.
- Approve: reviewing -> approved.
- Reject: reviewing -> rejected.
- Withdraw: pending/reviewing -> withdrawn.
- Every decision requires an audit event.
- Approval never automatically creates a user or activates dealer access.

## 3. Dealer Accounts

### Account list
- Company
- Country
- Linked EmDash identity
- Activated date
- Current state

### Activation
1. Select an approved application.
2. Search/select an existing EmDash user through an administrator-only identity lookup.
3. Review the company and identity pairing.
4. Confirm activation.
5. Create the dealer business record and event atomically.
6. Dealer access becomes available only when the server verifies the active account link.

No user creation, password reset or role elevation is performed by this page.

### Suspension
- Require a reason.
- Confirm the action.
- Change status to suspended and write an event atomically.
- All dealer APIs deny access immediately after the status check.

## Shared interaction states

Every data operation must have:
- Initial loading skeleton.
- Disabled action while submitting.
- Success notification only after the server confirms persistence.
- Inline field validation for invalid forms.
- Recoverable error message and retry where safe.
- Stale-data warning when an update conflicts with a newer record version.
- No optimistic UI for approval, activation, suspension, quote delivery or other security-sensitive actions.

## Explicitly out of scope for first release

- Automatic dealer account creation.
- Dealer self-service account management.
- Multi-user role hierarchy beyond EmDash Admin and dealer identity.
- Quote generation and PDF delivery.
- Automated outbound email until a provider is selected.
- Public inquiry tracking portal.
- AI-based application scoring or automatic approval.
