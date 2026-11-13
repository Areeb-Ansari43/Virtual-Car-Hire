/* Virtual Car Hire — polish layer behaviour.
   Small, dependency-free, safe to load on every page. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var doc = document;

  /* ---------- Header shadow once the page moves ---------- */
  var header = doc.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- First screen: scroll cue to the next section ---------- */
  var first = doc.querySelector('.vch-hero, .page-hero, .article-hero, .how-hero, .support-hero, .hero-luton');
  if (first && !first.querySelector('.vch-cue') && !first.hasAttribute('data-no-cue')) {
    var next = first.nextElementSibling;
    while (next && (next.tagName === 'SCRIPT' || next.tagName === 'STYLE' || next.offsetHeight === 0)) next = next.nextElementSibling;
    if (next) {
      if (!next.id) next.id = 'next';
      var cue = doc.createElement('a');
      cue.className = 'vch-cue';
      cue.href = '#' + next.id;
      cue.innerHTML = '<span class="line" aria-hidden="true"></span><span>Scroll to see more</span>';
      first.appendChild(cue);
    }
  }

  /* ---------- Guides: "In this guide" list in the first screen ---------- */
  var ah = doc.querySelector('.article-hero > .container') || doc.querySelector('body.policy .page-hero > .container');
  var art = doc.querySelector('article') || (doc.body.classList.contains('policy') ? doc.querySelector('main') || doc.body : null);
  if (ah && art && !ah.querySelector('.vch-toc')) {
    var hs = Array.prototype.slice.call(art.querySelectorAll('h2')).filter(function (h) { return !h.closest('footer, .emergency-support-strip, .page-hero, .article-hero'); }).filter(function (h) { return h.textContent.trim().length > 3; }).slice(0, 7);
    if (hs.length >= 3) {
      var nav = doc.createElement('nav');
      nav.className = 'vch-toc';
      nav.setAttribute('aria-label', 'In this guide');
      var html = '<h2>' + (doc.body.classList.contains('policy') ? 'On this page' : 'In this guide') + '</h2><ol>';
      hs.forEach(function (h, i) {
        if (!h.id) h.id = 's-' + h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
        var t = h.textContent.replace(/^\s*\d+[\.\)]\s*/, '').trim();
        html += '<li style="--i:' + i + '"><a href="#' + h.id + '">' + t.replace(/</g, '&lt;') + '</a></li>';
      });
      nav.innerHTML = html + '</ol>';
      var mainCol = doc.createElement('div');
      mainCol.className = 'vch-ah-main';
      while (ah.firstChild) mainCol.appendChild(ah.firstChild);
      ah.appendChild(mainCol);
      ah.appendChild(nav);
      ah.classList.add('has-toc');
    }
  }

  /* ---------- Word rotator (home hero) ---------- */
  doc.querySelectorAll('.vch-rotator').forEach(function (r) {
    var items = r.querySelectorAll('span');
    if (items.length < 2 || reduce) return;
    var i = 0, timer = null;
    var fit = function (el) { r.style.width = Math.ceil(el.getBoundingClientRect().width) + 'px'; };
    items.forEach(function (s) { s.style.whiteSpace = 'nowrap'; s.style.justifySelf = 'start'; });
    fit(items[0]);
    var tick = function () {
      var cur = items[i];
      i = (i + 1) % items.length;
      cur.classList.remove('on'); cur.classList.add('off');
      items[i].classList.remove('off'); items[i].classList.add('on');
      fit(items[i]);
      setTimeout(function () { cur.classList.remove('off'); }, 650);
    };
    var start = function () { if (!timer) timer = setInterval(tick, 2600); };
    var stop = function () { clearInterval(timer); timer = null; };
    setTimeout(start, 1600);
    doc.addEventListener('visibilitychange', function () { doc.hidden ? stop() : start(); });
  });



  /* ---------- Scroll-in animations ---------- */
  (function () {
    if (reduce || !('IntersectionObserver' in window)) return;
    var root = doc.documentElement;
    var heroSel = '.vch-hero, .page-hero, .article-hero, .how-hero, .support-hero, .hero-luton, .vch-thanks, .vch-404-stage, body.car-page section.hero, .vch-scene, .vch-pin';
    var skip = function (el) { return el.closest(heroSel) || el.closest('header, .ticker, .float, #cookieConsent, form, .vch-card'); };
    var marked = [];
    var mark = function (el, kind, i) {
      if (!el || el.hasAttribute('data-rv') || skip(el)) return;
      el.setAttribute('data-rv', kind);
      if (i) el.style.setProperty('--i', Math.min(i, 8));
      marked.push(el);
    };
    doc.querySelectorAll('.reveal, .reveal-stagger').forEach(function (el) { el.classList.add('in'); });
    // 1. Headings rise out of a mask
    doc.querySelectorAll('section h2, .section-head, footer .foot-grid').forEach(function (el) {
      if (el.matches('h2') && el.closest('.section-head')) return;
      mark(el, el.matches('footer .foot-grid') ? 'fade' : 'mask');
    });
    // 2. Card groups: rise one after another
    doc.querySelectorAll('section *').forEach(function (p) {
      var kids = p.children; if (kids.length < 3 || skip(p)) return;
      var cls = kids[0].className; if (!cls || typeof cls !== 'string') return;
      var same = 0; for (var k = 0; k < kids.length; k++) if (kids[k].className === cls) same++;
      if (same >= 3 && same === kids.length && !p.closest('[data-rv]')) {
        for (var j = 0; j < kids.length; j++) mark(kids[j], 'rise', j);
      }
    });
    // 3. Photos wipe open
    doc.querySelectorAll('section img').forEach(function (img) {
      if (img.closest('[data-rv]') || img.width < 160) return;
      var box = img.closest('figure, .car-visual, .hero-img-wrap, .vch-photo') || img;
      mark(box, 'wipe');
    });
    // 4. Intro paragraphs fade
    doc.querySelectorAll('section .lede, section > .container > p').forEach(function (el) { mark(el, 'fade'); });
    if (!marked.length) return;
    root.classList.add('vch-rv');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el);
        el.classList.add('is-in');
        setTimeout(function () { el.removeAttribute('data-rv'); el.classList.remove('is-in'); el.style.removeProperty('--i'); }, 1500 + (parseInt(el.style.getPropertyValue('--i') || 0, 10) * 80));
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    marked.forEach(function (el) { io.observe(el); });
    // Fallback: anything whose top has scrolled into view is shown, even if it sits off to the side (marquees)
    var sweep = function () {
      var vh = window.innerHeight;
      marked.forEach(function (el) {
        if (!el.hasAttribute('data-rv') || el.classList.contains('is-in')) return;
        if (el.getBoundingClientRect().top < vh * 0.94) { io.unobserve(el); el.classList.add('is-in');
          setTimeout(function () { el.removeAttribute('data-rv'); el.classList.remove('is-in'); el.style.removeProperty('--i'); }, 1600); }
      });
    };
    var st = null;
    window.addEventListener('scroll', function () { if (!st) st = setTimeout(function () { st = null; sweep(); }, 120); }, { passive: true });
    setTimeout(sweep, 400);
  })();

  /* ---------- Pinned scroll sections: deck, count, rail ---------- */
  doc.querySelectorAll('.vch-pin').forEach(function (sec) {
    if (reduce) return;
    var type = sec.getAttribute('data-pin');
    var N = parseInt(getComputedStyle(sec).getPropertyValue('--n'), 10) || 1;
    var ticking = false;
    var cards = sec.querySelectorAll('.vch-deck__card');
    var words = sec.querySelector('.vch-deck__words');
    var items = sec.querySelectorAll('.vch-count__list li');
    var numB = sec.querySelector('.vch-count__num b'), numI = sec.querySelector('.vch-count__num i');
    var bar = sec.querySelector('.vch-count__bar i');
    var track = sec.querySelector('.vch-rail__track');
    var tiles = sec.querySelectorAll('.vch-rail__card');
    var lastIdx = -1;
    function size() {
      if (type !== 'rail' || !track) return;
      var extra = Math.max(0, track.scrollWidth - window.innerWidth);
      sec.style.height = (window.innerHeight + extra * 1.15) + 'px';
    }
    function frame() {
      ticking = false;
      var r = sec.getBoundingClientRect();
      var span = Math.max(1, sec.offsetHeight - window.innerHeight);
      var p = Math.min(1, Math.max(0, -r.top / span));
      sec.style.setProperty('--p', p.toFixed(4));
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      var pos = p * N, idx = Math.min(N - 1, Math.floor(pos));
      if (type === 'deck') {
        cards.forEach(function (c, k) {
          var t = Math.min(1, Math.max(0, pos - k + 0.35));          // 0 = waiting below, 1 = landed
          var past = k === N - 1 ? 0 : Math.min(1, Math.max(0, pos - k - 0.65)); // how far it has been covered
          var y = k === 0 ? 0 : (1 - easeOut(t)) * window.innerHeight;
          c.style.setProperty('--y', y.toFixed(1) + 'px');
          c.style.setProperty('--s', (1 - past * 0.07).toFixed(3));
          c.style.setProperty('--op', (1 - past * 0.55).toFixed(3));
        });
        if (words) words.style.setProperty('--idx', idx);
      } else if (type === 'count') {
        var it = items[idx]; if (!it) return;
        var local = Math.min(1, Math.max(0, (pos - idx) * 1.7));
        var to = parseFloat(it.getAttribute('data-to')), dec = parseInt(it.getAttribute('data-dec'), 10) || 0;
        var v = to * easeOut(local);
        numB.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-GB');
        numI.textContent = it.getAttribute('data-suf');
        if (idx !== lastIdx) items.forEach(function (li, k) { li.classList.toggle('is-on', k === idx); });
      } else if (type === 'rail' && track) {
        var extra = Math.max(0, track.scrollWidth - window.innerWidth);
        track.style.setProperty('--tx', (-p * extra).toFixed(1) + 'px');
        var mid = window.innerWidth / 2, best = 0, bd = 1e9;
        tiles.forEach(function (t, k) { var b = t.getBoundingClientRect(); var d = Math.abs(b.left + b.width / 2 - mid); if (d < bd) { bd = d; best = k; } });
        tiles.forEach(function (t, k) { t.classList.toggle('is-on', k === best); });
      }
      lastIdx = idx;
    }
    function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
    size();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { size(); onScroll(); });
    window.addEventListener('load', function () { size(); frame(); });
    frame();
  });
  /* ---------- Pinned scroll scene (home) ---------- */
  doc.querySelectorAll('.vch-scene').forEach(function (sec) {
    if (reduce) return;
    var cars = sec.querySelectorAll('.vch-scene__car');
    var chs = sec.querySelectorAll('.vch-scene__chapter');
    var rail = sec.querySelectorAll('.vch-scene__rail li');
    var N = cars.length, cur = -1, ticking = false;
    function frame() {
      ticking = false;
      var r = sec.getBoundingClientRect();
      var span = sec.offsetHeight - window.innerHeight;
      var p = Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
      sec.style.setProperty('--p', p.toFixed(4));
      var pos = p * N;
      var vw = window.innerWidth;
      cars.forEach(function (c, i) {
        var off = (i + 0.5) - pos;                       // 0 = centred
        var a = Math.min(1, Math.abs(off));
        c.style.setProperty('--x', (off * vw * 0.55).toFixed(1) + 'px');
        c.style.setProperty('--s', (1 - a * 0.12).toFixed(3));
        c.style.setProperty('--o', Math.max(0, 1 - Math.abs(off) * 1.6).toFixed(3));
      });
      var idx = Math.min(N - 1, Math.floor(pos));
      if (idx !== cur) {
        cur = idx;
        chs.forEach(function (c, i) { c.classList.toggle('is-on', i === idx); });
        rail.forEach(function (l, i) { l.classList.toggle('is-on', i === idx); });
      }
      rail.forEach(function (l, i) { l.style.setProperty('--f', Math.min(1, Math.max(0, pos - i)).toFixed(3)); });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    frame();
  });
  /* =========================================================
     vch-flow: one question at a time.
     <form data-flow> with children marked data-step.
       data-q      question text (falls back to the field label)
       data-hint   small line under the question
       data-if     "name=Value A|Value B" — step only shows when matched
     Selects become tappable choices. The last screen reviews the
     answers and submits through the form's own submit handler.
     ========================================================= */
  doc.querySelectorAll('form[data-flow], [data-flow-form] form').forEach(initFlow);

  function initFlow(form) {
    var steps = Array.prototype.slice.call(form.querySelectorAll('[data-step]'));
    if (!steps.length) return;
    var submitBtn = form.querySelector('[type="submit"]');
    var host = form.closest('[data-flow-form]');
    var attr = function (n) { return form.getAttribute(n) || (host && host.getAttribute(n)); };
    var dark = !!attr('data-flow-dark');
    form.classList.add('vch-flow');
    if (dark) form.classList.add('vch-flow--dark');
    form.setAttribute('novalidate', '');

    // Header: progress + back
    var top = doc.createElement('div');
    top.innerHTML =
      '<div class="vch-flow__meta"><button type="button" class="vch-flow__back" hidden><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Back</button>' +
      '<span class="vch-flow__count" aria-live="polite"></span></div>' +
      '<div class="vch-flow__bar" aria-hidden="true"><i></i></div>';
    form.insertBefore(top, form.firstChild);
    var backBtn = top.querySelector('.vch-flow__back');
    var countEl = top.querySelector('.vch-flow__count');
    var barEl = top.querySelector('.vch-flow__bar i');

    // Build each step's question + choices
    steps.forEach(function (st) {
      st.classList.add('vch-step');
      var field = st.querySelector('input:not([type=hidden]), select, textarea');
      var lab = st.querySelector('label');
      var q = st.getAttribute('data-q') || (lab ? lab.textContent.replace('*', '').trim() : '');
      var head = doc.createElement('div');
      var qid = 'q-' + Math.random().toString(36).slice(2, 8);
      head.innerHTML = '<label class="vch-step__q" id="' + qid + '"' + (field && field.id ? ' for="' + field.id + '"' : '') + '></label>' +
        (st.getAttribute('data-hint') ? '<p class="vch-step__hint"></p>' : '');
      head.querySelector('.vch-step__q').textContent = q;
      if (st.getAttribute('data-hint')) head.querySelector('.vch-step__hint').textContent = st.getAttribute('data-hint');
      st.insertBefore(head, st.firstChild);
      if (field) field.setAttribute('aria-labelledby', qid);

      if (field && field.tagName === 'SELECT' && !st.hasAttribute('data-keep-select')) {
        var opts = Array.prototype.slice.call(field.options).filter(function (o) { return o.value; });
        var wrap = doc.createElement('div');
        wrap.className = 'vch-choices' + (opts.length > 6 ? ' is-long' : '');
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-labelledby', qid);
        opts.forEach(function (o, k) {
          var b = doc.createElement('button');
          b.type = 'button'; b.className = 'vch-choice';
          b.setAttribute('aria-pressed', field.value === o.value ? 'true' : 'false');
          b.innerHTML = (k < 9 ? '<kbd>' + (k + 1) + '</kbd>' : '') + '<span></span>';
          b.querySelector('span').textContent = o.text;
          b.addEventListener('click', function () {
            field.value = o.value;
            field.dispatchEvent(new Event('change', { bubbles: true }));
            wrap.querySelectorAll('.vch-choice').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
            setTimeout(function () { go(1); }, reduce ? 0 : 220);
          });
          wrap.appendChild(b);
        });
        field.style.display = 'none';
        field.setAttribute('tabindex', '-1');
        field.setAttribute('aria-hidden', 'true');
        st.appendChild(wrap);
        st.setAttribute('data-choice', '');
      }
    });

    // Review step
    var review = doc.createElement('div');
    review.className = 'vch-step';
    review.innerHTML = '<span class="vch-step__q">' + (attr('data-review') || 'All good? Send it over.') + '</span>' +
      '<p class="vch-step__hint">Check your answers. Tap Change to fix anything.</p><dl class="vch-review"></dl>';
    var statusEl = form.querySelector('#formStatus, .form-status');
    form.appendChild(review);

    // Nav row
    var navRow = doc.createElement('div');
    navRow.className = 'vch-flow__nav';
    navRow.innerHTML = '<button type="button" class="btn btn-primary vch-next">Next <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>' +
      '<span class="vch-flow__enter">or press <kbd>Enter ↵</kbd></span>';
    form.appendChild(navRow);
    var nextBtn = navRow.querySelector('.vch-next');
    var enterHint = navRow.querySelector('.vch-flow__enter');
    var err = doc.createElement('p');
    err.className = 'vch-flow__err'; err.setAttribute('role', 'alert');
    form.appendChild(err);
    if (submitBtn) { navRow.appendChild(submitBtn); }
    if (statusEl) form.appendChild(statusEl);

    var all = steps.concat([review]);
    var idx = 0;

    function active(st) {
      if (st === review) return true;
      var cond = st.getAttribute('data-if');
      if (!cond) return true;
      var parts = cond.split('=');
      var f = form.elements[parts[0]];
      var vals = (parts[1] || '').split('|');
      return f && vals.indexOf(f.value) !== -1;
    }
    function visible() { return all.filter(active); }

    function fieldsOf(st) { return Array.prototype.slice.call(st.querySelectorAll('input:not([type=hidden]):not([name^="_"]), select, textarea')); }

    function validate(st) {
      var fs = fieldsOf(st);
      for (var i = 0; i < fs.length; i++) {
        var f = fs[i];
        if (f.name === '_honey') continue;
        if (f.type === 'email' && f.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.value.trim())) {
          err.textContent = 'That email does not look right. Check for a typo.';
          st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
          f.focus(); return false;
        }
        if (!f.checkValidity()) {
          var msg = f.validity.valueMissing ? (st.hasAttribute('data-choice') ? 'Pick one to carry on.' : 'This one is needed to carry on.')
            : f.validity.typeMismatch && f.type === 'email' ? 'That email does not look right. Check for a typo.'
            : f.validationMessage;
          err.textContent = msg;
          st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
          if (f.style.display !== 'none') f.focus();
          return false;
        }
      }
      err.textContent = '';
      return true;
    }

    function buildReview() {
      var dl = review.querySelector('.vch-review');
      dl.innerHTML = '';
      steps.filter(active).forEach(function (st) {
        fieldsOf(st).forEach(function (f) {
          if (!f.name || f.name.charAt(0) === '_') return;
          var label = f.getAttribute('data-label') || st.getAttribute('data-label') || f.name.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); });
          var v = f.tagName === 'SELECT' && f.selectedIndex > -1 ? f.options[f.selectedIndex].text : f.value;
          var row = doc.createElement('div');
          row.innerHTML = '<dt></dt><dd></dd><button type="button">Change</button>';
          row.querySelector('dt').textContent = label;
          row.querySelector('dd').textContent = v ? (v.length > 140 ? v.slice(0, 140) + '…' : v) : '—';
          row.querySelector('button').addEventListener('click', function () { show(visible().indexOf(st), -1); });
          dl.appendChild(row);
        });
      });
    }

    function show(i, dir) {
      var vis = visible();
      i = Math.max(0, Math.min(i, vis.length - 1));
      all.forEach(function (s) { s.classList.remove('is-on', 'from-back'); });
      var st = vis[i];
      if (st === review) buildReview();
      st.classList.add('is-on');
      if (dir < 0) st.classList.add('from-back');
      idx = i;
      var last = st === review;
      countEl.textContent = last ? 'Last step' : 'Question ' + (i + 1) + ' of ' + (vis.length - 1);
      barEl.style.width = Math.round((i / (vis.length - 1)) * 100) + '%';
      backBtn.hidden = i === 0;
      enterHint.style.display = (last || st.hasAttribute('data-choice') || st.querySelector('textarea')) ? 'none' : '';
      if (submitBtn) submitBtn.style.display = last ? '' : 'none';
      var cf = st.hasAttribute('data-choice') ? fieldsOf(st)[0] : null;
      nextBtn.style.display = last || (cf && cf.required && !cf.value) ? 'none' : '';
      if (cf && !cf.required) nextBtn.innerHTML = (cf.value ? 'Next' : 'Skip') + ' <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
      else nextBtn.innerHTML = 'Next <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
      err.textContent = '';
      var f = fieldsOf(st).filter(function (x) { return x.style.display !== 'none'; })[0];
      if (f && dir !== 0) setTimeout(function () { f.focus({ preventScroll: true }); }, 60);
      else if (st.hasAttribute('data-choice') && dir !== 0) {
        var pressed = st.querySelector('.vch-choice[aria-pressed="true"]') || st.querySelector('.vch-choice');
        if (pressed) setTimeout(function () { pressed.focus({ preventScroll: true }); }, 60);
      }
    }

    function go(d) {
      var vis = visible();
      var st = vis[idx];
      if (d > 0 && !validate(st)) return;
      show(idx + d, d);
    }

    nextBtn.addEventListener('click', function () { go(1); });
    backBtn.addEventListener('click', function () { go(-1); });
    form.addEventListener('keydown', function (e) {
      var st = visible()[idx];
      if (e.key === 'Enter' && st !== review) {
        if (e.target.tagName === 'TEXTAREA' && !(e.metaKey || e.ctrlKey)) return;
        if (e.target.classList.contains('vch-choice')) return;
        e.preventDefault(); go(1);
      } else if (/^[1-9]$/.test(e.key) && st.hasAttribute('data-choice') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        var c = st.querySelectorAll('.vch-choice')[+e.key - 1];
        if (c) { e.preventDefault(); c.click(); }
      }
    });
    // Guard: a submit from any step but the last moves forward instead.
    form.addEventListener('submit', function (e) {
      if (visible()[idx] !== review) { e.preventDefault(); e.stopImmediatePropagation(); go(1); return; }
      // Remember who wrote, so the thank-you page can greet them (this tab only)
      try {
        var n = form.elements.name ? form.elements.name.value : ((form.elements.firstName || {}).value || '');
        var v = form.elements.vehicle ? form.elements.vehicle.value : ((form.elements.car || {}).value || '');
        sessionStorage.setItem('vch-enquiry', JSON.stringify({ name: n, vehicle: v }));
      } catch (er) {}
    }, true);
    // A form that resets (WhatsApp "edit") goes back to the start.
    form.addEventListener('vch-flow-reset', function () { show(0, 0); });
    form.querySelectorAll('#editEnquiry, #editEmergency, .edit-link').forEach(function (b) {
      b.addEventListener('click', function () { setTimeout(function () { show(0, -1); }, 0); });
    });
    // Hide the flow chrome while a success panel is showing
    new MutationObserver(function () { form.classList.toggle('vch-done', form.classList.contains('is-complete')); }).observe(form, { attributes: true, attributeFilter: ['class'] });

    show(0, 0);
  }
})();
