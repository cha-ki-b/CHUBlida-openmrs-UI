# Decisions taken, and what is still open

Updated 2026-08-26, after the v1.0.1 bug reports from the live instance.

---

## Decided

| # | Question | Decision |
|---|---|---|
| Q1 | Strategy | **Theme the running RefApp 2.12.2.** One `chublidatheme` omod, four upstream extension points, zero forks. The O3 track in the original PDF stays on the shelf. |
| Q2 | Platform version | Confirmed: **Platform 2.5.9, RefApp 2.12.2, WAR 2.4.3**. The module compiles against 2.4.3 (`require_version`), which loads on both. |
| Q3 | Installed modules | Received. **Four custom modules** are present that the stock distro does not ship — see below. |
| Q5 | Logo assets | Derive from the supplied PNG, no sign-off needed. Done — four SVGs, 96% pixel fidelity ([`06-verification-report.md`](06-verification-report.md) §5). |
| Q6 | Imaging viewers | **Stone Web Viewer** (Orthanc plugin) live, **OHIF** in implementation. Neither viewer's UI is in scope. The OpenMRS pages around them are themed like any other. |
| Q7 | Side elements | **All four built**: app rail, patient slide-over, quick-actions dock, toast rail + scroll reveal. |
| Q8 | Dark mode | **Light only for v1.** Token layer authored so dark mode is additive later. |
| Q9 | Locales | **French + Arabic.** RTL built in from the first line — logical properties throughout, Cairo for Arabic, mirrored directional icons, numerals forced LTR, both directions in every audit. |
| — | Responsiveness | Explicitly required. Verified at 360 / 390 / 768 / 1024 / 1440 px. |

### Custom modules in this instance

Not in the stock 2.12.2 distro, so not in the original page inventory:

| Module | Version |
|---|---|
| Imaging | 1.1.2-SNAPSHOT |
| Medical Report | 1.1.0 |
| Neurosurgery Patient View Override | 1.3.0 |
| Clinical Agent Gateway | 1.1.3 |

Also note `webservices.rest` is **2.49.0.f3e8ea**, ahead of the distro's 2.32.0.

These validate the architecture choice: because the theme is a CSS layer injected into
every HTML response, **their pages are themed automatically without anyone knowing their
markup.** An O3 rewrite would have had to reimplement each one.

---

## Still open

### ✅ O1 — Filter confirmed working in the live instance *(closed 2026-08-26)*

The screenshots settle it: the login page, the Reference Application pages and the legacy
administration pages all carry CHU Blida styling. The login page in particular is only
reachable by the filter, so the keystone mechanism is proven in production.

### 🔴 O6 — Manage Global Properties renders blank

**Probably not the theme, but it needs one test to be sure.**

That page (`adminui` → *Manage Global Properties*) is an **AngularJS application**: the GSP
contains only `<div id="manage-system-settings"><ui-view/></div>` followed by
`angular.bootstrap(...)`. Everything visible is injected at runtime from
`templates/list.page` plus a REST call.

Reproducing it as a fixture — including a delayed table injection — the theme renders it
correctly: table, rows and the "Add New Setting" button all visible at full opacity. The
theme does not hide the content; the content never arrives. v1.0.1 additionally hardens
the filter so it cannot touch head-less HTML fragments such as Angular templates.

**The decisive test, in order:**

1. Set global property `chublidatheme.enabled` to `false` and reload the page.
   - **Still blank → not the theme.** Go to step 2.
   - **Content appears → it is the theme.** Send me the browser console output and I will fix it.
2. With the theme off, open the browser console (F12) on that page and check:
   - **Console tab** — a JavaScript error from `angular` or `manageSystemSettings.js`?
   - **Network tab** — does `templates/list.page` return 200? Does the REST call to
     `/openmrs/ws/rest/v1/systemsetting` return 200, or 404/403/500?

**My leading suspicion:** this instance runs `webservices.rest` **2.49.0.f3e8ea**, while the
2.12.2 distribution pins **2.32.0** and `adminui` 1.6.0 was built against that era. If the
`systemsetting` resource moved or changed shape, the Angular app fails and the page is
blank — with the theme making no difference either way.

A quick cross-check: **Advanced Administration → Maintenance → Settings** is the *legacy*
JSP version of the same screen. If that one works and the new one does not, it is the
Angular/REST path, not the theme.

### 🟠 O2 — Markup of the four custom modules

Their pages get the token layer, but nothing bespoke, and none has been inspected. Worth a
pass once the base theme is on staging — particularly **Imaging**, since it is the point of
this project. Screenshots of those screens would let me tune them specifically.

### 🟡 O3 — Clinical review of the patient slide-over

The panel currently mirrors whichever chart sections match allergies / diagnoses / vitals /
medications. That heuristic was chosen so the panel can never disagree with the page, but
**a clinician should say what actually belongs in it** — it is the highest-value element
and the only one whose content is a clinical judgement rather than a styling decision.

### 🟡 O4 — Real clinical data

Fixtures use representative French and Arabic content. Long patient names, unusual
identifier formats, and very wide result tables should be checked against real records
before go-live.

### 🟡 O5 — Approvals

Still unanswered from the original list: who signs off on the visual design, whether a
clinician is available for a review pass, and the deadline for the internship deliverable.

---

## Assumptions made

Recorded so they can be corrected rather than discovered:

1. **`MODULE_WEB_ADMIN` is enabled**, so the omod can be uploaded through the admin screen.
   If not, deploy by filesystem ([`05-build-and-deploy.md`](05-build-and-deploy.md) Option B).
2. **The header logo extension has no competitor.** The theme registers
   `org.openmrs.module.appui.header.config` at `order: 0`. If another module already
   registers one at order 0 or below, `HeaderFragmentController` takes the lowest and ours
   could lose. Easy to spot — the logo would not change on authenticated pages while the
   login page still shows CHU Blida.
3. **Arabic uses the `ar` locale code.** The RTL trigger matches `ar`, `fa`, `he`, `ur`.
4. **Clinicians are on modern browsers.** The theme uses CSS logical properties, `:has()`,
   `overflow: clip` and `IntersectionObserver` — Chrome/Edge 105+, Firefox 121+, Safari 15.4+.
   On anything older the theme degrades to colours and typography without the side elements.
   **If Internet Explorer or an old embedded browser is in use anywhere in the hospital,
   tell me — that changes the CSS strategy materially.**
