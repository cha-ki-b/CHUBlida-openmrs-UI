# CHU Blida — OpenMRS UI Customization

Branding and user-experience layer for the OpenMRS installation at **Centre Hospitalo-Universitaire de Blida**, part of the `openmrs-orthanc-integration` project.

**Status:** 🟢 *v1.0.5 — running on the CHU Blida instance; Advanced Administration fixes.*
See [`CHANGELOG.md`](CHANGELOG.md) for what changed and [`docs/06-verification-report.md`](docs/06-verification-report.md) for what is still untested.

---

## Target system

| Component | Version |
|---|---|
| OpenMRS Reference Application | 2.12.2 |
| OpenMRS Platform (core) | 2.5.9 *(see Q2 — distro pins 2.4.3)* |
| `referenceapplication` omod | 2.12.0 |

Full resolved module manifest: [`docs/01-architecture.md`](docs/01-architecture.md) §0.

## Goal

Make OpenMRS look and feel like it belongs to CHU Blida, across **all ~296 page surfaces**, without forking a single upstream module — and make it a UI clinicians are glad to use rather than one they tolerate.

## Approach in one paragraph

A single new OpenMRS module, `chublidatheme`, carrying no clinical logic. It uses four extension points that already exist upstream — a servlet filter for universal `<head>` injection, `HeaderIncludeExt` for the 206 legacy admin pages, the `appui` header-config extension for the logo and header, and the `file` resource provider for hot-reloadable assets — to lay a design-token layer over the stock stylesheets. No upstream file is edited. Stopping the module restores the original UI in under a minute.

Full reasoning, including why the supplied O3 strategy was not adopted: [`docs/00-strategy-review.md`](docs/00-strategy-review.md).

## Documentation

| Doc | Contents |
|---|---|
| [`00-strategy-review.md`](docs/00-strategy-review.md) | Review of `OpenMRS_UI_Customization_Strategy.pdf` — what holds, what does not, and the enhanced plan |
| [`01-architecture.md`](docs/01-architecture.md) | The four extension points, with upstream source evidence |
| [`02-design-system.md`](docs/02-design-system.md) | CHU Blida tokens, typography, motion, accessibility, RTL |
| [`03-page-inventory.md`](docs/03-page-inventory.md) | Every surface to be themed, tiered by clinical traffic |
| [`04-open-questions.md`](docs/04-open-questions.md) | Decisions taken, and what is still open |
| [`05-build-and-deploy.md`](docs/05-build-and-deploy.md) | Build, deploy, rollback, runtime settings |
| [`06-verification-report.md`](docs/06-verification-report.md) | What was measured, what broke, what is untested |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history |

## Repository layout

```
Custom-openmrs-UI/
├── brand/              CHU Blida source artwork
├── chublidatheme/      the OpenMRS module (build with `mvn clean package`)
├── docs/               strategy, architecture, design system, build, verification
├── tokens/             tokens.json — single source of truth for the design system
├── tools/              token build + contrast gate, font fetch, logo trace, page audit
├── upstream/           reference clones of OpenMRS modules (git-ignored, read-only)
└── docker-compose.yml  local replica of RefApp 2.12.2
```

## Quick start

```bash
cd chublidatheme && mvn clean package -DskipTests
```

Upload `chublidatheme/omod/target/chublidatheme-omod-1.0.5.omod` via
**Administration → Manage Modules**. To undo: stop the module, or set
`chublidatheme.enabled` to `false`. Full instructions in
[`docs/05-build-and-deploy.md`](docs/05-build-and-deploy.md).

`upstream/` holds shallow clones used to verify extension points against real source rather than documentation. It is git-ignored and never modified. Recreate with:

```bash
mkdir -p upstream && cd upstream
for r in openmrs-module-referenceapplication openmrs-module-appui \
         openmrs-module-uiframework openmrs-module-appframework \
         openmrs-module-coreapps openmrs-module-legacyui \
         openmrs-module-registrationapp openmrs-contrib-uicommons \
         openmrs-web-style-referenceapplication; do
  git clone --depth 1 "https://github.com/openmrs/$r.git"
done
cd openmrs-module-referenceapplication && git fetch --depth 1 origin tag referenceapplication-2.12.0 && git checkout referenceapplication-2.12.0
```

## Brand quick reference

| | |
|---|---|
| Logo primary blue | `#0057F1` |
| Logo accent green | `#3DD8AA` |
| Website primary | `#29C093` ⚠️ *2.32:1 on white — fails WCAG AA; see design system §2* |
| Website accent | `#FBBC34` |
| Derived action colour | `#1A6C53` *(6.34:1 with white text)* |
| Fonts | Inter (UI) · Cairo (headings + Arabic) — self-hosted |

## Principles

1. **Never fork upstream.** Every change goes through a documented extension point.
2. **Accessibility is a requirement, not a finish.** WCAG 2.2 AA, contrast asserted in CI.
3. **Clinical safety outranks aesthetics.** Nothing a clinician reads under time pressure is animated, delayed, or encoded by colour alone.
4. **Bidirectional from line one.** French and Arabic, logical properties only.
5. **Reversible.** Stop the module, get the stock UI back.
