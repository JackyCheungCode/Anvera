# ANVERA design-system refactor audit

## Design direction

- Brand expression: BMW M-inspired performance, restraint and technical precision; no BMW logos or proprietary brand assets.
- Component behavior: native IBM Carbon React components from `@carbon/react`.
- Information hierarchy: organize content with layered surfaces and backgrounds; use borders sparingly for structure.
- Primary brand action: ANVERA red. Carbon focus and interactive states retain Carbon accessibility conventions.
- Typography: IBM Plex Sans and IBM Plex Mono, with system fallbacks.
- Responsive shell: desktop navigation with an accessible Carbon mobile navigation toggle; responsive page gutters and stacked mobile actions.

## Design tokens

`src/styles/tokens.css` defines brand, semantic surface, text, border, Carbon interaction, typography, layout, spacing and motion tokens.

`src/styles/carbon.scss` loads Carbon reset, fonts, grid, layers, theme and the component styles used by the site: Button, Checkbox, FileUploader, ComboBox, InlineNotification, TextArea and TextInput.

## Shared Carbon components

| Site component | IBM Carbon component |
| --- | --- |
| `ui/Button.astro` | `Button` |
| `ui/TextInput.astro` | `TextInput` |
| `ui/Checkbox.astro` | `Checkbox` |
| `ui/Dropdown.astro` | `ComboBox` |
| `ui/TextArea.astro` | `TextArea` |
| `ui/FileUploader.astro` | `FileUploader` |
| `ui/InlineNotification.astro` | `InlineNotification` |

The React wrappers live in `src/components/carbon/Controls.tsx`.

## Page coverage

- Global AppShell: Carbon mobile navigation toggle; accessible skip link, active navigation state and Escape-to-close behavior.
- Homepage, About, Craftsmanship, Customization, Dealer Network, Vehicle Fitment, Wheel family and wheel product pages: primary and secondary calls to action use Carbon Buttons.
- Wheel catalogue: Carbon TextInput search and Carbon Button construction filters.
- Vehicle Fitment Finder: six Carbon ComboBoxes for market, make, model, year, generation and modification; existing dependent catalog loading and fitment events are preserved.
- Configuration Studio: Carbon ComboBoxes for design filters, finish, colour, delivery terms, transport and country/state/city; Carbon TextInput for delivery and contact details; Carbon Buttons for design selection, step navigation and actions. Existing delivery API calls, cascading dependencies, manual-entry fallbacks and draft persistence remain in place.
- Custom Inquiry: Carbon TextInput, ComboBox, TextArea, FileUploader and Buttons; existing inquiry payload, attachment handling and Turnstile integration are preserved.
- Dealer Application: Carbon TextInput, TextArea and Buttons; manual review and submission flow are preserved.
- Configuration Tracking: Carbon TextInput and Button; private reference/token retrieval remains unchanged.
- EmDash business workspace: Carbon Buttons, TextInputs, TextAreas and ComboBoxes across Configuration Orders, Dealer Accounts, Dealer Applications, Inquiry Inbox, Construction Capability Matrix, Material & Forging Libraries, Finish Library, Product Intelligence and Engineering Review Queue. Specification table editors use compact Carbon TextInputs; existing data tables and record workflows are preserved.

Hidden inputs used as form payload fields and honeypot fields are not user-facing controls.

## Verification

- GitHub Actions: unit tests, Astro/TypeScript checks and production build.
- Isolated preview workflow: build, Wrangler dry-run, preview D1 migrations, preview Worker deployment, configuration-order persistence smoke test and Wheel-Size catalog proxy smoke test.
- Browser Run screenshot review: mobile configuration and navigation, a 960 px tablet-width homepage, and public form/fitment page sections. The 960 px header review exposed crowded navigation; the collapse breakpoint was moved to 1024 px and the expanded mobile menu was captured.
- No production merge or deployment is performed by this branch. Production remains on `main` until the reviewed pull request is merged and the production deployment workflow succeeds.
- The branch-scoped Cloudflare Workers Builds integration is retained as a build-only check; its deploy command is a no-op because GitHub Actions owns preview and production deployment. This prevents a duplicate Wrangler preview deployment from bypassing the isolated preview configuration and its KV binding.

## Remaining QA boundary

Automated build, type checks, API smoke tests and rendered screenshots do not replace a full manual device/touch acceptance pass. Interactive state transitions should be checked on real desktop and mobile devices before treating the refactor as fully user-accepted.
