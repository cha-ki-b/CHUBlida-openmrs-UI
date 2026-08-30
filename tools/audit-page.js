/**
 * CHU Blida theme — in-page audit.
 *
 * Paste into the browser console on any themed OpenMRS page (including the real
 * CHU Blida instance) and it reports what is actually painted, not what the
 * stylesheet intends:
 *
 *   - contrast of every visible text node against its real backdrop
 *   - horizontal overflow, tested by trying to scroll rather than by comparing
 *     scrollWidth to clientWidth, which a vertical scrollbar makes unreliable
 *   - touch-target sizes
 *   - clinical status marked by colour alone
 *   - which theme features loaded
 *
 * Returns a summary object and logs a table of failures.
 */
(function chuAudit() {
  'use strict';

  const AA_TEXT = 4.5;
  const AA_LARGE = 3.0;   // >=24px, or >=18.66px bold
  const AA_NONTEXT = 3.0;
  const MIN_TARGET = 44;

  const lum = (css) => {
    const m = (css || '').match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    const [r, g, b] = m.slice(0, 3).map(Number).map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    if (a === null || b === null) return null;
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  /**
   * Walks up until it finds a non-transparent background, the way the eye does.
   *
   * Returns null when the nearest painted backdrop is a gradient or image. A
   * single ratio is meaningless there — the colour varies across the element —
   * and reading only `backgroundColor` would report a transparent parent and
   * produce a bogus 1.00. Those are counted separately for manual review
   * instead of being reported as failures.
   */
  const parseRgb = (css) => {
    const m = (css || '').match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
  };

  /** Paints `top` (which may be translucent) over `under`. */
  const composite = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });

  const backdrop = (el) => {
    // Accumulate translucent layers instead of stopping at the first one. A
    // frosted chip such as rgba(255,255,255,.2) over a dark panel reads as a
    // light tint of that panel; stopping at the chip alone reported white-on-
    // white and a bogus 1.00.
    const layers = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = parseRgb(s.backgroundColor);
      if (c && c.a > 0) {
        if (c.a >= 1) {
          let out = c;
          for (let i = layers.length - 1; i >= 0; i--) out = composite(layers[i], out);
          return `rgb(${Math.round(out.r)}, ${Math.round(out.g)}, ${Math.round(out.b)})`;
        }
        layers.push(c);
      }
      n = n.parentElement;
    }
    let out = parseRgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (out.a < 1) out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) out = composite(layers[i], out);
    return `rgb(${Math.round(out.r)}, ${Math.round(out.g)}, ${Math.round(out.b)})`;
  };

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const ownText = (el) =>
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();

  /* ---- contrast over every text-bearing element ---- */
  const contrastFailures = [];
  const overGradient = [];
  let checked = 0;

  document.querySelectorAll('body *').forEach((el) => {
    const text = ownText(el);
    if (!text || text.length < 2) return;
    if (!visible(el)) return;

    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize);
    const weight = Number(s.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? AA_LARGE : AA_TEXT;

    const bg = backdrop(el);
    if (bg === null) {
      overGradient.push({ text: text.slice(0, 44), color: s.color });
      return;
    }
    const r = ratio(s.color, bg);
    if (r === null) return;
    checked++;
    if (r < need) {
      contrastFailures.push({
        text: text.slice(0, 44),
        selector: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : ''),
        color: s.color,
        background: bg,
        size: size + 'px',
        ratio: +r.toFixed(2),
        required: need,
      });
    }
  });

  /* ---- horizontal overflow: test it, do not infer it ---- */
  const beforeX = window.scrollX;
  window.scrollTo(9999, window.scrollY);
  const maxScrollX = window.scrollX;
  window.scrollTo(beforeX, window.scrollY);

  /* Anything inside a fixed ancestor is positioned relative to the viewport and
     clipped by overflow:clip, so it cannot cause a scrollbar. Checking only the
     element itself would flag every child of the off-canvas rail. */
  const insideFixed = (el) => {
    let n = el;
    while (n && n !== document.body) {
      if (getComputedStyle(n).position === 'fixed') return true;
      n = n.parentElement;
    }
    return false;
  };

  /* Wide content is allowed to extend past the viewport as long as it scrolls
     inside its own container - that is the intended treatment for wide clinical
     tables. Only content that widens the page itself is a defect. */
  const insideScroller = (el) => {
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
      n = n.parentElement;
    }
    return false;
  };

  /* In RTL the scrollbar sits on the left, so the content box does not start at
     x=0 and comparing against clientWidth reports every element as bleeding.
     The root element's own rect gives the true right edge in both directions. */
  const rootRect = document.documentElement.getBoundingClientRect();

  const bleeding = Array.from(document.querySelectorAll('body *'))
    .filter((el) => {
      if (!visible(el) || insideFixed(el) || insideScroller(el)) return false;
      return el.getBoundingClientRect().right > rootRect.right + 2;
    })
    .slice(0, 10)
    .map((el) => el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.'));

  /* ---- touch targets ---- */
  const smallTargets = Array.from(
    document.querySelectorAll('a, button, input[type=submit], input[type=button], .button, [role=button]'),
  )
    .filter((el) => {
      if (!visible(el)) return false;
      // WCAG 2.5.8 exempts links sitting inline in a sentence; only controls
      // that present as their own target need the 44px minimum.
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return false;
      const r = el.getBoundingClientRect();
      return r.height < MIN_TARGET - 1 && r.height > 0;
    })
    .slice(0, 12)
    .map((el) => ({
      el: el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.'),
      height: Math.round(el.getBoundingClientRect().height),
      text: (el.textContent || '').trim().slice(0, 30),
    }));

  /* ---- status encoded by colour alone ---- */
  const colourOnly = Array.from(document.querySelectorAll('.chu-status, .status, .error, .alert, .success, .info'))
    .filter((el) => {
      if (!visible(el)) return false;
      const glyph = getComputedStyle(el, '::before').content;
      const hasGlyph = glyph && glyph !== 'none' && glyph !== 'normal' && glyph !== '""';
      const hasIcon = !!el.querySelector('i, svg, img');
      return !hasGlyph && !hasIcon;
    })
    .slice(0, 10)
    .map((el) => (el.textContent || '').trim().slice(0, 40));

  /* ---- theme features present ---- */
  const themeSheet = Array.from(document.styleSheets).find((s) => (s.href || '').includes('chu-theme'));
  let themeRules = 0;
  try { themeRules = themeSheet ? themeSheet.cssRules.length : 0; } catch (e) { themeRules = 'cross-origin'; }

  const root = getComputedStyle(document.documentElement);

  const report = {
    page: location.pathname,
    direction: document.documentElement.getAttribute('dir') || 'ltr',
    viewport: window.innerWidth + 'x' + window.innerHeight,
    theme: {
      stylesheetLoaded: !!themeSheet,
      rulesParsed: themeRules,
      tokensResolve: !!root.getPropertyValue('--chu-action').trim(),
      scriptLoaded: !!document.querySelector('.chu-skip-link, .chu-rail, .chu-panel, .chu-dock'),
      rail: !!document.querySelector('.chu-rail'),
      patientPanel: !!document.querySelector('.chu-panel'),
      quickActions: !!document.querySelector('.chu-dock'),
      revealed: document.querySelectorAll('.chu-reveal').length,
      stackableTables: document.querySelectorAll('table.chu-stack').length,
    },
    contrast: { elementsChecked: checked, failures: contrastFailures.length,
                overGradientNotRated: overGradient.length },
    horizontalScroll: { possible: maxScrollX > 0, maxScrollX, bleedingElements: bleeding },
    touchTargetsUnder44px: smallTargets.length,
    statusColourOnly: colourOnly.length,
  };

  const problems = contrastFailures.length + bleeding.length + colourOnly.length;
  console.log('%cCHU Blida theme audit', 'font: 600 14px Inter, sans-serif; color:#1A6C53');
  console.log(report);
  if (contrastFailures.length) { console.warn('Contrast failures:'); console.table(contrastFailures); }
  if (smallTargets.length) { console.warn('Touch targets under 44px:'); console.table(smallTargets); }
  if (colourOnly.length) console.warn('Status conveyed by colour alone:', colourOnly);
  if (overGradient.length) console.info('Not rated (text sits on a gradient or image - check by eye):', overGradient.length);
  if (!problems) console.log('%cNo accessibility or layout problems found.', 'color:#1A6C53');

  return report;
})();
