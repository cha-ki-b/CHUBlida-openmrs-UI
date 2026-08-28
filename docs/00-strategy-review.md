# Strategy Review — `OpenMRS_UI_Customization_Strategy.pdf`

**Reviewer:** UI/UX + frontend engineering pass
**Date:** 2026-08-24
**Target system (as stated):** OpenMRS Reference Application **2.12.2** · OpenMRS Platform **2.5.9** · `referenceapplication` omod **2.12.0**

**Verdict:** *Architecturally sound, but it answers a different question than the one this project is asking.* **Do not adopt it as-is for this work.** Adopt the two-track plan in §4.

---

## 1. What the document gets right

These points are correct and are being kept:

| § | Point | Keep? |
|---|---|---|
| 3 | "Do not modify upstream UI code unless absolutely necessary" — a fork turns every future upgrade into a merge conflict | ✅ **Core principle. Adopted verbatim.** |
| 3 | Preferred order: configuration → extensions → new pages → custom modules → fork last | ✅ Adopted, but re-mapped onto RefApp 2.x hooks (§3 below) |
| 8 | Pin exact versions in production; never track `latest` | ✅ Adopted |
| 9 | Build a compatibility matrix in staging before touching production | ✅ Adopted |
| 10 | Keep Docker-internal URLs separate from browser-facing URLs | ✅ Adopted — this matters for the Orthanc/OHIF proxy |
| 11 | Create a shared design layer early (tokens, typography, spacing, states) | ✅ Adopted **and substantially expanded** — see [`02-design-system.md`](02-design-system.md) |
| 12 | Immutable build artifacts, staging → UAT → production | ✅ Adopted |
| 13 | Keep Platform 2.5.9 and the existing Java modules as the authoritative backend | ✅ Adopted |

## 2. Where it is wrong for this project

### 2.1 It solves the wrong problem (critical)

The PDF's thesis is: *"build a separate, versioned O3-based frontend distribution."* That is a reasonable **multi-month replatforming programme**. The actual brief is:

> personalize the OpenMRS UI to fit CHU Blida's colour panel … for **ALL pages** of OpenMRS

Those are not the same job. Following the PDF literally:

- **Day one delivers zero branding.** O3 must be stood up, made compatible, and populated before a single clinician sees a CHU Blida colour.
- **"All pages" becomes unreachable.** O3 does not replace the legacy administration UI. This installation carries **206 legacy admin JSP pages** (`legacyui` 1.8.4) that would stay OpenMRS-green permanently under an O3-only strategy.
- **Scope inflation.** Re-implementing the RefApp 2.x clinical surface — 35 GSP pages and 54 fragments across `coreapps` 1.34.0, `registrationapp` 1.24.0, `appui` 1.14.0 and `referenceapplication` 2.12.0 — in React is a rewrite, not a theme.

### 2.2 It never identifies the extension points that actually exist in RefApp 2.x

This is the most serious technical gap. §3 correctly says *"use configuration and extensions before forking"* — then describes only **O3** extensions and slots. It offers no RefApp 2.x mechanism at all, which leaves the reader with the false impression that the legacy UI can only be forked.

That is not true. Four first-class, upstream-supported hooks were verified directly in the source (full evidence in [`01-architecture.md`](01-architecture.md)):

| Hook | What it buys | Verified in |
|---|---|---|
| `org.openmrs.module.appui.header.config` extension | Swaps the logo (`logo-icon-url`) and can **replace the entire header** (`custom-provider` / `custom-fragment`) on every authenticated page — no fork | `appui/omod/…/fragments/header.gsp` + `HeaderFragmentController.java` |
| `ConfigurationResourceProvider` (provider key `file`) | Serves CSS/JS/images straight from `$OPENMRS_APPLICATION_DATA_DIRECTORY/configuration/` — **hot-reloadable, no rebuild** | `uiframework/api/…/resource/ConfigurationResourceProvider.java` |
| `org.openmrs.headerFullIncludeExt` (`HeaderIncludeExt`) | Injects stylesheets into `<head>` of **every legacy admin JSP** | `legacyui/…/template/headerFull.jsp:90` |
| `UserAppFactory` + `manageExtensions.page` | Register apps and extensions as JSON **from the admin UI, stored in the DB** — zero build | `appframework/…/factory/UserAppFactory.java` |

Any strategy document for this system that omits these is incomplete.

### 2.3 Unverified compatibility claims

§9 says "do not blindly combine the newest O3 packages with your existing backend" — correct advice, which the document then never acts on. For the record, from the actual `openmrs-distro-referenceapplication` 2.12.2 manifest: the distro **does** ship `spa` 1.0.8, `webservices.rest` 2.32.0 and `fhir2` 1.2.2, so an O3 track is *reachable*. But the distro pins `war.openmrs=2.4.3`, while you report running Platform **2.5.9** — that discrepancy is worth confirming ([`04-open-questions.md`](04-open-questions.md), Q2).

### 2.4 Missing requirements that are not optional for a hospital

The PDF is a pure architecture document. For clinical software these omissions are defects, not differences of emphasis:

1. **Accessibility.** No WCAG target is set. This bites immediately: **CHU Blida's own website primary `#29C093` scores 2.32:1 against white** — it fails WCAG AA for text (needs 4.5:1) *and* for UI components (needs 3:1). Dropped naively onto a button it produces an unreadable clinical UI. The palette must be *derived* from the brand, not copied from it. See §2 of [`02-design-system.md`](02-design-system.md).
2. **Colour-blind safety.** Roughly 8% of male clinicians have a colour vision deficiency. Clinical status (normal / abnormal / critical) must never be encoded by colour alone.
3. **RTL and bilingual support.** CHU Blida operates in **French and Arabic**; its public site loads `Cairo` and `Amiri` for Arabic. Arabic is right-to-left. Custom CSS written with `margin-left` / `padding-right` instead of logical properties will break the Arabic locale. The PDF does not mention internationalisation at all.
4. **Motion safety.** The brief asks for animation. Animation must be gated behind `prefers-reduced-motion` — a vestibular-disorder accommodation and a WCAG 2.2 expectation.
5. **Offline / intranet fonts.** A hospital intranet may have no route to `fonts.googleapis.com`. Web fonts must be self-hosted, or the UI silently falls back and looks broken.
6. **CSRF / CSP.** RefApp runs CSRFGuard. Injected inline `<style>` / `<script>` can be blocked. Injection must use external file references only.
7. **Kill switch.** No rollback story. In a hospital, a cosmetic change must be revertible in under a minute.
8. **Performance budget.** Nothing on frame cost. Clinical workstations are frequently modest hardware.

### 2.5 Minor

- §5's proposed module split (`esm-neuro-home`, `esm-neuro-rounds`, …) is speculative for a project that has not yet shipped a themed login page.
- §13/§14 describe a **neurosurgery** system; this project is **openmrs-orthanc-integration** (radiology / imaging). The imaging guidance still applies, but the domain framing should be corrected.

---

## 3. Re-mapping the PDF's own principle to this system

The PDF's §3 ladder is right. Here it is, correctly instantiated for RefApp 2.12.2:

| PDF rung | RefApp 2.12.2 equivalent | Fork risk |
|---|---|---|
| 1. Configuration & branding | `appframework-config.json`; `org.openmrs.module.appui.header.config` extension; assets in `configuration/` served by the `file` provider | **None** |
| 2. Extensions into existing slots | `appframework` extension points; `org.openmrs.headerFullIncludeExt`; `manageExtensions.page` | **None** |
| 3. New custom pages / routes | New GSP pages + `*_app.json` inside a custom omod | **None** |
| 4. Custom module replacing a workflow | Custom omod; or the O3 track for a whole domain | Low |
| 5. Fork upstream | Patch `uicommons` SCSS / `referenceapplication` — **avoid** | High |

**Everything this brief asks for lands on rungs 1–3.**

---

## 4. Enhanced strategy — the recommendation

### Track A — Theme the running RefApp 2.12.2 *(this project)*

One new, self-contained OpenMRS module: **`chublidatheme`**. It contains no clinical logic. It is a presentation layer and nothing else.

```
                    ┌───────────────────────────────────────────┐
                    │  chublidatheme.omod  (the only new code)  │
                    ├───────────────────────────────────────────┤
   every page ◄─────┤ 1. Servlet filter → injects <link> before  │
   (login, GSP,     │    </head> on text/html responses          │
    206 admin JSPs) │ 2. HeaderIncludeExt → legacy admin <head>  │
                    │ 3. appui header config extension           │
                    │    → CHU logo + custom header fragment     │
                    │ 4. Design tokens + theme CSS + JS + fonts  │
                    └──────────────────┬────────────────────────┘
                                       │  reads, never modifies
   ┌───────────────────────────────────▼───────────────────────────────┐
   │  UNTOUCHED: referenceapplication 2.12.0 · coreapps 1.34.0 ·       │
   │  appui 1.14.0 · uicommons 2.19.0 · legacyui 1.8.4 · uiframework   │
   │  3.22.0 · Platform 2.5.9 · MySQL clinical data                    │
   └───────────────────────────────────────────────────────────────────┘
```

**Why the servlet filter is the keystone.** It is the only mechanism that reaches *100%* of pages with a single implementation. The login page (`referenceapplication/pages/login.gsp`) is a standalone GSP with **no extension point** — hooks 2 and 3 cannot reach it. The filter can. Filters are a documented OpenMRS module capability declared in `config.xml`; this is not a hack.

**Properties this buys:**

- **Zero forks.** No upstream file is edited. Module upgrades stay clean — exactly what the PDF's §3 demands.
- **Instant rollback.** Stop the module in `/openmrs/admin/modules` and the original UI returns. Under a minute, no redeploy.
- **Hot iteration.** During design, assets live in `configuration/` and are served by the `file` provider — edit CSS, refresh, see it. No Maven rebuild per tweak. Assets are frozen into the omod for release.
- **Complete coverage.** Login + 35 RefApp GSP pages + 54 fragments + 206 legacy admin JSPs + any future page, from one stylesheet layer.
- **Forward-compatible.** Design tokens are authored once as JSON and emitted to CSS custom properties. If Track B ever happens, the *same* token file feeds O3's branding configuration. Nothing is thrown away.

**Where CSS alone is not enough**, the escape hatch is the sanctioned `custom-provider` / `custom-fragment` header replacement — a custom GSP header we own outright, still with no fork.

### Track B — O3 distribution *(optional, later, not this project)*

The PDF's plan, kept on the shelf. Revisit only when there is a business driver — a workflow the legacy UI genuinely cannot express. Preconditions for re-opening it: a signed-off compatibility matrix against Platform 2.5.9, and a named owner for the parallel-run period. Track A does not block it, and hands it a ready-made token set.

### What is explicitly *not* being done

- No fork of `uicommons`, `referenceapplication`, `coreapps`, `appui` or `legacyui`.
- No in-place patching of SASS variables. `uicommons` `_variables.scss` exposes only **15 tokens**, while roughly **160 colours are hardcoded** across its 28 SCSS fragments — variable overrides alone cannot theme this UI, so a CSS layer is required regardless.
- No rewrite of any clinical workflow.

---

## 5. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CSS override layer breaks on a future module upgrade | Medium | Medium | Scoped, documented selectors; visual-regression screenshots per release; kill switch |
| Injected stylesheet blocked by CSRFGuard / CSP | Low | High | External file `<link>` only — never inline `<style>` / `<script>` |
| Arabic (RTL) layout breaks | Medium | High | Logical CSS properties only; RTL in the test matrix from day one |
| Web fonts unreachable on hospital intranet | Medium | Medium | Self-host all fonts inside the omod; system-font fallback stack |
| Animation causes discomfort or slows clinicians | Medium | High | `prefers-reduced-motion` honoured; transform/opacity only; no motion on vitals or alerts |
| Contrast regressions creep in over time | Medium | High | Automated contrast assertion over the token file in CI |
| Theme diverges from the real installation's module set | Medium | Medium | Confirm installed modules before build — [`04-open-questions.md`](04-open-questions.md) Q3 |

---

## 6. Where to go next

1. [`01-architecture.md`](01-architecture.md) — the four hooks, with source evidence
2. [`02-design-system.md`](02-design-system.md) — CHU Blida tokens, typography, motion, accessibility, RTL
3. [`03-page-inventory.md`](03-page-inventory.md) — every surface to be themed
4. [`04-open-questions.md`](04-open-questions.md) — **decisions needed before implementation starts**
