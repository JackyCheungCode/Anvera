# ANVERA site-wide IBM Carbon control audit

Audit branch: `fix/sitewide-carbon-native-controls`.
Production baseline: `main` (unchanged until PR #35 is merged).

## Required control policy

Every visible interactive control must be an IBM Carbon React component from `@carbon/react`. Astro components may mount and hydrate Carbon React controls. Semantic HTML form containers, links, and hidden state/anti-spam fields are not visible UI controls and are permitted. CSS may provide ANVERA brand tokens, layout, sizing, and theme integration, but must not recreate Carbon interaction or popup behavior.

## Verified route inventory

The following routes were inspected in the implementation branch. Their visible buttons, text fields, text areas, uploads, checkboxes, and dropdown/combobox controls are rendered through Carbon React components, either directly or through the shared Astro wrappers.

| Route / source | Verified implementation |
|---|---|
| `src/pages/index.astro`, `about.astro`, `craftsmanship.astro`, `customization.astro` | Shared Carbon Button wrapper |
| `src/pages/custom-inquiry.astro` | Carbon Button, TextInput, TextArea, FileUploader and Dropdown wrappers; semantic form; hidden honeypot field only |
| `src/pages/dealers/apply.astro` | Carbon Button, TextInput and TextArea wrappers; semantic form; hidden honeypot field only |
| `src/pages/dealers/index.astro` | Shared Carbon Button wrapper |
| `src/pages/configuration/track.astro` | Carbon Button and Carbon TextInput wrapper; semantic form |
| `src/pages/configure.astro` | Carbon Button, TextInput, TextArea and FileUploader wrappers; all design, finish, shipping and cascading country/region/city selectors mount Carbon ComboBox through React; hidden inputs are value/state bridges |
| `src/components/VehicleFitmentFinder.astro` | Carbon ComboBox for region, manufacturer, model, year and trim; Carbon ComboBox filters; Carbon Button for fitment selection; manufacturer logo assets rendered in option and selected states |
| `src/layouts/Base.astro` | Shared Carbon Button wrapper for responsive navigation toggle |
| `src/pages/vehicle-fitment.astro`, `src/pages/wheels/index.astro`, `src/pages/wheels/[slug].astro`, `src/pages/wheels/models/[slug].astro` | Shared Carbon Button wrapper; wheels page search uses shared Carbon TextInput |
| `src/pages/contact.astro`, `gallery.astro`, `404.astro`, `[slug].astro`, `category/[slug].astro`, `posts/*`, `tag/[slug].astro` | No unwrapped native form controls found; inherited navigation uses Carbon Button |
| `src/plugins/anvera-business/pages/*` | Workspace pages use Carbon Button, TextInput, TextArea and ComboBox directly; no raw button/input/textarea/select/form controls found in the inspected TSX sources |

## Shared control implementation

- `src/components/carbon/Controls.tsx`: shared Carbon React implementations for Button, Checkbox, ComboBox, TextInput, TextArea, FileUploader and InlineNotification.
- `src/components/ui/*.astro`: thin Astro hydration wrappers over the Carbon implementations.
- `src/styles/carbon.scss`: Carbon Sass component styles and theme setup.
- `src/styles/global.css`: ANVERA brand/layout integration and Carbon popup theme adjustments.

## Permitted semantic HTML and state bridges

- `<form>` is retained as the semantic submission container; the actual visible submit/action control is Carbon Button.
- Hidden inputs in the configurator hold selected values for the existing order serialization and cascading country/region/city logic. They are not user-facing controls.
- Hidden honeypot inputs in public inquiry/dealer forms remain anti-spam fields and are not user-facing controls.
- Anchors remain anchors for navigation and do not replace interactive Carbon controls.

## Regression coverage and release gates

1. Static route/component audit: visible native buttons, inputs, textareas and selects were checked across public routes and EmDash workspace TSX files.
2. Existing behavior to preserve: form submission, country → region → city loading, vehicle catalog cascading, manufacturer logo fallback, fitment selection, product filtering, file upload and navigation.
3. CI verification: unit tests, Astro/TypeScript checks and production build must all pass on the final PR head.
4. Isolated Preview deployment: the Carbon implementation branch is now included in the preview deployment workflow so it can be deployed and smoke-tested against isolated Preview D1/Worker resources.
5. Production release: merge PR #35 only after the final CI and Preview deployment/smoke checks pass.
6. Manual browser QA: desktop and mobile interaction checks must be recorded separately; source inspection and a successful build are not a substitute for real browser interaction QA.

## Current audit status

Source-level control migration is complete for the inspected public routes and business workspace. CI and isolated Preview deployment are the remaining automated release gates. Manual desktop/mobile browser QA has not yet been performed in this environment. Do not represent the branch as production-deployed until PR #35 is merged and the production deployment workflow succeeds.
