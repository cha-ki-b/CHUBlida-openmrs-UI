# Page Inventory — every surface to be themed

Enumerated from the RefApp 2.12.2 module manifest and the actual `webapp` trees of the cloned modules. This is what "ALL pages of OpenMRS" concretely means.

Module set **confirmed** 2026-08-24. Counts below are for the stock 2.12.2 distro; this
instance additionally runs four custom modules whose pages are covered by the same CSS
layer without their markup being known:

| Custom module | Version |
|---|---|
| **Imaging** | 1.1.2-SNAPSHOT |
| **Medical Report** | 1.1.0 |
| **Neurosurgery Patient View Override** | 1.3.0 |
| **Clinical Agent Gateway** | 1.1.3 |

`webservices.rest` is 2.49.0.f3e8ea here, ahead of the distro's 2.32.0.

---

## Totals

| Surface class | Count | Reached by |
|---|---|---|
| RefApp GSP pages | **35** | Hook D (filter) + Hook A (header/logo) |
| RefApp GSP fragments | **54** | rendered inside the above |
| Legacy admin JSP pages | **206** | Hook D (filter) |
| Login page (standalone GSP) | **1** | Hook D only — *no extension point exists* |
| **Total HTML surfaces** | **≈ 296** | |

No page requires editing an upstream file.

---

## Tier 1 — highest clinical traffic *(design these first, review with clinicians)*

| # | Page | Module | Notes |
|---|---|---|---|
| 1 | **Login** `pages/login.gsp` | `referenceapplication` | First impression. Hardcodes `images/openMrsLogo.png` — logo swapped via CSS (§4 of architecture doc). Location selector, password reveal toggle. |
| 2 | **Home / app menu** `pages/home.gsp` | `referenceapplication` | The app tile grid. Biggest single branding win after login. |
| 3 | **Clinician-facing patient chart** `pages/clinicianfacing/patient.gsp` | `coreapps` | Where clinicians spend most of their day. Patient header, widgets, actions. |
| 4 | **Patient dashboard** `pages/patientdashboard/patientDashboard.gsp` | `coreapps` | |
| 5 | **Find patient** `pages/findpatient/findPatient.gsp` | `coreapps` | Search + results table; tabular numerals matter here. |
| 6 | **Active visits** `pages/activeVisits.gsp` | `coreapps` | Dense table. |
| 7 | **Patient registration** `pages/*` (5 pages, 11 fragments) | `registrationapp` | Multi-step form; heaviest form styling in the product. |
| 8 | **Vitals capture** `pages/vitals/patient.gsp` + `htmlformentry` forms | `coreapps`, `htmlformentry` | Numeric entry — tabular numerals, clear validation states. |
| 9 | **Imaging** | `imaging` 1.1.2-SNAPSHOT | The point of this project. Viewers are **Stone Web Viewer** (live) and **OHIF** (in implementation); neither viewer's own UI is in scope. The OpenMRS pages around them are themed. Markup not yet inspected — [`04-open-questions.md`](04-open-questions.md) O2. |
| 10 | **Medical Report** | `medicalreport` 1.1.0 | Custom. Themed by the token layer. |
| 11 | **Neurosurgery Patient View Override** | 1.3.0 | Custom; overrides the patient view. Worth a look once the base theme is on staging. |

## Tier 2 — routine clinical and coordination

| Page | Module |
|---|---|
| Summary dashboard, program enrolments | `coreapps` |
| Awaiting admission (ADT) | `coreapps` |
| Conditions list — manage condition(s) | `coreapps` |
| Relationships list | `coreapps` |
| Attachments | `coreapps` / `attachments` |
| Allergies | `allergyui` |
| Appointment scheduling UI | `appointmentschedulingui` |
| Form entry app | `formentryapp` |
| Merge visits · Merge patients (3 pages) | `coreapps` |
| Mark patient dead | `coreapps` |
| Provider management (3 pages) | `coreapps` / `providermanagement` |
| Reporting UI | `reportingui` |

## Tier 3 — administration *(206 legacy JSPs — themed wholesale, not individually)*

Reached in one pass by the injection filter (Hook D). Broad groupings:

| Group | Examples |
|---|---|
| System administration | `pages/systemadministration/systemAdministration.gsp` (`coreapps`), `adminui` screens |
| Users, roles, privileges | `legacyui` |
| Concept dictionary | concept, class, datatype, drug, attribute-type forms |
| Encounters, visits, providers, locations | `legacyui` |
| Patients, persons, relationships, identifiers | `legacyui` |
| Modules, scheduler, settings, maintenance | `legacyui` |
| Forms, HTML forms, field types | `legacyui`, `htmlformentry` |
| Metadata sharing / mapping / deploy | `metadata*` modules |
| Reporting, Open Concept Lab, Atlas | `reporting*`, `openconceptlab`, `atlas` |
| Manage apps / manage extensions | `referenceapplication` |

These get the **token layer and typography** (colour, font, spacing, focus states, table and form styling) but not bespoke layout work. Admin pages are used by a handful of people, occasionally; investing bespoke design there would be misallocated effort. They must look consistent and be readable — not be redesigned.

## Tier 4 — states and edge pages

Easy to forget, disproportionately visible when they appear:

- Error / exception pages
- `pages/noAccess.gsp` (`coreapps`)
- `pages/patientdashboard/patientNotFound.gsp`, `deletedPatient.gsp`
- Session-timeout and logout
- Empty states in every list and search
- Loading and spinner states (`uicommons` `images/spinner.gif` — replaced with a CSS spinner in brand colour)
- Toast / info / error message rails (`uicommons` `infoAndErrorMessage`)
- Print output for clinical documents

---

## Shared components — where the real leverage is

Theming these once themes hundreds of pages. Mapped to the `uicommons` SCSS fragments they originate from:

| Component | Source fragment | Hardcoded colours to override |
|---|---|---|
| Buttons | `_buttons.scss` | 11 |
| Base / layout | `_base.scss` | 16 |
| Dashboard widgets | `_dashboard.scss` | 16 |
| Pagination | `_pagination.scss` | **32** ← largest single cluster |
| Typeahead / autocomplete | `_typeahead.scss` | 20 |
| Form navigator | `_form-navigator-ui.scss` | 10 |
| Main content | `_main-content.scss` | 8 |
| Left menu | `_left-menu.scss` | 7 |
| Dialogs | `_dialogs.scss` | 7 |
| Tabs | `_tabs.scss` | 6 |
| Identifiers | `_identifiers.scss` | 4 |
| Datepicker | `_datepicker.scss` | 4 |
| Header | `_header.scss` | 3 |
| Checkboxes | `_checkboxes.scss` | 3 |
| Toast | `_toast.scss` | 2 |
| Dropdown | `_dropdown.scss` | 2 |
| Breadcrumbs | `_breadcrumbs.scss` | 2 |
| Forms, status container | `_forms.scss`, `_status-container.scss` | 1 each |
| Login, grid, actions, search, notifications | (0 hardcoded — variable-driven) | 0 |

Plus **Bootstrap 4** (`appui/resources/styles/bootstrap.min.css`), loaded on every `standardEmrPage`, whose defaults must be neutralised where they clash.

**Implication for sequencing:** work the shared components before the pages. Getting buttons, tables, forms, pagination and dialogs right themes the great majority of all 296 surfaces before a single page is touched individually.

---

## Verification approach

See [`06-verification-report.md`](06-verification-report.md) for what was actually measured
at v1.0.0: 30 page × viewport combinations, 576 text nodes contrast-checked, zero failures.

Verification runs the theme over the **real compiled upstream stylesheet** (uicommons SCSS
built with dart-sass — 113 KB, 915 rules) on fixtures whose DOM is traced from the actual
GSP and JSP templates. That is what caught the two invisible-text defects described in the
report; neither was visible to inspection.

`docker-compose.yml` also stands up the exact target
(`openmrs-reference-application-distro:2.12.2`) for end-to-end checks against real data.
