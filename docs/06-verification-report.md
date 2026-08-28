# Verification Report — v1.0.0

**Date:** 2026-08-24
**Method:** the theme layered over the **real compiled upstream stylesheet**, on fixture
pages whose DOM is traced from the actual GSP and JSP templates, audited in a real browser.

Method and tooling: [`05-build-and-deploy.md`](05-build-and-deploy.md#verification).

---

## 1. Why not just look at it

Eyeballing a theme confirms it looks different, not that it is correct. Three classes of
defect are invisible to inspection and all three turned up here:

- text that is the same colour as its background (looks like "nothing rendered")
- horizontal overflow that only appears at one viewport width
- status meaning carried by colour alone, which is only visible to someone who cannot see the colour

So the baseline was compiled from `openmrs-contrib-uicommons` SCSS with dart-sass —
**113 KB, 915 rules**, the genuine upstream cascade — and everything was measured.

---

## 2. Results

| Dimension | Result |
|---|---|
| Page × viewport combinations audited | **30** (6 pages × 360 / 390 / 768 / 1024 / 1440 px) |
| Text nodes contrast-checked against their true backdrop | **576** |
| Contrast failures | **0** |
| Pages able to scroll horizontally | **0** |
| Elements overflowing the viewport | **0** |
| Clinical status conveyed by colour alone | **0** |
| Token contract assertions | **24 / 24 pass** |
| Theme rules parsed on every page | **241** |

Pages: login · home · patient chart · legacy administration — each in French (LTR) and
Arabic (RTL).

---

## 3. Defects found and fixed

Every item here was found by measurement, not by looking. Six of the eight would have
shipped.

### 3.1 Action links rendered white-on-white — *invisible content*

`uicommons` sets `.action-section a { color: #FFF }` because upstream paints that strip
on a dark ground. The CHU surface is white, so **"Nouvelle consultation", "Demander une
imagerie" and "Imprimer le résumé" became invisible** — contrast ratio **1.00:1**.

The three most-used actions on the patient chart. Fixed by giving `.action-section` its
own pill treatment in brand colours (now 6.34:1).

### 3.2 Login location list rendered white on a light fill — *invisible content*

Same shape of bug: upstream styles `ul.select li.selected` as white text on a dark
selected state. Against the new light `action-soft` fill it measured **1.14:1** — a
clinician could not read which login location was selected. Unselected options were
3.83:1 at 11.2px.

Fixed with explicit colour, full text size, a 44px row, and a check glyph so the
selection is not colour-only.

### 3.3 Patient family name at 9.6px, 3.54:1

`uicommons` renders the family name as `0.6em #888` inside the `h1`. The single most
important string on a clinical page was below AA. Now full size, `--chu-ink`, bold,
16.67:1.

### 3.4 Header overflowed the viewport on phones

At 390px the logout link alone is 114px and the header row could not shrink, giving a
70–94px horizontal scroll on the home and chart pages. Fixed by letting every level of
the nav shrink (`min-inline-size: 0`), truncating the location name, and collapsing the
logout control to its icon under 640px — the accessible name is preserved.

### 3.5 Home notification could not fit any phone

Upstream `home.scss` pins `.note` to `min-width: 340px` with 24px **content-box** padding,
so it measures 388px inside a 265px column. Fixed with `border-box` and a released
minimum.

### 3.6 Off-canvas panel created a phantom horizontal scrollbar

The patient slide-over parks off-screen with `translateX(100%)`, which extends the
scrollable area. Fixed with `overflow-x: clip` on the root — deliberately `clip` and not
`hidden`, because `hidden` would make the root a scroll container and break
`position: sticky` elsewhere.

### 3.7 Arabic fell back to a system font

The base `body` rule needs `!important` to beat the compiled upstream sheet, so the
`[dir="rtl"]` Cairo override lost the cascade. Arabic rendered in Inter — which has no
Arabic glyphs — and silently fell back. Fixed; `th` needed it separately because
`uicommons` sets its own `OpenSansBold` face directly.

### 3.8 Breadcrumb links below the WCAG 2.5.8 minimum

19px tall against a 24px requirement. Height added through padding, so the text size is
unchanged. Under `pointer: coarse` all controls go to 44px.

---

## 4. Defects found in the audit tool itself

Worth recording, because both would have produced false confidence in the opposite
direction — reporting problems that were not real:

- **RTL false positive.** In right-to-left the scrollbar sits on the *left*, so the
  content box does not start at x=0 and comparing element edges against `clientWidth`
  flagged every element as overflowing. Now compares against the root element's own rect.
- **Fixed-ancestor false positive.** Children of the off-canvas rail were flagged as
  bleeding. They are inside a `position: fixed` parent and clipped, so they cannot cause
  a scrollbar. The check now walks up for a fixed ancestor.

A third measurement was a false negative and needed no fix: `:focus` styles appeared
absent because the automation pane did not hold OS focus (`document.hasFocus() === false`).
Confirmed present by reading the CSSOM directly.

---

## 5. Build-integrity checks

Two problems surfaced while building rather than while auditing:

- **Servlet API conflict.** `openmrs-web` pulls `javax.servlet:servlet-api:2.4`
  transitively through `jsp-api:2.0`. It shares the `javax.servlet` package with the
  modern API, so it won the compile classpath, and 2.4 lacks the Servlet 3.1 members
  (`ServletOutputStream.isReady`, `setWriteListener`) that Tomcat 8.5+ requires an
  implementation to provide. Compiling against 2.4 would have produced an
  `AbstractMethodError` at runtime, not at build time. Excluded in `omod/pom.xml`.

- **Logo trace fidelity.** Rendered the generated SVG to canvas and diffed it against the
  source raster: **96% pixel overlap, 0.18/255 average colour error**. The 2% edge
  difference is the antialiased boundary, which is the mathematically correct result for a
  0.5-level marching-squares trace.

---

## 6. Not verified here

Stated plainly, because these need the real instance:

1. **The servlet filter has not run inside a live OpenMRS.** The mechanism is confirmed by
   source (`config-1.2.dtd` declares `<filter>`/`<filter-mapping>`;
   `ModuleFilterMapping.urlPatternMatches` honours `/*` context-relative), and the module
   packages correctly — but Docker Desktop did not start on this machine, so the
   end-to-end path was not exercised. **This is the first thing to confirm on the staging
   instance.**
2. **The four custom CHU modules** — Imaging 1.1.2-SNAPSHOT, Medical Report 1.1.0,
   Neurosurgery Patient View Override 1.3.0, Clinical Agent Gateway 1.1.3 — their markup is
   unknown, so their pages are covered by the token layer but have not been inspected.
3. **Real clinical data.** Fixtures use representative content; long names, unusual
   identifier formats and very wide tables should be checked against real records.
4. **Screen readers.** Semantics and ARIA are in place; no assistive-technology pass has
   been run.
5. **Print output.** The print stylesheet is written but has not been sent to a printer.

---

## 7. Regression gate

Two commands, both suitable for CI:

```bash
node tools/build-tokens.mjs --check   # fails on any contrast regression
mvn -f chublidatheme/pom.xml verify   # fails on any build regression
```

Plus `tools/audit-page.js` in the console of any page, before and after a module upgrade.
