/* «Тю і Шо» — рух і поведінка в стилі iOS: великий заголовок, що стискається в скляну панель,
   «крапля» вибору в перемикачах, що перетікає, поява карток каскадом, відгук на натискання.
   Підключається на всіх сторінках. Поважає «Зменшити рух». */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    document.documentElement.classList.add('motion-ready');

    /* ---------- великий заголовок → компактна скляна панель ---------- */
    const h1 = document.querySelector('header h1');
    if (h1) {
      const bar = document.createElement('div');
      bar.className = 'navbar'; bar.setAttribute('aria-hidden', 'true');
      bar.innerHTML = '<span></span>';
      document.body.appendChild(bar);
      const sync = () => { bar.firstChild.textContent = h1.textContent; };
      sync(); new MutationObserver(sync).observe(h1, { childList: true, characterData: true, subtree: true });
      let ticking = false, lastK = -1;
      const onScroll = () => {
        if (ticking) return; ticking = true;
        requestAnimationFrame(() => {
          const y = Math.max(0, scrollY);
          const on = y > 44; if (on !== lastK) { lastK = on; document.body.classList.toggle('scrolled', on); }
          ticking = false;
        });
      };
      addEventListener('scroll', onScroll, { passive: true }); onScroll();
      bar.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
      bar.style.pointerEvents = 'auto';
    }

    /* ---------- «крапля» вибору + ефект лінзи при перетягуванні ---------- */
    const GROUPS = '.seg, .tabbar nav';
    const ITEM = 'button, a';
    const selOf = g => g.querySelector('button[aria-pressed="true"], a[aria-current="page"]');
    const last = new Map();
    const keyG = g => g.id || g.getAttribute('aria-label') || '';
    function indOf(g) {
      let ind = g.querySelector(':scope > .seg-ind');
      if (!ind) { ind = document.createElement('span'); ind.className = 'seg-ind'; ind.setAttribute('aria-hidden', 'true'); g.insertBefore(ind, g.firstChild); }
      return ind;
    }
    const setInd = (ind, p, sx = 1, sy = 1) => {
      ind.style.width = p.w + 'px'; ind.style.height = p.h + 'px';
      ind.style.setProperty('--x', p.x + 'px'); ind.style.setProperty('--y', p.y + 'px');
      ind.style.setProperty('--sx', sx); ind.style.setProperty('--sy', sy);
    };
    const rectIn = (g, el) => { const gr = g.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - gr.left, y: r.top - gr.top, w: r.width, h: r.height }; };
    function placeInd(g) {
      if (g.classList.contains('lensing')) return;
      const on = selOf(g);
      if (!on) { const i = g.querySelector(':scope > .seg-ind'); if (i) i.remove(); g.classList.remove('has-ind'); return; }
      const ind = indOf(g), pos = rectIn(g, on);
      if (!pos.w) return;
      const prev = last.get(keyG(g));
      if (prev && !ind.dataset.placed && !reduce) { ind.style.transition = 'none'; setInd(ind, prev); ind.getBoundingClientRect(); ind.style.transition = ''; }
      ind.dataset.placed = '1';
      requestAnimationFrame(() => setInd(ind, pos));
      last.set(keyG(g), pos);
      g.classList.add('has-ind');
    }
    const segs = () => document.querySelectorAll(GROUPS);
    const refreshSegs = () => segs().forEach(placeInd);

    /* перетягування пальцем — лінза */
    document.querySelectorAll('.tabbar a').forEach(a => a.setAttribute('draggable', 'false'));
    document.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest(GROUPS)) e.preventDefault(); });
    let drag = null, pending = null;
    document.addEventListener('pointerdown', e => {
      const g = e.target.closest(GROUPS); if (!g || e.button > 0) return;
      const items = [...g.querySelectorAll(ITEM)].filter(x => !x.classList.contains('seg-ind'));
      if (items.length < 2) return;
      drag = { g, items, x0: e.clientX, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false, id: e.pointerId, under: null };
      g.classList.add('lensing');
      moveLens(e.clientX);
    });
    function nearest(d, cx) {
      let best = d.items[0], bd = Infinity;
      d.items.forEach(it => { const r = it.getBoundingClientRect(); const dd = Math.abs(r.left + r.width / 2 - cx); if (dd < bd) { bd = dd; best = it; } });
      return best;
    }
    function moveLens(cx) {
      const d = drag; if (!d) return;
      const g = d.g, gr = g.getBoundingClientRect(), near = nearest(d, cx), nr = rectIn(g, near);
      const w = nr.w, x = Math.max(0, Math.min(gr.width - w, cx - gr.left - w / 2));
      const st = reduce ? 0 : Math.min(0.28, Math.abs(d.v) * 0.18);
      setInd(indOf(g), { x, y: nr.y, w, h: nr.h }, reduce ? 1 : 1.12 + st, reduce ? 1 : 1.12 - st * 0.45);
      if (d.under !== near) { if (d.under) d.under.classList.remove('lens-under'); near.classList.add('lens-under'); d.under = near; }
      g.classList.add('has-ind');
    }
    document.addEventListener('pointermove', e => {
      const d = drag; if (!d || e.pointerId !== d.id) return;
      const now = performance.now(), dt = Math.max(1, now - d.lastT);
      d.v = d.v * 0.6 + ((e.clientX - d.lastX) / dt) * 0.4; d.lastX = e.clientX; d.lastT = now;
      if (Math.abs(e.clientX - d.x0) > 6) d.moved = true;
      moveLens(e.clientX);
    });
    function endDrag(e, cancel) {
      const d = drag; if (!d || (e && e.pointerId !== d.id)) return; drag = null;
      if (d.under) d.under.classList.remove('lens-under');
      const target = !cancel && d.moved ? nearest(d, d.lastX) : null;
      const g = d.g;
      requestAnimationFrame(() => { g.classList.remove('lensing'); placeInd(g); });
      if (target) {
        pending = target;
        setTimeout(() => { if (pending === target) { pending = null; if (selOf(g) !== target) target.click(); } }, 60);
      }
    }
    document.addEventListener('pointerup', e => endDrag(e, false));
    document.addEventListener('pointercancel', e => endDrag(e, true));
    document.addEventListener('click', e => {
      if (!pending) return;
      if (!e.target.closest(GROUPS)) return;
      const t = pending; pending = null;
      if (e.target.closest(ITEM) === t) return;   // клік і так по потрібній кнопці
      e.preventDefault(); e.stopPropagation();
      if (selOf(t.closest(GROUPS)) !== t) t.click();
    }, true);

    const reveal = () => {};

    /* ---------- спостереження за перемальовуванням ---------- */
    let segT;
    new MutationObserver(muts => {
      let segTouched = false;
      muts.forEach(m => {
        const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (t && t.closest && t.closest(GROUPS)) segTouched = true;
        if (m.type === 'childList') m.addedNodes.forEach(n => { if (n.nodeType === 1) { reveal(n); if (!segTouched && n.querySelector && (n.matches(GROUPS) || n.querySelector(GROUPS))) segTouched = true; } });
      });
      if (segTouched) { clearTimeout(segT); segT = setTimeout(refreshSegs, 16); }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    addEventListener('resize', () => { last.clear(); segs().forEach(x => { const i = x.querySelector('.seg-ind'); if (i) delete i.dataset.placed; }); refreshSegs(); });
    refreshSegs();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshSegs);

    /* ---------- легкий «тактильний» відгук ---------- */
    document.addEventListener('click', e => {
      const b = e.target.closest('.check, .add, .pep button, [data-watch]');
      if (b && navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
      if (b && !reduce) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
