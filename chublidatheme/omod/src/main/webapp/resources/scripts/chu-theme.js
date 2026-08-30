/*!
 * CHU Blida Clinical Theme — behaviour layer
 * OpenMRS Reference Application 2.12.2
 *
 * Adds the side elements the Reference Application does not have: a persistent
 * app rail, a patient summary slide-over, a quick-actions dock, and one-shot
 * scroll reveal. Also makes wide tables readable on a phone.
 *
 * Ground rules:
 *   - Vanilla JS. The page already carries three jQuery versions; this adds none.
 *   - Everything is additive. Nothing existing is removed, rebound or reordered.
 *   - Every feature is wrapped so a failure degrades to "feature absent",
 *     never to "page broken".
 *   - prefers-reduced-motion is honoured here as well as in CSS.
 */
(function () {
  'use strict';

  var CTX = (window.OPENMRS_CONTEXT_PATH ? '/' + window.OPENMRS_CONTEXT_PATH : '') || '';
  var RAIL_CACHE_KEY = 'chu.rail.apps.v1';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Runs fn, swallowing and logging any failure so one broken feature cannot take the page down. */
  function safely(name, fn) {
    try {
      fn();
    } catch (err) {
      if (window.console && console.warn) {
        console.warn('[chu-theme] ' + name + ' skipped:', err);
      }
    }
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'class') node.className = attrs[key];
      else if (key === 'text') node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { node.appendChild(child); });
    return node;
  }

  function isRtl() {
    return (document.documentElement.getAttribute('dir') || '').toLowerCase() === 'rtl';
  }

  /** The login page has no chrome to augment. */
  function isLoginPage() {
    return !!document.getElementById('login-form');
  }

  /**
   * Legacy administration pages (legacyui JSPs) are identified by #pageBody.
   * They carry their own full navigation bar and lay themselves out with
   * absolute positioning, so the app rail is both redundant there and liable to
   * cover content: it is fixed at 56px on the inline-start edge, while the
   * legacy content box starts at zero.
   */
  function isLegacyPage() {
    return !!document.getElementById('pageBody');
  }

  function t(key, fallback) {
    var dict = window.chuThemeMessages || {};
    return dict[key] || fallback;
  }

  /* ======================================================================
     Skip link — keyboard users should not have to tab through the rail to
     reach the chart.
     ====================================================================== */

  function addSkipLink() {
    var main = document.getElementById('content') || document.querySelector('main, #pageBody');
    if (!main) return;
    if (!main.id) main.id = 'chu-main';
    var link = el('a', {
      href: '#' + main.id,
      'class': 'chu-skip-link',
      text: t('skipToContent', 'Skip to main content')
    });
    document.body.insertBefore(link, document.body.firstChild);
    main.setAttribute('tabindex', '-1');
  }

  /* ======================================================================
     App rail
     RefApp 2.x has no persistent navigation: every move goes back through the
     home page. The rail reads the real app menu once per session and keeps it
     available everywhere, so it can never show an app the user lacks rights to.
     ====================================================================== */

  function readAppsFrom(root) {
    var container = root.querySelector('#apps');
    if (!container) return [];
    return Array.prototype.slice.call(container.querySelectorAll('a'))
      .map(function (a) {
        var icon = a.querySelector('i');
        var label = (a.textContent || '').replace(/\s+/g, ' ').trim();
        var href = a.getAttribute('href');
        if (!href || !label) return null;
        return {
          href: href,
          label: label,
          icon: icon ? icon.className : 'icon-file'
        };
      })
      .filter(Boolean);
  }

  function loadApps() {
    return new Promise(function (resolve) {
      var onHome = !!document.getElementById('apps');
      if (onHome) {
        var here = readAppsFrom(document);
        if (here.length) {
          try { sessionStorage.setItem(RAIL_CACHE_KEY, JSON.stringify(here)); } catch (e) { /* private mode */ }
          return resolve(here);
        }
      }
      var cached = null;
      try { cached = JSON.parse(sessionStorage.getItem(RAIL_CACHE_KEY) || 'null'); } catch (e) { /* ignore */ }
      if (cached && cached.length) return resolve(cached);

      // One fetch per session, and only when the cache is cold.
      fetch(CTX + '/index.htm', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (html) {
          if (!html) return resolve([]);
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var apps = readAppsFrom(doc);
          if (apps.length) {
            try { sessionStorage.setItem(RAIL_CACHE_KEY, JSON.stringify(apps)); } catch (e) { /* ignore */ }
          }
          resolve(apps);
        })
        .catch(function () { resolve([]); });
    });
  }

  function buildRail(apps) {
    if (!apps.length) return;

    var rail = el('nav', {
      'class': 'chu-rail',
      'aria-label': t('nav', 'Applications')
    });

    var home = el('a', { href: CTX + '/index.htm', 'class': 'chu-rail__item' }, [
      el('i', { 'class': 'icon-home chu-rail__icon', 'aria-hidden': 'true' }),
      el('span', { 'class': 'chu-rail__label', text: t('home', 'Home') })
    ]);
    rail.appendChild(home);

    var path = window.location.pathname;
    apps.forEach(function (app) {
      var item = el('a', { href: app.href, 'class': 'chu-rail__item' }, [
        el('i', { 'class': app.icon + ' chu-rail__icon', 'aria-hidden': 'true' }),
        el('span', { 'class': 'chu-rail__label', text: app.label })
      ]);
      // Mark the current app, matching on the page segment rather than the
      // whole URL so query strings and patient ids do not defeat it.
      var seg = (app.href.split('?')[0] || '').split('/').pop();
      if (seg && path.indexOf(seg) !== -1) {
        item.classList.add('is-active');
        item.setAttribute('aria-current', 'page');
      }
      item.title = app.label;
      rail.appendChild(item);
    });

    document.body.appendChild(rail);
    document.body.classList.add('chu-has-rail');

    // Below 900px the rail is an off-canvas drawer, so it needs a trigger.
    var burger = el('button', {
      type: 'button',
      'class': 'chu-rail__burger button',
      'aria-label': t('nav.expand', 'Expand navigation'),
      'aria-expanded': 'false',
      text: '☰'
    });
    burger.style.display = 'none';
    burger.addEventListener('click', function () {
      var open = rail.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      scrim.classList.toggle('is-open', open);
    });

    var header = document.querySelector('header');
    if (header) header.insertBefore(burger, header.firstChild);

    var scrim = el('div', { 'class': 'chu-scrim', 'aria-hidden': 'true' });
    scrim.addEventListener('click', function () {
      rail.classList.remove('is-open');
      scrim.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    });
    document.body.appendChild(scrim);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && rail.classList.contains('is-open')) {
        rail.classList.remove('is-open');
        scrim.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.focus();
      }
    });
  }

  /* ======================================================================
     Patient summary slide-over
     Mirrors sections already rendered on the chart rather than calling the API.
     That keeps it impossible for the panel to disagree with the page — it is
     literally the same content — and adds no clinical data path to validate.
     ====================================================================== */

  var PANEL_SECTIONS = [
    { match: /allerg/i,                       priority: 1 },
    { match: /diagnos|problem|condition/i,    priority: 2 },
    { match: /vital|signe|علامات/i, priority: 3 },
    { match: /medicat|treatment|order|prescri/i, priority: 4 }
  ];

  function findChartSections() {
    var sections = Array.prototype.slice.call(
      document.querySelectorAll('.info-section, .dashboard .widget')
    );
    var picked = [];
    sections.forEach(function (section) {
      var headingNode = section.querySelector('.info-header, h3, h4');
      if (!headingNode) return;
      var heading = (headingNode.textContent || '').trim();
      PANEL_SECTIONS.forEach(function (rule) {
        if (rule.match.test(heading)) {
          picked.push({ node: section, heading: heading, priority: rule.priority });
        }
      });
    });
    picked.sort(function (a, b) { return a.priority - b.priority; });
    return picked;
  }

  function buildPatientPanel() {
    // Only on a patient chart, and only when there is something to summarise.
    var patientHeader = document.querySelector('.new-patient-header, .patient-header');
    if (!patientHeader) return;
    var sections = findChartSections();
    if (!sections.length) return;

    var nameNode = patientHeader.querySelector('.demographics h1, h1');
    var patientName = nameNode ? nameNode.textContent.replace(/\s+/g, ' ').trim() : '';

    var body = el('div', { 'class': 'chu-panel__body' });

    sections.forEach(function (entry, index) {
      var wrap = el('section', { 'class': 'chu-panel__section' });
      wrap.appendChild(el('h4', { text: entry.heading }));

      var source = entry.node.querySelector('.info-body') || entry.node;
      var snapshot = source.cloneNode(true);
      // A clone carries no event handlers, so strip anything that looks
      // interactive rather than leaving dead controls in the panel.
      Array.prototype.slice.call(snapshot.querySelectorAll('button, input, select, textarea, .button'))
        .forEach(function (n) { n.parentNode.removeChild(n); });
      snapshot.removeAttribute('id');
      Array.prototype.slice.call(snapshot.querySelectorAll('[id]'))
        .forEach(function (n) { n.removeAttribute('id'); });

      var text = (snapshot.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) {
        wrap.appendChild(snapshot);
      } else {
        wrap.appendChild(el('p', { 'class': 'chu-panel__empty', text: t('none', '—') }));
      }

      // The panel is a read-only summary; this returns the user to the live one.
      if (!entry.node.id) entry.node.id = 'chu-section-' + index;
      var jump = el('a', { href: '#' + entry.node.id, text: t('viewSection', 'View full section') });
      jump.addEventListener('click', function () { closePanel(); });
      wrap.appendChild(jump);

      body.appendChild(wrap);
    });

    var closeBtn = el('button', {
      type: 'button',
      'class': 'button',
      'aria-label': t('patientPanel.close', 'Close patient summary'),
      text: '✕'
    });

    var panel = el('aside', {
      'class': 'chu-panel',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-label': t('patientPanel.open', 'Patient summary'),
      tabindex: '-1'
    }, [
      el('div', { 'class': 'chu-panel__header' }, [
        el('h3', { 'class': 'chu-panel__title', text: patientName || t('patientPanel.open', 'Patient summary') }),
        closeBtn
      ]),
      body
    ]);

    var toggle = el('button', {
      type: 'button',
      'class': 'chu-panel__toggle',
      'aria-expanded': 'false',
      'aria-controls': 'chu-patient-panel'
    }, [
      el('i', { 'class': 'icon-list-ul', 'aria-hidden': 'true' }),
      el('span', { text: t('patientPanel.open', 'Patient summary') })
    ]);
    panel.id = 'chu-patient-panel';

    var scrim = el('div', { 'class': 'chu-scrim', 'aria-hidden': 'true' });

    function openPanel() {
      panel.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      if (window.innerWidth <= 900) scrim.classList.add('is-open');
      panel.focus();
    }
    function closePanel() {
      panel.classList.remove('is-open');
      scrim.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }

    toggle.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);
    scrim.addEventListener('click', closePanel);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) closePanel();
    });

    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    document.body.appendChild(toggle);
  }

  /* ======================================================================
     Quick-actions dock
     Built only from actions the page already offers. Inventing buttons that
     route nowhere would be worse than having no dock.
     ====================================================================== */

  function buildDock() {
    var candidates = Array.prototype.slice.call(
      document.querySelectorAll('.action-section a, .actions a, #actions a')
    ).filter(function (a) {
      var label = (a.textContent || '').replace(/\s+/g, ' ').trim();
      return label && a.getAttribute('href') && a.offsetParent !== null;
    });

    if (candidates.length < 2) return;
    var actions = candidates.slice(0, 4);

    var list = el('div', { 'class': 'chu-dock__actions' });
    actions.forEach(function (source) {
      var icon = source.querySelector('i');
      var label = (source.textContent || '').replace(/\s+/g, ' ').trim();
      list.appendChild(el('a', {
        href: source.getAttribute('href'),
        'class': 'chu-dock__action'
      }, [
        el('i', { 'class': (icon ? icon.className : 'icon-plus'), 'aria-hidden': 'true' }),
        el('span', { text: label })
      ]));
    });

    var trigger = el('button', {
      type: 'button',
      'class': 'chu-dock__trigger',
      'aria-label': t('quickActions', 'Quick actions'),
      'aria-expanded': 'false',
      text: '+'
    });

    var dock = el('div', { 'class': 'chu-dock' }, [list, trigger]);

    trigger.addEventListener('click', function () {
      var open = dock.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (!dock.contains(e.target) && dock.classList.contains('is-open')) {
        dock.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dock.classList.contains('is-open')) {
        dock.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });

    document.body.appendChild(dock);
  }

  /* ======================================================================
     Scroll reveal
     One-shot, and deliberately not applied to anything a clinician reads under
     time pressure — the patient header, allergy banners and alerts render at
     full opacity immediately.
     ====================================================================== */

  var NEVER_REVEAL = '.new-patient-header, .patient-header, .error, .alert, .status-container, #alertOuterBox';

  /**
   * Reveals everything still waiting and disarms the hidden state entirely.
   * Scroll reveal is a nicety; it must never be the reason a clinician cannot
   * see a result.
   */
  function revealEverything() {
    document.documentElement.classList.remove('chu-reveal-active');
    Array.prototype.slice.call(document.querySelectorAll('.chu-reveal'))
      .forEach(function (n) { n.classList.add('is-visible'); });
  }

  function initScrollReveal() {
    if (REDUCED || !('IntersectionObserver' in window)) return;

    var targets = Array.prototype.slice.call(
      document.querySelectorAll('.info-section, .dashboard, #apps .app, .homeList .app, .widget')
    ).filter(function (node) {
      if (node.closest(NEVER_REVEAL) || node.matches(NEVER_REVEAL)) return false;
      // A zero-area box can never satisfy a ratio threshold, so it would stay
      // hidden for good. Those are left visible instead.
      var box = node.getBoundingClientRect();
      return box.height > 0 && box.width > 0;
    });

    // Only worth doing when there is enough below the fold to be worth revealing.
    if (targets.length < 3 || targets.length > 50) return;

    var pending = 0;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var node = entry.target;
        var order = Number(node.dataset.chuRevealIndex || 0);
        node.style.transitionDelay = Math.min(order * 45, 180) + 'ms';
        node.classList.add('is-visible');
        observer.unobserve(node);
        if (--pending <= 0) document.documentElement.classList.remove('chu-reveal-active');
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

    targets.forEach(function (node, i) {
      // Anything already on screen at load appears immediately — a fade-in on
      // first paint reads as slowness, not polish.
      var box = node.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.9) {
        node.classList.add('chu-reveal', 'is-visible');
        return;
      }
      node.dataset.chuRevealIndex = String(i % 5);
      node.classList.add('chu-reveal');
      pending++;
      observer.observe(node);
    });

    if (!pending) return;

    // Hiding is only permitted now that every escape route below is armed.
    document.documentElement.classList.add('chu-reveal-active');

    // 1. Hard timeout, for an observer that never delivers.
    setTimeout(revealEverything, 4000);
    // 2. A hidden tab has a frozen animation timeline. On the way back, just
    //    show everything rather than risk a half-run transition.
    document.addEventListener('visibilitychange', function onVis() {
      if (document.visibilityState === 'visible') {
        setTimeout(revealEverything, 600);
        document.removeEventListener('visibilitychange', onVis);
      }
    });
    // 3. Printing must never omit content.
    window.addEventListener('beforeprint', revealEverything);
  }

  /* ======================================================================
     Responsive tables
     Wide clinical tables get per-cell labels so they can stack on a phone
     instead of forcing a horizontal scroll.
     ====================================================================== */

  /**
   * Several administration screens are AngularJS apps that render their table
   * well after DOMContentLoaded, so a one-shot pass misses them entirely and
   * they overflow on narrow screens. A scoped observer picks up late arrivals.
   */
  function watchForLateTables() {
    if (!('MutationObserver' in window)) return;
    var queued = false;
    var observer = new MutationObserver(function (records) {
      if (queued) return;
      var sawTable = records.some(function (r) {
        return Array.prototype.some.call(r.addedNodes, function (n) {
          return n.nodeType === 1 && (n.tagName === 'TABLE' || (n.querySelector && n.querySelector('table')));
        });
      });
      if (!sawTable) return;
      queued = true;
      // Coalesce a burst of insertions into a single pass.
      window.requestAnimationFrame(function () {
        queued = false;
        safely('responsive tables (late)', prepareTables);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Angular apps settle within a few seconds; stop watching after that so a
    // long-lived page is not paying for this indefinitely.
    setTimeout(function () { observer.disconnect(); }, 30000);
  }

  /**
   * True when an ancestor already scrolls, so wrapping the table in another
   * scroll container would be both redundant and harmful to sticky headers.
   */
  function scrollsAlready(el) {
    var node = el.parentElement;
    while (node && node !== document.body) {
      var overflow = getComputedStyle(node).overflowX + ' ' + getComputedStyle(node).overflowY;
      if (overflow.indexOf('auto') !== -1 || overflow.indexOf('scroll') !== -1) return true;
      node = node.parentElement;
    }
    return false;
  }

  function prepareTables() {
    Array.prototype.slice.call(document.querySelectorAll('table')).forEach(function (table) {
      if (table.dataset.chuTablePrepared) return;
      table.dataset.chuTablePrepared = '1';
      // Legacy JSP pages still use tables for page layout — legacyui's banner is
      // one. Classify every table once so the stylesheet can tell the two apart
      // even where :has() is unavailable, and so a layout table is positively
      // identified rather than merely failing to match.
      var isData = !!table.querySelector('thead th, thead td');
      table.classList.add(isData ? 'chu-data-table' : 'chu-layout-table');
      if (!isData) return;

      // A table that already lives in a scroll container must be left alone.
      // The imaging module scrolls its study list inside #table-scroll with a
      // position:sticky thead; adding a second scroll container around it makes
      // the header stick to the wrong ancestor and it stops working.
      if (scrollsAlready(table)) return;

      // Sorting UI depends on the real table layout: the arrows are drawn on
      // th::after and the plugin reads column indexes. Stacking would break it.
      if (table.hasAttribute('data-sortable')) return;

      // Modules that style their own tables keep them.
      if (/(^|\s)(neuro-|mr-)/.test(table.className)) return;

      var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'))
        .map(function (th) { return (th.textContent || '').replace(/\s+/g, ' ').trim(); });
      if (headers.length < 3) return;

      Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (row) {
        Array.prototype.slice.call(row.children).forEach(function (cell, i) {
          if (headers[i] && !cell.hasAttribute('data-label')) {
            cell.setAttribute('data-label', headers[i]);
          }
        });
      });
      table.classList.add('chu-stack');

      if (!table.parentNode.classList.contains('chu-table-scroll')) {
        var wrap = el('div', { 'class': 'chu-table-scroll' });
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    });
  }

  /* ======================================================================
     Boot
     ====================================================================== */

  function init() {
    if (isLoginPage()) {
      safely('scroll reveal', initScrollReveal);
      return;
    }
    safely('skip link', addSkipLink);
    safely('patient panel', buildPatientPanel);
    safely('quick actions', buildDock);
    safely('responsive tables', prepareTables);
    safely('late table watcher', watchForLateTables);
    safely('scroll reveal', initScrollReveal);
    if (!isLegacyPage()) {
      safely('app rail', function () {
        loadApps().then(function (apps) { safely('app rail render', function () { buildRail(apps); }); });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
