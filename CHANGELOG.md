# Changelog

## 1.0.5 — 2026-08-28

### Fixed — Advanced Administration was not responsive

`legacyui`'s `admin/index.jsp` lays its menu groups out as a literal three-column layout
table:

```html
<table border="0" width="93%"><tbody><tr>
  <td valign="top" width="30%"> …menu groups… </td>
  <td valign="top" width="30%"> … </td>
  <td valign="top" width="30%"> … </td>
</tr></tbody></table>
```

Cells in a single table row cannot wrap, so the page kept three columns at every width and
simply overflowed. The top-level layout table inside legacy content is now promoted to a
responsive grid — data tables (those with a header row) and the banner table are excluded.
The menu groups themselves get proper heading treatment and 24px link targets.

| Width | Themed | Stock |
|---|---|---|
| 1440 / 1024 | 3 columns, no scroll | 3 columns, 6 px scroll |
| 820 / 600 | **2 columns**, no scroll | 3 crushed columns (183 px), scroll |
| 390 / 360 | **1 column**, no scroll | 3 crushed columns, **63 px scroll** |

0 contrast failures at every width.

### Confirmed — the Global Properties 500 is not the theme

The Network tab shows:

```
GET /openmrs/ws/rest/v1/systemsetting?includeAll=true&v=default  →  500
```

That is a **server-side** failure: the request reached OpenMRS and the servlet threw. The
filter skips everything under `/ws/`, so it is not in that path.

Recorded as a test rather than left as a claim —
`doFilter_shouldNeverTouchTheRestApi` asserts that this exact URL passes through
byte-for-byte. 8 filter tests now run on every `mvn package`.

## 1.0.4 — 2026-08-28

Defence-in-depth after the Global Properties investigation, plus an escape hatch. The page
now reaches the point of showing "an error has occurred", which means AngularJS is running
and the failure has moved to the REST call — a different problem from the blank page 1.0.3
fixed.

### Added

- **`Sec-Fetch-Dest` gating.** Every current browser states what a response is for. Anything
  that is not a top-level document — `fetch`, XHR, an Angular template — is now skipped
  outright, before any wrapping happens. This is a far stronger guarantee than matching URL
  patterns.
- **`chublidatheme.skipPaths`** global property: comma-separated URL fragments the filter must
  leave alone, editable at runtime. A page that misbehaves can be excluded in seconds without
  a rebuild and without disabling the theme.

### On the DWR diagnosis

Checked against source; it does not hold up:

| Claim | Finding |
|---|---|
| "DWR is the culprit" | Global Properties uses **no DWR**. `systemSettingService.js` is `$resource("/…/ws/rest/v1/systemsetting/:uuid")` — pure REST. DWR XML warnings at OpenMRS startup are long-standing log noise. |
| "Atlas is not a separate module" | It is. `openmrs-distro.properties` declares `omod.atlas` / `omod.atlas.type=omod`, and the instance's own module list shows *Atlas Module 2.2.5*. |
| "webservices.rest 2.32.0" | This instance runs **2.49.0.f3e8ea**. 2.32.0 is what the 2.12.2 distro pins. |
| "Disable htmlformentry" | It backs clinical form entry. Not something to disable to fix an admin screen. |

### Where the failure actually is

`RestService.getAllResults` pages through `/ws/rest/v1/systemsetting`, following `rel="next"`
links recursively; any failing page rejects and raises the snackbar. The theme's filter skips
`/ws/` outright, so it is not in that path.

The live suspicion remains the version gap: `adminui` 1.6.0 targets the REST contract of its
era, while this instance runs `webservices.rest` **2.49.0** — seventeen minor versions ahead
of the 2.32.0 the distribution pins.

## 1.0.3 — 2026-08-27

**The injection filter was silently discarding small responses.** This is the cause of the
blank *Manage Global Properties* page, and I had it wrong twice: in 1.0.1 I concluded from a
fixture that the theme was not responsible. The fixture was the problem — it faked AngularJS
with a `setTimeout`, and it could not exercise the filter at all.

### The defect

`BufferedHtmlResponseWrapper.getWriter()` returns a `PrintWriter` created with **autoFlush
disabled**, wrapping the wrapper's own `ServletOutputStream`. That stream is where the
"is this HTML?" decision is made, on the first byte written.

A `PrintWriter` buffers 8 KB. For any response smaller than that, **nothing ever reaches the
stream while the filter chain runs** — so the decision is never made, `capturing` is still
`null` when `doFilter` resumes, the filter concludes there is nothing to do and returns. The
container flushes the *original* response, never the wrapper's writer, and the buffered body
is dropped. **The client receives an empty response.**

Why it looked so selective: almost every Reference Application page is well over 8 KB, so it
flushes mid-render and works normally. The casualty was
`adminui/…/globalproperties/templates/list.page` — the AngularJS view template, **1262
bytes**. Angular fetched it, got an empty string, compiled nothing, and `<ui-view>` stayed
empty. Blank page, no console error, everything else on the site fine.

### The fix

`finishResponse()` drains the writer as soon as the chain returns and **before** the capture
decision is read, so every byte lands either in the capture buffer or straight in the
container's output.

### Tests

The filter now has a real test suite (`ThemeInjectionFilterTest`, 7 tests) and `mvn package`
runs it — the build fails if any regress. Three of them failed against 1.0.2 and pin exactly
this defect:

| Test | Guards |
|---|---|
| `shouldNotLoseBodyWrittenThroughWriterWhenResponseIsNotCaptured` | the 1 KB Angular template case, verbatim |
| `shouldLeaveHtmlFragmentsAlone` | a head-less fragment returns byte-for-byte |
| `shouldInjectIntoFullDocuments` | a real document still gets the stylesheet and script |
| `shouldHandleDocumentsLargerThanTheWriterBuffer` | the >8 KB path that always worked |
| `shouldNotDuplicateSmallDocuments` | flushing early does not emit the body twice |
| `shouldNotLoseBodyWrittenThroughOutputStream` | byte-oriented writes |
| `shouldSkipAssets` | static files are never wrapped |

### Note on the reproduction

The AngularJS fixture also needed correcting before it proved anything: without jQuery loaded
first, `angular.bootstrap("#selector", …)` cannot resolve a selector string, so *both*
variants failed and the comparison was meaningless. With jQuery 1.12.4 present — as
`standardEmrIncludes` loads it — themed and unthemed render identically, which is what
narrowed the cause to the filter rather than the CSS or JS.

## 1.0.2 — 2026-08-26

Follow-up on the Advanced Administration pages. All three reported issues were mine, and
all three came from the same gap in my testing: **the legacy fixture never loaded
legacyui's own stylesheets.** It was tested against the uicommons baseline only, so
nothing that depended on `openmrs.css` could be caught. The harness now loads
`openmrs.css`, `openmrs_green.css` and `style.css` in the order `headerFull.jsp` includes
them — which is how all three were found and confirmed.

### Fixed

**1. A white rectangle covered the left edge of the text.**
That was the app rail. It is `position: fixed` at 56 px on the inline-start edge, and the
offset was only ever applied to `#body-wrapper` — the Reference Application's container.
Legacy pages use `#pageBody`, so the rail simply sat on top of the first 56 px of every
administration page.

The rail is now **suppressed on legacy pages entirely** (detected by `#pageBody`). Those
pages already carry their own full navigation bar, so the rail was redundant there as well
as harmful, and they lay themselves out with absolute positioning that a fixed overlay
fights. A CSS offset for `#pageBody` remains as a safety net.

**2. The CHU Blida logo covered the navigation bar.**
`openmrs.css` sets `#logosmall { position: absolute; float: left; margin-left: 49px }`, so
the mark drew on top of the nav rather than beside it. It is now an ordinary flex item.
`#banner` itself was `position: absolute` with `#content` reserving 80 px of padding
underneath; the banner is back in normal flow and that reserved gap is gone.

> Logo at x=24 (172 px wide), nav starts at x=224 — measured overlap: **none**.

**3. Navigation links were blue on green and hard to read.**
The green comes from a repeating GIF on `.barsmall`, and upstream colours those links
white to suit it. v1.0.1 dropped the image without recolouring the links, leaving the
theme's blue `#004ED9` on green. The bar is now part of the white header with links in the
theme's own ink colour.

> **7.19:1** — was roughly 2:1 on green.

**4. Legacy content pushed the page 50 px wider than the viewport.**
`#content` is sized with an explicit width and `content-box`, so the 24 px padding the
theme adds landed outside it. Set to `border-box`.

**5. The skip link was unreadable on legacy pages.**
`openmrs.css` carries a bare `a:link` inside a selector list. At specificity (0,1,1) that
beats a single class, so it repainted the skip link's label navy on the teal chip
(1.99:1). The link states are now pinned explicitly.

### Verification

10 pages × 390/1440 px, 514 text nodes: **0 contrast failures, 0 horizontal scroll,
0 elements widening the page, 0 status by colour alone, 24/24 token assertions.**

## 1.0.1 — 2026-08-26

First release after the theme ran on the real CHU Blida instance. Four defects were
reported from production screenshots; three were mine and are fixed, one appears not to be.

### Fixed

**The important one — content could be hidden permanently by an entry animation.**
`chu-rise`, `chu-drop`, `chu-dialog-in` and both toast keyframes started at `opacity: 0`.
An element sits on its first keyframe until the document timeline advances, and the
timeline is frozen whenever the document is not being painted — a background tab, a
throttled renderer, a bfcache restore. In that state the content is invisible **and stays
invisible**. Verified directly: `document.timeline.currentTime` stuck at `0` with the
animation reporting `playState: "running", currentTime: 0`, and `#login-form` computing
`opacity: 0` indefinitely.

All five keyframes are now **transform-only**. A stuck animation now shows content
offset by a few pixels instead of not showing it at all. This is the likely mechanism
behind the "big blank space" in three of the four reports.

*Same class of defect, same fix:* `.chu-reveal` no longer carries `opacity: 0` on its own.
The hidden state is gated behind `html.chu-reveal-active`, which `chu-theme.js` adds
**only after** arming three escape routes: a 4-second hard timeout, a `visibilitychange`
handler, and `beforeprint`. The observer threshold moved from `0.05` to `0`, and
zero-area elements are skipped — a zero-height box can never satisfy a ratio threshold, so
it would have waited for ever. Verified: 2 elements pending at 1.2 s → **0 stuck, gate
removed, at 4.6 s**.

**1. Login — the location list appeared to hide the password field.**
Upstream makes the fieldset `display: inline-block; min-width: 60%` and gives `ul.select`
`min-width: 80%`, while the form computes `overflow: hidden`; a long location list sized
the fieldset past the form and clipped it. Compounded by the theme's own generic dropdown
rule capturing `ul.select`, which gave an in-flow list a floating-menu shadow so it read
as an overlay.

- The dropdown rule is now scoped to real menus (`#session-location ul.select`, typeahead, `.dropdown-menu`).
- The login fieldset is `display: block`, rows are `text-align: start`, inputs and the list are `inline-size: 100%; box-sizing: border-box`.
- The location list caps at `260px` and scrolls internally, so it can never dominate the form.
- The password reveal toggle is positioned inside its field instead of floating after it.

**2. System Administration — one column, 2227 px tall, page width unused.**
`home.gsp` renders tiles in `#apps`; `systemAdministration.gsp` renders the *same* markup
in `#tasks > .homeList`. Only `#apps` was styled. The tile grid now applies to both.

> 10 tiles: **1 column → 4 columns**, page height **2227 px → 949 px**.

**3. Advanced Administration — OpenMRS logo and a large blank area.**
legacyui's `banner.jsp` is a **layout table** (`<table id="bannerbar">`) holding the logo
cell and the whole navigation bar. The theme styled `table` globally, so the banner got a
12 px radius, a border, `overflow: hidden` and 12/16 px cell padding — inflating it and
stacking the nav vertically.

- Table card styling is now scoped to **data** tables: `table:has(> thead …)`, plus a
  `.chu-data-table` class stamped by JS as a fallback. Layout tables are positively
  identified as `.chu-layout-table` and explicitly neutralised.
- The legacy banner is rebuilt as a slim bar carrying the **CHU Blida wordmark**; the three
  stock OpenMRS images are hidden and the nav is laid out horizontally.

> Banner height **325 px → 98 px**; `#bannerbar` **302 px → 81 px**, no border, no radius, no cell padding.

**4. Tables rendered after page load ignored the responsive treatment.**
Found while investigating the global-properties page. The administration screens are
AngularJS apps that inject their table long after `DOMContentLoaded`, so the one-shot pass
missed them and they overflowed on narrow screens. Added a scoped `MutationObserver`
(coalesced per frame, disconnects after 30 s) plus a CSS backstop so a table that has not
yet been processed still scrolls inside itself rather than widening the page.

### Hardened

**The injection filter can no longer touch HTML fragments.** Injection is now gated on the
response actually being a document (`<html` present), and when `inject()` changes nothing
the *original captured bytes* are written back instead of re-encoding the string. Angular
templates such as `templates/list.page` are head-less snippets served as `text/html`; this
guarantees they are returned byte-for-byte.

### Not reproduced — Manage Global Properties is blank

Rebuilt that page as a fixture, including an Angular-style delayed table injection: under
the theme the table, its rows and the "Add New Setting" button all render correctly
(`opacity: 1`, button 40 px tall). **The theme does not hide the content — the content
never arrives.** See the decisive test in
[`docs/04-open-questions.md`](docs/04-open-questions.md) O6.

### Verification

| | 1.0.0 | 1.0.1 |
|---|---|---|
| Pages audited | 6 | **10** (added login-real, sysadmin, legacyadmin, globalprops) |
| Page × viewport combinations | 30 | **20** at 390/1280 px, plus targeted checks |
| Text nodes contrast-checked | 576 | **514** |
| Contrast failures | 0 | **0** |
| Pages able to scroll horizontally | 0 | **0** |
| Elements widening the page | 0 | **0** |
| Status by colour alone | 0 | **0** |
| Token contract assertions | 24/24 | **24/24** |

Two further false positives were fixed in `tools/audit-page.js`: elements inside a
horizontally scrollable ancestor are no longer reported as bleeding (wide tables are
*meant* to scroll inside themselves), and the touch-target check exempts inline links per
WCAG 2.5.8.

---

## 1.0.0 — 2026-08-24

Initial release. One module, four upstream extension points, zero forks, ~296 page
surfaces. Full detail in [`docs/06-verification-report.md`](docs/06-verification-report.md).
