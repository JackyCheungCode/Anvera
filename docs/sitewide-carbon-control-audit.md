# ANVERA site-wide IBM Carbon control audit

Baseline audited: `main` at the time this inventory was collected.
Implementation branch: `fix/sitewide-carbon-native-controls`.

## Required control policy

All interactive controls must be rendered by IBM Carbon React components from `@carbon/react`. Astro wrappers may host and hydrate those React components, but must not recreate Carbon behavior with native HTML or custom dropdown implementations. CSS is limited to brand tokens, layout, sizing, and theme integration; it must not replace Carbon interaction or popup behavior.

## Route inventory

| Route / source | Existing interactive elements found in source | Migration focus |
|---|---|---|
| `src/pages/index.astro` | 5 button elements | Carbon Button; inspect carousel controls |
| `src/pages/about.astro` | 1 button | Carbon Button |
| `src/pages/craftsmanship.astro` | 1 button | Carbon Button |
| `src/pages/customization.astro` | 2 buttons | Carbon Button |
| `src/pages/custom-inquiry.astro` | 3 buttons, 1 input, 1 textarea, 1 form | Carbon Button, TextInput, TextArea, Form validation |
| `src/pages/dealers/apply.astro` | 3 buttons, 1 input, 1 textarea, 1 form | Carbon Button, TextInput, TextArea, form validation |
| `src/pages/dealers/index.astro` | 2 buttons | Carbon Button |
| `src/pages/configuration/track.astro` | 1 button, 1 form | Carbon Button and form states |
| `src/pages/configure.astro` | 9 buttons, 14 inputs, 1 textarea; 60 legacy dropdown/control markers | Full migration to Carbon ComboBox, Dropdown, TextInput, TextArea, Checkbox/RadioButton; preserve cascading location, fitment and submission behavior |
| `src/components/VehicleFitmentFinder.astro` | 1 static button plus extensive custom dropdown implementation | Carbon ComboBox for make/model/year/trim and product filters; manufacturer logo in option and selected renderers |
| `src/layouts/Base.astro` | 1 button | Carbon Header/MenuButton and responsive navigation behavior |
| `src/pages/vehicle-fitment.astro` | 1 button | Carbon Button; validate finder integration |
| `src/pages/wheels/index.astro` | 6 buttons | Carbon Button and filtering/pagination behavior |
| `src/pages/wheels/[slug].astro` | 2 buttons | Carbon Button |
| `src/pages/wheels/models/[slug].astro` | 3 buttons | Carbon Button |
| `src/pages/contact.astro`, `gallery.astro`, `404.astro`, `[slug].astro`, `category/[slug].astro`, `posts/*`, `tag/[slug].astro` | No direct native form controls detected by source scan | Inspect imported components, links, media viewers and inherited layout controls |

## Shared control layer

- `src/components/carbon/Controls.tsx`: canonical React wrappers for Carbon controls.
- `src/components/ui/*.astro`: Astro integration wrappers; verify each maps to the Carbon implementation and does not fall back to native elements.
- `src/styles/carbon.scss`: Carbon Sass component styles and theme setup.
- `src/styles/global.css`: brand and layout overrides; audit for selectors that override Carbon control internals.

## Explicit exclusions from a false-positive scan

The source scan counts literal HTML tags and known legacy class names. It does not prove that imported components are Carbon, nor does a zero count prove that a page has no interactive controls. Each route must be inspected for imported components and client-side DOM construction. API routes are not UI and are excluded.

## Completion gates

1. Every interactive control in all routes and shared components maps to a Carbon React component.
2. No hand-built dropdown/listbox/menu, native select, or unwrapped form control remains.
3. Manufacturer options and selected manufacturer retain actual brand logo assets.
4. All existing form submission, cascading location, fitment selection, filtering, sorting, upload, validation, and navigation behavior passes regression checks.
5. Carbon theme is consistent on desktop and mobile; popup layers remain readable and correctly positioned.
6. CI, production build, route smoke tests, and real mobile/desktop interaction QA pass before production deployment.

Status: inventory established; migration and regression gates are not yet complete.
