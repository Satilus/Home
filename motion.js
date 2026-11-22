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
      let ticking = false;
      const onScroll = () => {
        if (ticking) return; ticking = true;
        requestAnimationFrame(() => {
          const y = Math.max(0, scrollY);
          document.body.classList.toggle('scrolled', y > 44);
          if (!reduce) { const k = Math.min(1, y / 60); h1.style.transform = `scale(${1 - k * 0.06})`; h1.style.opacity = String(1 - k * 0.9); }
          ticking = false;
        });
      };
      addEventListener('scroll', onScroll, { passive: true }); onScroll();
      bar.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
      bar.style.pointerEvents = 'auto';
    }

    /* ---------- «крапля» вибору в сегментованих перемикачах ---------- */
    const last = new Map();
    function placeInd(seg) {
      const on = seg.querySelector('button[aria-pressed="true"]');
      let ind = seg.querySelector(':scope > .seg-ind');
      if (!on) { if (ind) ind.remove(); return; }
      if (!ind) { ind = document.createElement('span'); ind.className = 'seg-ind'; ind.setAttribute('aria-hidden', 'true'); seg.insertBefore(ind, seg.firstChild); }
      const sr = seg.getBoundingClientRect(), br = on.getBoundingClientRect();
      if (!br.width) return;
      const pos = { x: br.left - sr.left, y: br.top - sr.top, w: br.width, h: br.height };
      const key = seg.id || seg.getAttribute('aria-label') || '';
      const prev = last.get(key);
      const apply = p => { ind.style.width = p.w + 'px'; ind.style.height = p.h + 'px'; ind.style.transform = `translate(${p.x}px,${p.y}px)`; };
      if (prev && !ind.dataset.placed && !reduce) {
        ind.style.transition = 'none'; apply(prev); ind.getBoundingClientRect();
        ind.style.transition = '';
      }
      ind.dataset.placed = '1';
      requestAnimationFrame(() => apply(pos));
      last.set(key, pos);
      seg.classList.add('has-ind');
    }
    const segs = () => document.querySelectorAll('.seg');
    const refreshSegs = () => segs().forEach(placeInd);

    /* ---------- поява карток каскадом (лише нові, без повторів при перемальовуванні) ---------- */
    const seen = new Set();
    const SEL = '.item, .card, .pick, .quote, .stats, .box, h2.sec, .empty';
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      let i = 0;
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target; io.unobserve(el);
        el.style.animationDelay = Math.min(i++ * 45, 360) + 'ms';
        el.classList.add('rv-in');
      });
    }, { rootMargin: '0px 0px -6% 0px' }) : null;
    function keyOf(el) {
      const b = el.matches('[data-open]') ? el : el.querySelector('[data-open],[data-add],a[href]');
      return b ? (b.dataset.open || b.dataset.add || b.getAttribute('href')) + '|' + (el.closest('#news') ? 'n' : '') : null;
    }
    function reveal(root) {
      if (reduce || !io) return;
      (root.matches && root.matches(SEL) ? [root] : []).concat([...(root.querySelectorAll ? root.querySelectorAll(SEL) : [])]).forEach(el => {
        if (el.closest('.sheet, #splash, .syncov') || el.classList.contains('rv')) return;
        const k = keyOf(el);
        if (k && seen.has(k)) return;
        if (k) seen.add(k);
        el.classList.add('rv'); io.observe(el);
      });
    }
    reveal(document.body);

    /* ---------- спостереження за перемальовуванням ---------- */
    let segT;
    new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) reveal(n); }));
      clearTimeout(segT); segT = setTimeout(refreshSegs, 0);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    addEventListener('resize', () => { last.clear(); segs().forEach(s => { const i = s.querySelector('.seg-ind'); if (i) delete i.dataset.placed; }); refreshSegs(); });
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
