# Target Architecture — verified extension points in RefApp 2.12.2

Everything below was verified by reading upstream source, not from documentation or memory.
Clones used for verification live in `upstream/` (git-ignored); `referenceapplication` is pinned to tag `referenceapplication-2.12.0`.

---

## 0. What is actually installed

Resolved from `openmrs-distro-referenceapplication` tag `2.12.2`, file `package/src/main/resources/openmrs-distro.properties`:

| Module | Version | | Module | Version |
|---|---|---|---|---|
| `openmrs` (WAR) | **2.4.3** ⚠️ | | `legacyui` | 1.8.4 |
| `referenceapplication` | 2.12.0 | | `adminui` | 1.6.0 |
| `appui` | 1.14.0 | | `registrationapp` | 1.24.0 |
| `uiframework` | 3.22.0 | | `registrationcore` | 1.11.0 |
| `uicommons` | 2.19.0 | | `htmlformentry` | 4.1.0 |
| `uilibrary` | 2.0.7 | | `htmlformentryui` | 2.0.0 |
| `appframework` | 2.16.0 | | `allergyui` | 1.8.4 |
| `coreapps` | 1.34.0 | | `attachments` | 2.5.0 |
| `emrapi` | 1.32.0 | | `appointmentschedulingui` | 1.12.0 |
| `webservices.rest` | 2.32.0 | | `reportingui` | 1.8.0 |
| `fhir2` | 1.2.2 | | `owa` | 1.13.0 |
| `spa` | 1.0.8 | | `openconceptlab` | 1.2.9 |

⚠️ The distro pins the WAR at 2.4.3; you report Platform **2.5.9**. See [`04-open-questions.md`](04-open-questions.md) Q2.

Two facts follow, and they drive the whole design:

- `spa`, `webservices.rest` and `fhir2` are present → an **O3 track is technically reachable** (Track B stays viable).
- `legacyui` 1.8.4 is present and carries **206 JSP pages** → **no O3 strategy can reach "all pages"** on its own.

---

## 1. Hook A — `appui` header config extension *(logo + whole-header replacement)*

**Source:** `upstream/openmrs-module-appui/omod/src/main/webapp/fragments/header.gsp`

```groovy
def logoIconUrl = addContextPath(configSettings?."logo-icon-url")
                  ?: ui.resourceLink("uicommons", "images/logo/openmrs-with-title-small.png")
def logoLinkUrl = addContextPath(configSettings?."logo-link-url") ?: "/${…CONTEXT_PATH}/"
def customProvider = configSettings?."custom-provider"
def customFragment = configSettings?."custom-fragment"
…
<% if (customProvider && customFragment) { %>
    ${ui.includeFragment(customProvider, customFragment, config)}
<% } else { %>   … stock OpenMRS header …
```

`configSettings` is populated by `HeaderFragmentController.controller()` from the app-framework extension point:

```java
// upstream/openmrs-module-appui/api/…/AppUiExtensions.java
public static final String HEADER_CONFIG_EXTENSION = "org.openmrs.module.appui.header.config";
```

The controller takes the **lowest-`order`** extension registered at that point, so our theme simply registers one with a low order.

**What this gives us**

| Parameter | Effect |
|---|---|
| `logo-icon-url` | Replaces the OpenMRS logo with `CHU_Blida.png` on **every authenticated RefApp page** — no CSS trick, no fork |
| `logo-link-url` | Where the logo navigates |
| `custom-provider` + `custom-fragment` | **Replaces the entire header** with a GSP fragment we own — the escape hatch when CSS is not enough |

`addContextPath` prepends the servlet context to any value starting with `/`, so:

```
logo-icon-url = /ms/uiframework/resource/chublidatheme/images/chu-blida-logo.png
```

**Reach:** every page decorated by `appui:decorator/standardEmrPage` — the RefApp clinical surface. **Not** the login page.

---

## 2. Hook B — `ConfigurationResourceProvider` *(hot-reloadable assets)*

**Source:** `upstream/openmrs-module-uiframework/api/src/main/java/org/openmrs/ui/framework/resource/ConfigurationResourceProvider.java`

```java
public class ConfigurationResourceProvider implements ResourceProvider {
    public static final String RESOURCE_KEY = "file";
    @Override
    public File getResource(String path) {
        final String configurationDirectory =
            OpenmrsUtil.getDirectoryInApplicationDataDirectory("configuration").getCanonicalPath();
        …
        // guard against loading files outside of the configuration directory
        if (!resourceFile.getCanonicalPath().startsWith(configurationDirectory)) return null;
```

Any file under `$OPENMRS_APPLICATION_DATA_DIRECTORY/configuration/` is served at:

```
/openmrs/ms/uiframework/resource/file/<path-relative-to-configuration>
```

(with a path-traversal guard already implemented upstream).

**Why this matters:** during design, the whole theme — CSS, JS, fonts, logo — can live in `configuration/chublida/` and be edited with a browser refresh, **no Maven build, no module reload**. For release the same files are baked into the omod. This turns a ~2-minute rebuild loop into an instant one, which is the difference between a theme that gets iterated on and one that does not.

---

## 3. Hook C — `HeaderIncludeExt` *(evaluated, then dropped)*

**Source:** `upstream/openmrs-module-legacyui/omod/src/main/webapp/template/headerFull.jsp:90`

```jsp
<openmrs:extensionPoint pointId="org.openmrs.headerFullIncludeExt" type="html"
                        requiredClass="org.openmrs.module.web.extension.HeaderIncludeExt">
    <c:forEach var="file" items="${extension.headerFiles}">
        <openmrs:htmlInclude file="${file}" />
    </c:forEach>
</openmrs:extensionPoint>
```

This works, and it is the documented way to reach the legacy administration pages.
**It is not used, for two reasons found during implementation:**

1. `HeaderIncludeExt` does **not** live in openmrs-core. It is at
   `openmrs-module-legacyui/omod/src/main/java/org/openmrs/module/web/extension/HeaderIncludeExt.java`,
   so extending it means a compile dependency on `legacyui-omod` — coupling a
   presentation module to a specific legacy UI version for no gain.
2. Hook D already covers those pages. Legacy admin pages are ordinary
   `text/html` responses, so the filter reaches all 206 of them.

Two mechanisms for one surface is redundancy that has to be maintained, not
robustness. The hook is documented here so the option is on record if the filter
ever has to be withdrawn.

## 4. Hook D — servlet filter *(the keystone: 100% coverage)*

Hooks A–C leave one hole, and it is the most visible page in the product.

**Source:** `upstream/openmrs-module-referenceapplication/omod/src/main/webapp/pages/login.gsp`

```groovy
<head>
    <title>${ ui.message("referenceapplication.login.title") }</title>
    …
    <% ui.includeCss("appui", "bootstrap.min.css") %>
    <% ui.includeCss("login.css") %>
    ${ ui.resourceLinks() }
</head>
…
<div class="logo">
    <img src="${ui.resourceLink("referenceapplication", "images/openMrsLogo.png")}"/>
```

The login page is a **standalone GSP**: it is not decorated by `standardEmrPage`, it has **no extension point**, and it **hardcodes** the OpenMRS logo. Hook A cannot reach it (unauthenticated, no decorator); Hook C cannot reach it (not a legacy JSP).

A servlet filter registered in the module's `config.xml` wraps the response, and for `Content-Type: text/html` inserts one line before `</head>`:

```html
<link rel="stylesheet" href="/openmrs/ms/uiframework/resource/chublidatheme/styles/chu-theme.css">
```

**Reach:** every HTML response the application produces — login, all 35 RefApp GSP pages, all 54 fragments rendered into them, all 206 legacy admin JSPs, error pages, `htmlformentry` forms, and any page added later. One implementation, total coverage.

The login logo is then swapped in CSS, because there is no extension point for it:

```css
.login-page .logo img { display: none; }
.login-page .logo {
  background-image: url("…/chu-blida-logo.svg");
  /* logical properties only — see design system §6 */
}
```

**Constraints observed:** external `<link>` only, never inline `<style>` or `<script>` (CSRFGuard / CSP); filter is a no-op on non-HTML responses; filter is skipped for `/ms/uiframework/resource/**` to avoid touching assets.

---

## 5. Hook E — `UserAppFactory` *(runtime registration, no build)*

**Source:** `upstream/openmrs-module-appframework/api/…/factory/UserAppFactory.java`

`UserAppFactory` is an `AppFrameworkFactory` that reads app **and extension** JSON out of the database (`AllUserApps`), and `referenceapplication` ships the admin screens for it:

```
omod/src/main/webapp/pages/manageApps.gsp
omod/src/main/webapp/pages/manageExtensions.gsp
```

By contrast `AppConfigurationLoaderFactory` only reads `classpath*:/apps/*app.json` and `classpath*:/apps/*extension.json` — i.e. from inside deployed omods.

**Consequence:** the Hook A branding extension can be registered **through the admin UI at runtime**, with no code and no build. Useful for a same-day proof of concept and for on-site emergency changes. The omod remains the deliverable, because DB-only configuration is not reproducible across environments.

`appframework-config.json` in the application data directory additionally enables/disables apps and extensions per deployment — the per-environment switch.

---

## 6. Why a CSS layer is unavoidable

`uicommons` 2.19.0 is the design source for the whole RefApp 2.x UI, and its token surface is tiny:

```scss
// upstream/openmrs-contrib-uicommons/src/scss/sass/_variables.scss  — all 15 tokens
$primaryFont: "OpenSans";  $primaryBoldFont: "OpenSansBold";
$primaryLightFont: "OpenSansLight";  $primaryItalicFont: "OpenSansItalic";
$iconFont: "FontAwesome";  $fontPath: "../../fonts";
$alertBackground: #FFFDF0;  $bodyBackground: #EEE;
$white: #FFFFFF;  $black: #000000;  $darkerGrey: #BBB;  $lighterGrey: #f3f3f3;
$highlight: darken(#009384, 15%);   // OpenMRS teal
$text: darken(#5B57A6, 20%);
$link: #007FFF;   $focus: #FFFDF7;
$success: #A1D030; $alert: #FFA000; $error: #ff6666;
```

But roughly **160 hex colours are hardcoded** across its 28 SCSS fragments, and they are not evenly spread:

```
32  _pagination.scss     16  _base.scss        7  _dialogs.scss
20  _typeahead.scss      11  _buttons.scss     6  _tabs.scss
16  _dashboard.scss      10  _form-navigator   …
```

So overriding SASS variables — which would require forking and rebuilding `referenceapplication` anyway — would still leave most of the UI OpenMRS-coloured. **A CSS custom-property layer applied over the compiled stylesheet is both the lower-risk option and the more complete one.**

One helpful coincidence: OpenMRS's own `$highlight` is `#009384`, a teal. CHU Blida's brand primary is `#29C093`, also a teal. The hue swap is small and natural — most of the UI reads as "correct" immediately, and the work concentrates on the hardcoded outliers above.

---

## 7. Layer model

```
┌──────────────────────────────────────────────────────────────┐
│ L4  Component overrides   buttons, tables, cards, dialogs,   │
│                           header, left nav, toasts, forms    │
├──────────────────────────────────────────────────────────────┤
│ L3  Motion & interaction  hover, focus, scroll reveal,       │
│                           slide-over panels, drawers         │
├──────────────────────────────────────────────────────────────┤
│ L2  Semantic tokens       --chu-action, --chu-surface,       │
│                           --chu-critical, --chu-focus …      │
├──────────────────────────────────────────────────────────────┤
│ L1  Primitive tokens      teal-50…950, blue-50…950,          │
│                           amber, neutral, spacing, radii     │
├──────────────────────────────────────────────────────────────┤
│ L0  Upstream CSS          uicommons / referenceapplication / │
│                           legacyui / bootstrap  (UNTOUCHED)  │
└──────────────────────────────────────────────────────────────┘
```

L1–L2 are generated from one `tokens.json`. That file is the single source of truth, is contrast-checked in CI, and is the artifact a future O3 branding configuration would consume.

---

## 8. Proposed module layout

```
chublidatheme/
├── pom.xml
├── api/src/main/java/org/openmrs/module/chublidatheme/
│   └── ChuBlidaThemeActivator.java
├── omod/src/main/java/org/openmrs/module/chublidatheme/
│   ├── web/filter/ThemeInjectionFilter.java        ← Hook D
│   └── extension/html/ThemeHeaderIncludeExt.java   ← Hook C
├── omod/src/main/resources/
│   ├── config.xml                                   ← declares filter + extension
│   └── apps/chublidatheme_extension.json            ← Hook A (header config)
└── omod/src/main/webapp/resources/
    ├── styles/  chu-theme.css  chu-theme.rtl.css
    ├── scripts/ chu-theme.js                        ← scroll reveal, slide-overs
    ├── images/  chu-blida-logo.svg  chu-blida-mark.svg  favicon
    └── fonts/   Inter-*.woff2  Cairo-*.woff2         ← self-hosted
```

Build: `mvn clean package` → `chublidatheme-x.y.z.omod` → upload via `/openmrs/admin/modules`.
Rollback: stop the module. The stock UI returns immediately.
