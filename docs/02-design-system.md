# CHU Blida Clinical Design System

Design language for the OpenMRS clinical UI at Centre Hospitalo-Universitaire de Blida.

> **Design thesis.** A clinician does not want to admire the software. They want to find the right patient, read the right number, and get out. Everything here is in service of *speed with confidence*: brand where it reassures, restraint where it matters, and motion only where it explains. "Beautiful" here means calm, legible, and predictable — not decorated.

---

## 1. Brand source of truth

Extracted from the real assets, not from memory.

**From `brand/CHU_Blida.png`** (960×216, transparent, bilingual FR/AR lockup) — dominant pixel colours:

| Swatch | Hex | Share |
|---|---|---|
| Primary blue (wordmark) | `#0057F1` | 49 807 px |
| Mid blue ("C" outer) | `#4286FF` | 17 961 px |
| Light blue | `#76AEFF` | 1 365 px |
| Brand green ("C" inner) | `#3DD8AA` | 2 186 px |

**From `chublida.dz`** (WordPress + Woodmart 8.1.1 + Elementor; computed styles read from the live archived page):

| Role | Value |
|---|---|
| `--wd-primary-color` | `rgb(41,192,147)` = **`#29C093`** |
| `--wd-alternative-color` | `#FBBC34` |
| Title colour | `#242424` |
| Text colour | `#767676` |
| Body font | **Inter** 400/600 |
| Heading font | **Cairo** 400/600 *(also carries Arabic)* · `Montserrat` on some Elementor headings |
| Arabic serif | `Amiri` |
| Buttons | `#3DD8AA` fill, white text, **35px pill**, uppercase 600 @13px, `transition: .25s` |
| Section bands | `#005CFF`, `#2D9BDA`, deep blue `#066AAB` |

**Reading of the brand:** white ground, teal-green as the signature colour, blue as the institutional/wordmark colour, amber as a sparing accent. The user instruction — *the logo is blue, so put it on white, not on blue* — matches how the site itself uses the mark, and is also the better clinical choice: a white header spends no visual budget on chrome.

---

## 2. ⚠️ The brand primary cannot be used as-is

**`#29C093` scores 2.32:1 against white.** WCAG 2.2 AA requires 4.5:1 for text and 3:1 for user-interface components and meaningful boundaries. `#29C093` fails **both**.

A marketing site absorbs this — its buttons are huge pills and nothing clinical depends on them. A clinical UI cannot: a "Save encounter" button whose label is unreadable under ward lighting is a patient-safety issue, not a style preference.

So the palette is **derived** from the brand hue rather than copied from the brand value. The signature teal is preserved exactly where it is decorative, and a darker step of the *same hue* carries every job that requires contrast. Clinicians still read "CHU Blida"; the UI still passes AA.

**Rule:** `#29C093` (`teal-500`) is permitted **only** for large decorative fills where nothing depends on perceiving its edge or reading text on it — hero bands, chart series that also carry a text label, an active-tab underline that is *also* marked by a font-weight change. It is never a button fill, never a border, never text.

---

## 3. Primitive tokens

Hue-preserving ramps generated from the brand values, then contrast-audited. Every ratio below is measured, not estimated.

### Teal — brand signature *(source `#29C093`)*

| Token | Hex | vs white | Use |
|---|---|---|---|
| `teal-50` | `#F3F9F7` | 1.07 | Page tint, selected-row background |
| `teal-100` | `#E5F3EF` | 1.14 | Hover row, soft badge background |
| `teal-200` | `#C8ECE1` | 1.27 | Chart fill, soft divider |
| `teal-300` | `#98E9D1` | 1.41 | Decorative |
| `teal-400` | `#68DFBB` | 1.63 | Decorative |
| **`teal-500`** | **`#29C093`** | **2.32** | **Brand accent — decorative only (§2)** |
| `teal-600` | `#26B389` | 2.66 | Decorative, dark-surface text |
| `teal-700` | `#218C6C` | 4.17 | Icons, borders, focus rings *(≥3:1 ✓)* |
| **`teal-800`** | **`#1A6C53`** | **6.34** | **Primary action fill (white text ✓)** |
| `teal-900` | `#13513E` | 9.23 | Action hover/active |
| `teal-950` | `#0D3629` | 13.32 | Dark surfaces |

### Blue — institutional *(source `#0057F1`, the logo blue)*

| Token | Hex | vs white | Use |
|---|---|---|---|
| `blue-50` | `#F1F5FB` | 1.09 | Info banner background |
| `blue-100` | `#E1E9F6` | 1.22 | Info tint |
| `blue-200` | `#BED2F6` | 1.53 | Decorative |
| `blue-500` | `#0A63FF` | 4.95 | **Focus ring** ✓ |
| **`blue-600`** | **`#004ED9`** | **6.79** | **Links, secondary action** ✓ |
| `blue-700` | `#0440A9` | 9.09 | Link hover, info text |
| `blue-900` | `#022561` | 14.59 | Dark institutional surfaces |

### Amber — caution *(source `#FBBC34`)*

| Token | Hex | vs white | Use |
|---|---|---|---|
| `amber-100` | `#F6F0E2` | 1.14 | Warning banner background |
| `amber-500` | `#FAB00F` | 1.86 | Warning icon fill (paired with text) |
| **`amber-800`** | **`#805906`** | **6.27** | **Warning text** ✓ |

### Neutral — green-tinted grey, so the UI feels of one family

| Token | Hex | vs white | Use |
|---|---|---|---|
| `canvas` | `#F6F8F7` | — | App background (replaces `$bodyBackground: #EEE`) |
| `surface` | `#FFFFFF` | — | Cards, header, tables |
| `border-subtle` | `#DCE5E1` | 1.29 | Decorative dividers **only** |
| **`border-control`** | **`#7C8F88`** | **3.42** | **Input/control outlines** *(meaningful → needs 3:1)* ✓ |
| `ink-subtle` | `#657570` | 4.85 | Secondary/meta text ✓ |
| `ink-muted` | `#4A5B55` | 7.19 | Labels, table headers ✓ |
| `ink` | `#12211C` | 16.67 | Body and heading text ✓ |

### Clinical status

| Token | Hex | vs white | Use |
|---|---|---|---|
| `critical` | `#B3261E` | 6.54 ✓ | Critical result, allergy, error |
| `warning` | `#805906` | 6.27 ✓ | Abnormal result, caution |
| `success` | `#1A6C53` | 6.34 ✓ | Normal, saved, confirmed |
| `info` | `#0440A9` | 9.09 ✓ | Informational |

---

## 4. Semantic tokens

The layer components actually consume. Emitted as CSS custom properties on `:root` from a single `tokens.json`.

```css
:root {
  /* surfaces */
  --chu-canvas:        #F6F8F7;
  --chu-surface:       #FFFFFF;
  --chu-surface-sunken:#F3F9F7;   /* teal-50 */
  --chu-surface-brand: #0D3629;   /* teal-950, for inverted areas */

  /* text */
  --chu-ink:           #12211C;
  --chu-ink-muted:     #4A5B55;
  --chu-ink-subtle:    #657570;
  --chu-ink-inverse:   #FFFFFF;

  /* action */
  --chu-action:        #1A6C53;   /* teal-800  — white text 6.34:1 */
  --chu-action-hover:  #13513E;
  --chu-action-soft:   #E5F3EF;
  --chu-action-quiet:  #218C6C;   /* icons, borders */

  /* link & focus */
  --chu-link:          #004ED9;
  --chu-link-hover:    #0440A9;
  --chu-focus:         #0A63FF;

  /* brand expression — DECORATIVE ONLY, never text/edge-critical */
  --chu-brand-vivid:   #29C093;
  --chu-brand-blue:    #0057F1;

  /* borders */
  --chu-border:        #DCE5E1;   /* decorative */
  --chu-border-control:#7C8F88;   /* meaningful, 3:1 */

  /* status */
  --chu-critical:      #B3261E;  --chu-critical-bg: #FDECEA;
  --chu-warning:       #805906;  --chu-warning-bg:  #F6F0E2;
  --chu-success:       #1A6C53;  --chu-success-bg:  #E5F3EF;
  --chu-info:          #0440A9;  --chu-info-bg:     #E1E9F6;

  /* radii — softer than stock OpenMRS, far short of the site's 35px pill */
  --chu-radius-sm: 4px; --chu-radius-md: 8px;
  --chu-radius-lg: 12px; --chu-radius-pill: 999px;

  /* elevation — tinted, never neutral black */
  --chu-shadow-1: 0 1px 2px rgba(18,33,28,.06), 0 1px 3px rgba(18,33,28,.08);
  --chu-shadow-2: 0 2px 6px rgba(18,33,28,.07), 0 6px 16px rgba(18,33,28,.09);
  --chu-shadow-3: 0 8px 24px rgba(18,33,28,.10), 0 16px 48px rgba(18,33,28,.12);

  /* spacing — 4px base */
  --chu-space-1: 4px;  --chu-space-2: 8px;  --chu-space-3: 12px;
  --chu-space-4: 16px; --chu-space-5: 24px; --chu-space-6: 32px;
  --chu-space-7: 48px; --chu-space-8: 64px;
}
```

> On the **35px pill**: the website's button radius is right for marketing and wrong for dense clinical tables — pills waste horizontal space and blur the row grid. Pills are kept for status chips and the primary call-to-action on login only; everything else uses `--chu-radius-md`. This is a deliberate, documented divergence from the website, not an oversight.

---

## 5. Typography

Matching the website: **Inter** for UI text, **Cairo** for headings and all Arabic.

```css
--chu-font-ui:      "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
--chu-font-display: "Cairo", "Inter", system-ui, sans-serif;
--chu-font-mono:    "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
```

**Both fonts are self-hosted inside the omod** (`resources/fonts/*.woff2`, `font-display: swap`, subset to `latin` + `latin-ext` + `arabic`). A hospital intranet may have no route to `fonts.googleapis.com`; a theme that depends on a CDN is a theme that breaks on the ward.

| Role | Family | Size | Weight | Line height |
|---|---|---|---|---|
| Display / page title | Cairo | 28px | 700 | 1.25 |
| Section heading | Cairo | 20px | 600 | 1.3 |
| Card heading | Inter | 16px | 600 | 1.4 |
| Body | Inter | 14px | 400 | 1.6 |
| Dense table | Inter | 13px | 400 | 1.45 |
| Label / meta | Inter | 12px | 500 | 1.4 |
| **Clinical numerals** | Inter `tnum` | 15px | 600 | 1.3 |

**Tabular numerals are mandatory** for vitals, doses, lab values and identifiers:

```css
.chu-numeric { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
```

Proportional digits make a column of lab values impossible to scan and make a transposed digit invisible. This is a legibility requirement, not a refinement.

Stock OpenMRS uses Open Sans at 12–13px. Body text moves to 14px: clinicians read at arm's length on shared workstations, and the extra pixel costs nothing.

---

## 6. Bidirectional (French / Arabic) — non-negotiable

CHU Blida works in French **and** Arabic. Arabic is right-to-left. Every rule in the theme uses **CSS logical properties**:

| Never | Always |
|---|---|
| `margin-left` | `margin-inline-start` |
| `padding-right` | `padding-inline-end` |
| `text-align: left` | `text-align: start` |
| `border-left` | `border-inline-start` |
| `left: 0` | `inset-inline-start: 0` |
| `transform: translateX(-100%)` | direction-aware, or flipped under `[dir="rtl"]` |

Directional icons (chevrons, back arrows, breadcrumb separators) are mirrored:

```css
[dir="rtl"] .icon-chevron-right { transform: scaleX(-1); }
```

Arabic sets `font-family: var(--chu-font-display)` (Cairo) and a slightly larger line-height (1.75) — Arabic diacritics need the vertical room.

**Every screen is reviewed in both directions.** RTL is in the test matrix from day one, not retrofitted; retrofitting RTL is where this kind of project usually fails.

---

## 7. Motion

The brief asks for smooth, pleasant animation on scroll and hover. The constraint that makes it *pleasant* rather than tiring is restraint.

```css
--chu-dur-instant: 90ms;    /* state flips: checkbox, toggle */
--chu-dur-fast:   140ms;    /* hover, focus */
--chu-dur-base:   220ms;    /* dropdowns, tooltips, accordions */
--chu-dur-slow:   320ms;    /* slide-over panels, drawers */

--chu-ease-out:   cubic-bezier(.22,.8,.28,1);    /* things entering */
--chu-ease-in:    cubic-bezier(.5,0,.75,0);      /* things leaving */
--chu-ease-spring:cubic-bezier(.34,1.42,.64,1);  /* panels only, sparingly */
```

**Rules**

1. **Animate `transform` and `opacity` only.** Never `width`, `height`, `top`, `left`, `margin` — those force layout on every frame and stutter on ward hardware.
2. **Hover lift is 1–2px.** `translateY(-1px)` plus a shadow step. Never `scale()` on a table row: it shifts the text a user is mid-read.
3. **Nothing animates that a clinician reads under time pressure.** Vitals, allergy banners, critical flags and error messages appear at full opacity, immediately. Delaying safety information for an aesthetic fade is unacceptable.
4. **Scroll reveal is one-shot and subtle.** `IntersectionObserver`, `opacity 0→1` + `translateY(12px→0)`, 60px stagger cap, never replays on scroll-up. Dashboard cards and list sections only.
5. **Reduced motion is honoured absolutely:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

6. **Performance budget:** ≤ 4 concurrent animated elements; no animation on lists longer than 50 rows; no `filter`/`box-shadow` transitions on scroll.

---

## 8. Side-appearing elements

Concrete proposals for the "side appearing elements" in the brief. Final selection is Q7 in [`04-open-questions.md`](04-open-questions.md).

| # | Element | Behaviour | Value to the clinician |
|---|---|---|---|
| 1 | **App rail** (inline-start) | 56px icon rail; expands to 240px labelled nav on hover/focus, `transform` only; off-canvas drawer < 900px | Navigation without leaving the page; reclaims horizontal space for clinical content |
| 2 | **Patient context slide-over** (inline-end) | 380px panel: allergies, active problems, last vitals, active orders. Slides in on demand, pinnable so it stays open | Stops the constant tab-switching between chart sections |
| 3 | **Quick-actions dock** | Bottom-inline-end; expands to a vertical stack (new visit, new encounter, order imaging, print summary) | The four things done most often, always one click away |
| 4 | **Toast rail** | Slides from top-inline-end; re-skin of the existing `jquery.toastmessage` already in `uicommons` | Confirmations that do not interrupt; reuses what is already loaded |
| 5 | **Scroll-reveal sections** | Dashboard widgets fade/rise once on first view | Draws the eye down a long chart without demanding attention |

All five are CSS + a small vanilla JS file. None requires a framework, a build step, or a change to any upstream module.

---

## 9. Accessibility commitments

Target: **WCAG 2.2 level AA**, verified rather than asserted.

- **Contrast.** Every token pair in §3 is measured; a CI check re-asserts them on every commit, so a regression fails the build rather than reaching the ward.
- **Never colour alone.** Every clinical status carries an icon *and* a text label as well as colour. Roughly 8% of male clinicians have a colour vision deficiency; a red-only "critical" flag is invisible to a protanope.
- **Focus is always visible:** `outline: 2px solid var(--chu-focus); outline-offset: 2px`. The stock UI's focus styles are weak — keyboard users navigate a clinical UI faster than mouse users, and only if they can see where they are.
- **Hit targets ≥ 44×44 px**, including in dense tables (padding, not font size).
- **Respect `prefers-reduced-motion`** (§7).
- **Text resizes to 200%** without loss of content or function.
- **Print stylesheet.** Clinical documents get printed. Chrome, rails and panels are suppressed; ink is black; tables get borders and repeat their headers across pages.

---

## 10. Dark mode

Not in scope by default — proposed as Q8. Worth raising because this is a **radiology** project: PACS reading is routinely done in darkened rooms, and a white EMR beside a dark Orthanc/OHIF viewer is a real complaint. The token architecture supports it (redefine the semantic layer under `prefers-color-scheme: dark`), but it roughly doubles the visual QA surface. Recommendation: ship light first, revisit for the imaging screens once the base theme is validated.

---

## 11. Deliberate divergences from chublida.dz

Documented so they read as decisions, not drift:

| Website | Clinical UI | Why |
|---|---|---|
| `#29C093` buttons | `#1A6C53` (`teal-800`) | Brand value fails WCAG AA (§2) |
| 35px pill buttons | 8px radius (pills only for chips + login CTA) | Pills waste width and blur row grids in dense tables |
| Uppercase 13px nav | Sentence case 14px | Uppercase is measurably slower to read and breaks Arabic entirely |
| Body text `#767676` | `#12211C` / `#4A5B55` | `#767676` is 4.54:1 — technically passing, but no margin for a dimmed ward monitor |
| Full-bleed blue bands | White header, teal accents | Explicit brief requirement (blue logo needs a white ground) and better use of screen budget |
| `transition: .25s` on everything | Tiered 90/140/220/320ms | One duration for every interaction makes fast things feel sluggish and slow things feel abrupt |
