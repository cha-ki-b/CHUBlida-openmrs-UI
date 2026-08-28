# Build, verify, deploy

Everything needed to go from source to a themed CHU Blida instance, and back again.

---

## Prerequisites

| Tool | Version used | Needed for |
|---|---|---|
| JDK | 8 or 11 | building the omod |
| Maven | 3.9+ | building the omod |
| Node | 18+ | tokens, fonts, logo tooling |
| Python | 3.10+ (Pillow, numpy, scikit-image) | logo vectorisation only |
| Docker | any recent | the local replica (optional) |

---

## Build

```bash
cd chublidatheme
mvn clean package
```

Produces `chublidatheme/omod/target/chublidatheme-omod-1.0.5.omod` (~299 KB).

### Regenerating design tokens

`tokens/tokens.json` is the single source of truth for every colour, space, radius and
duration. After editing it:

```bash
node tools/build-tokens.mjs
```

This rewrites the `:root` block inside `chu-theme.css` **and asserts the contrast
contract**. A failing assertion exits non-zero and writes nothing — a colour regression
stops the build rather than reaching a ward.

For CI, use the non-writing form:

```bash
node tools/build-tokens.mjs --check
```

### Regenerating fonts

```bash
node tools/fetch-fonts.mjs
```

Downloads Inter and Cairo from Google Fonts into the omod (12 files, ~247 KB across
latin / latin-ext / arabic subsets) and rewrites the `@font-face` block with the correct
`unicode-range` for each, so a French screen never downloads the Arabic file.

Fonts are committed to the repository. This only needs re-running to change weights or
add a subset.

### Regenerating logo assets

```bash
python tools/vectorize-logo.py
```

Traces `brand/CHU_Blida.png` into four SVGs. Verified at 96% pixel overlap with the
source raster and an average colour error of 0.18/255.

| Output | Used for |
|---|---|
| `chu-blida-logo.svg` | Login page, wide header — full bilingual lockup |
| `chu-blida-wordmark.svg` | Header at desktop width |
| `chu-blida-mark.svg` | App rail, phone header — the "C" monogram |
| `favicon.svg` | Browser tab — monogram on a white rounded ground |

---

## Deploy

### Option A — admin upload (recommended for the first install)

1. Sign in as a user with **Manage Modules**.
2. Go to **Administration → Manage Modules → Add or Upgrade Module**.
3. Upload `chublidatheme-omod-1.0.5.omod`.
4. The module starts automatically. Reload any page.

Requires `MODULE_WEB_ADMIN=true` (`module.allow_web_admin` in `openmrs-runtime.properties`).

### Option B — filesystem

Copy the `.omod` into the modules directory and restart Tomcat:

```bash
cp chublidatheme-omod-1.0.5.omod $OPENMRS_APPLICATION_DATA_DIRECTORY/modules/
```

### Option C — Docker

Mount it into the distribution's module directory:

```yaml
volumes:
  - ./chublidatheme/omod/target/chublidatheme-omod-1.0.5.omod:/openmrs/distribution/openmrs_modules/chublidatheme.omod:ro
```

---

## Rollback

Three levels, fastest first. **All are reversible and none touches clinical data.**

| Level | Action | Effect | Time |
|---|---|---|---|
| 1 | Set global property `chublidatheme.enabled` to `false` | Injection stops; stock OpenMRS appearance returns. Module keeps running. | seconds |
| 2 | **Administration → Manage Modules → Stop** | Everything the theme adds disappears, including the logo. | under a minute |
| 3 | Delete the `.omod` and restart | Module gone entirely. | a restart |

Level 1 is the one to reach for during a clinic. It needs no restart and no deployment.

---

## Runtime settings

Under **Administration → Settings → Chublidatheme**:

| Property | Default | Purpose |
|---|---|---|
| `chublidatheme.enabled` | `true` | Master switch (rollback level 1) |
| `chublidatheme.autoRtl` | `true` | Stamp `dir="rtl"` for Arabic and other RTL locales. The Reference Application does not do this itself, so turning it off leaves Arabic rendering left-to-right. |
| `chublidatheme.assetVersion` | `1.0.5` | Cache-busting suffix on injected asset URLs. Change it after editing a stylesheet in place so browsers fetch the new file. |

---

## Local replica

`docker-compose.yml` stands up the exact target: `openmrs-reference-application-distro:2.12.2`
against MySQL 5.7, with the built omod mounted.

```bash
docker compose up -d
docker compose logs -f web     # first boot takes several minutes
```

Then <http://localhost:8080/openmrs> — `admin` / `Admin123`.

Iteration loop: `mvn package` → `docker compose restart web`.

For faster CSS iteration, drop the stylesheet into
`$OPENMRS_APPLICATION_DATA_DIRECTORY/configuration/chublida/` instead and reference it
through the `file` resource provider ([`01-architecture.md`](01-architecture.md) §2) — edit,
refresh, no rebuild.

---

## Verification

### Static harness

The theme is verified against the **real compiled upstream stylesheet** rather than
against assumptions. `tools/` and the harness reproduce that pipeline:

1. Compile `openmrs-contrib-uicommons` SCSS with dart-sass (a small Compass shim covers
   the mixins upstream expects) → the genuine 113 KB / 915-rule baseline.
2. Serve fixture pages whose DOM is traced from the real GSP and JSP templates.
3. Load baseline + theme, and audit the result.

### In-page audit

`tools/audit-page.js` runs in any browser console, **including against the live CHU Blida
instance**. It reports what is actually painted:

- contrast of every visible text node against its true backdrop
- horizontal overflow, tested by attempting to scroll rather than by comparing
  `scrollWidth` to `clientWidth` (which a vertical scrollbar, and RTL, both distort)
- touch targets under 44 px, excluding inline links
- clinical status conveyed by colour alone
- which theme features loaded

```js
// paste tools/audit-page.js into the console
```

### Results at v1.0.5

| Dimension | Result |
|---|---|
| Pages audited | **10** — login (both variants), home, patient chart, system administration, legacy administration, global properties, plus RTL twins |
| Page × viewport combinations | **20** at 390 / 1280 px, plus targeted checks at 360/768/1024/1440 |
| Text nodes contrast-checked | **514** |
| Contrast failures | **0** |
| Pages able to scroll horizontally | **0** |
| Elements widening the page | **0** |
| Status conveyed by colour alone | **0** |
| Token contract assertions | **24 / 24 pass** |

Defects this process caught and fixed are listed in
[`06-verification-report.md`](06-verification-report.md) and [`../CHANGELOG.md`](../CHANGELOG.md).

---

## Repository layout

```
Custom-openmrs-UI/
├── brand/                     CHU Blida source artwork
├── chublidatheme/             the OpenMRS module
│   ├── api/                   activator, constants
│   └── omod/                  filter, config.xml, extension json, web assets
├── docs/                      strategy, architecture, design system, this file
├── tokens/tokens.json         single source of truth for the design system
├── tools/
│   ├── build-tokens.mjs       tokens → CSS, plus the contrast gate
│   ├── fetch-fonts.mjs        self-host Inter + Cairo with unicode-ranges
│   ├── vectorize-logo.py      PNG → SVG logo set
│   └── audit-page.js          in-browser accessibility and layout audit
├── upstream/                  read-only reference clones (git-ignored)
└── docker-compose.yml         local replica of the target environment
```
