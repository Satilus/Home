/* «Тю і Шо» — спільне для всіх сторінок: резервна копія, синхронізація через GitHub Gist, PWA.
   Токен GitHub вводить користувач; він зберігається лише в цьому браузері й ніколи не потрапляє в копію чи Gist. */
(function () {
  'use strict';
  const FILE = 'tyuisho.json';
  const PREFIXES = ['lists.', 'coins.', 'cams.'];
  /* кеші та ключі — не синхронізуємо */
  const SKIP = new Set(['lists.meta', 'lists.extras', 'lists.tmdb', 'lists.cachev', 'coins.wikiRows', 'coins.autoTried', 'cams.autoTried']);
  const isData = k => PREFIXES.some(p => k.startsWith(p)) && !SKIP.has(k);
  const ls = window.localStorage;
  const get = (k, d) => { try { const v = ls.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => { try { origSet.call(ls, k, JSON.stringify(v)); } catch (e) {} };

  /* ---- відстеження змін ---- */
  const origSet = Storage.prototype.setItem;
  let pushT = null, applying = false;
  Storage.prototype.setItem = function (k, v) {
    const old = this === ls ? this.getItem(k) : null;
    origSet.call(this, k, v);
    if (this === ls && !applying && isData(k) && old !== null && old !== v) {
      put('sync.dirty', Date.now());
      if (cfg().token) { clearTimeout(pushT); pushT = setTimeout(() => push().catch(() => {}), 4000); }
    }
  };

  function snapshot() {
    const data = {};
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (isData(k)) data[k] = ls.getItem(k); }
    return { app: 'tyuisho', version: 1, updated: Date.now(), data };
  }
  function apply(snap) {
    if (!snap || snap.app !== 'tyuisho' || !snap.data) throw new Error('Це не файл «Тю і Шо»');
    applying = true;
    try {
      const keys = []; for (let i = 0; i < ls.length; i++) keys.push(ls.key(i));
      keys.filter(isData).forEach(k => ls.removeItem(k));
      Object.entries(snap.data).forEach(([k, v]) => { if (isData(k)) origSet.call(ls, k, v); });
      /* після відновлення — перепідбір метаданих */
      ls.removeItem('lists.meta'); ls.removeItem('lists.extras');
    } finally { applying = false; }
  }

  /* ---- GitHub Gist ---- */
  const cfg = () => get('sync.cfg', {});
  const gh = async (path, opt = {}) => {
    const r = await fetch('https://api.github.com' + path, Object.assign({}, opt, {
      headers: Object.assign({ Authorization: 'Bearer ' + cfg().token, Accept: 'application/vnd.github+json' }, opt.body ? { 'Content-Type': 'application/json' } : {})
    }));
    if (r.status === 401) throw new Error('Токен не підходить або протермінований');
    if (r.status === 404) throw new Error('Gist не знайдено (перевір, що токен має доступ «gist»)');
    if (!r.ok) throw new Error('GitHub відповів ' + r.status);
    return r.json();
  };
  async function findGist() {
    const c = cfg(); if (c.gist) return c.gist;
    for (let page = 1; page <= 5; page++) {
      const list = await gh('/gists?per_page=100&page=' + page);
      const g = list.find(x => x.files && x.files[FILE]);
      if (g) { put('sync.cfg', Object.assign(cfg(), { gist: g.id })); return g.id; }
      if (list.length < 100) break;
    }
    return null;
  }
  async function pull() {
    const id = await findGist(); if (!id) return null;
    const g = await gh('/gists/' + id);
    const f = g.files[FILE]; if (!f) return null;
    const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    return JSON.parse(text);
  }
  async function push() {
    const snap = snapshot();
    const body = JSON.stringify({ description: 'Тю і Шо — дані сайту (не видаляти)', files: { [FILE]: { content: JSON.stringify(snap) } } });
    let id = await findGist();
    if (id) await gh('/gists/' + id, { method: 'PATCH', body });
    else { const g = await gh('/gists', { method: 'POST', body: JSON.stringify(Object.assign(JSON.parse(body), { public: false })) }); id = g.id; put('sync.cfg', Object.assign(cfg(), { gist: id })); }
    put('sync.last', snap.updated); ls.removeItem('sync.dirty');
    status('Збережено в хмарі');
    return snap.updated;
  }
  /* при відкритті сторінки: забрати новіше з хмари */
  async function syncOnLoad() {
    if (!cfg().token) return;
    try {
      const remote = await pull();
      const last = get('sync.last', 0), dirty = get('sync.dirty', 0);
      if (!remote) { await push(); return; }
      if (remote.updated > last) {
        if (dirty && !confirm('На іншому пристрої є новіші зміни, а тут — свої незбережені. Взяти дані з хмари? (Скасувати — залишити ці й перезаписати хмару)')) { await push(); return; }
        apply(remote); put('sync.last', remote.updated); ls.removeItem('sync.dirty');
        sessionStorage.setItem('sync.reloaded', '1'); location.reload();
      } else if (dirty) await push();
    } catch (e) { status('Синхронізація: ' + e.message); }
  }

  /* ---- інтерфейс ---- */
  const CSS = `
  .syncov{position:fixed;inset:0;z-index:40;display:flex;align-items:flex-end;justify-content:center}
  .syncov[hidden]{display:none}
  .syncov .bg{position:absolute;inset:0;border:0;background:rgba(0,0,0,.38)}
  .syncov .sh{position:relative;width:100%;max-width:640px;max-height:92vh;overflow-y:auto;border-radius:22px 22px 0 0;background:var(--sheet,#F2F2F7);color:var(--ink,#000);padding:14px 18px calc(28px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px}
  .syncov h2{margin:0;font-size:22px;font-weight:800}
  .syncov .hd{display:flex;justify-content:space-between;align-items:center}
  .syncov .x{border:0;background:transparent;color:var(--tint,#E0261C);font-weight:700;font-size:16px;min-height:44px}
  .syncov .bx{background:var(--card,#fff);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
  .syncov .bx h3{margin:0;font-size:13px;font-weight:600;text-transform:uppercase;color:var(--muted,#6C6C70)}
  .syncov p{margin:0;font-size:14px;color:var(--ink2,#3A3A3C);line-height:1.45}
  .syncov .b{min-height:44px;border:0;border-radius:12px;background:var(--fill,#EFEFF4);font-weight:700;font-size:15px;color:var(--ink,#000)}
  .syncov .b.go{background:var(--tint,#E0261C);color:#fff}
  .syncov input{min-height:44px;border:0;border-radius:10px;background:var(--fill,#EFEFF4);padding:0 12px;font:inherit;color:inherit;width:100%}
  .syncov .st{font-size:13px;color:var(--muted,#6C6C70)}
  .syncov a{color:var(--tint,#E0261C)}
  .syncbtn{width:44px;height:44px;border:0;background:transparent;color:var(--tint,#E0261C);display:inline-flex;align-items:center;justify-content:center;border-radius:22px;position:relative}
  .syncbtn[data-dirty]::after{content:"";position:absolute;top:10px;right:9px;width:8px;height:8px;border-radius:4px;background:var(--star,#FF9F0A)}`;
  const ICON = '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9a4 4 0 0 1 0 9z"/><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5"/></svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => t ? new Date(t).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'ще ні разу';
  let ov;
  function status(t) { const el = document.getElementById('syncSt'); if (el) el.textContent = t; mark(); }
  function mark() { const b = document.getElementById('syncBtn'); if (b) { if (get('sync.dirty', 0) && !cfg().token) b.setAttribute('data-dirty', ''); else b.removeAttribute('data-dirty'); } }

  function counts() {
    const n = (k, f) => (get(k, []) || []).filter(f || (() => true)).length;
    return `${n('lists.items')} у Кінотеатрі · ${n('coins.items', i => i.status === 'have')} монет · ${n('cams.items', i => i.status === 'have')} фотоапаратів`;
  }
  function render() {
    const c = cfg();
    ov.querySelector('.sh').innerHTML = `
      <div class="hd"><h2>Дані</h2><button class="x" data-x>Готово</button></div>
      <p class="st">${esc(counts())}</p>
      <div class="bx"><h3>Резервна копія</h3>
        <p>Увесь вміст сайту (Кінотеатр, монети, фотоапарати) в одному файлі. Ключі й токени в копію не потрапляють.</p>
        <button class="b go" data-exp>Завантажити копію</button>
        <button class="b" data-imp>Відновити з файлу…</button>
        <input type="file" accept="application/json,.json" data-file hidden>
      </div>
      <div class="bx"><h3>Синхронізація між пристроями</h3>
        ${c.token ? `<p>Увімкнено. Зміни зберігаються в приватний Gist на твоєму GitHub і підтягуються на інших пристроях при відкритті сторінки.</p>
          <p class="st">Остання синхронізація: ${esc(fmt(get('sync.last', 0)))}</p>
          <button class="b go" data-now>Синхронізувати зараз</button>
          <button class="b" data-off>Вимкнути на цьому пристрої</button>`
        : `<p>Дані зберігатимуться в приватному Gist на твоєму GitHub. Потрібен токен з доступом лише до Gist: <a href="https://github.com/settings/tokens/new?scopes=gist&description=%D0%A2%D1%8E%20%D1%96%20%D0%A8%D0%BE" target="_blank" rel="noopener">створити токен</a> (позначка «gist», термін — на твій вибір). Встав його тут на кожному пристрої — дані зійдуться самі.</p>
          <input type="password" autocomplete="off" placeholder="ghp_… або github_pat_…" data-tok>
          <button class="b go" data-on>Увімкнути</button>`}
        <p class="st" id="syncSt"></p>
      </div>
      <div class="bx"><h3>Застосунок</h3>
        <p>Сайт можна встановити на екран телефону: у Safari — «Поділитися» → «На екран Додому»; у Chrome — меню ⋮ → «Встановити застосунок». Відкриватиметься без панелей браузера й працюватиме без інтернету.</p>
        ${deferredInstall ? '<button class="b go" data-inst>Встановити</button>' : ''}
      </div>`;
  }
  function open() { render(); ov.hidden = false; }
  function close() { ov.hidden = true; }
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });

  function download() {
    const blob = new Blob([JSON.stringify(snapshot(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tyu-i-sho-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    put('sync.lastBackup', Date.now()); ls.removeItem('sync.dirtyBackup');
  }

  function init() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    ov = document.createElement('div'); ov.className = 'syncov'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Дані');
    ov.innerHTML = '<button class="bg" data-x aria-label="Закрити"></button><div class="sh"></div>';
    document.body.appendChild(ov);
    const hdr = document.querySelector('header');
    if (hdr) {
      const b = document.createElement('button'); b.className = 'syncbtn'; b.id = 'syncBtn';
      b.setAttribute('aria-label', 'Резервна копія і синхронізація'); b.innerHTML = ICON; b.onclick = open;
      const last = hdr.lastElementChild;
      if (last && last.tagName === 'DIV' && last.querySelector('button')) last.insertBefore(b, last.firstChild);
      else { const wrap = document.createElement('div'); hdr.appendChild(wrap); wrap.appendChild(b); if (last && last.tagName === 'BUTTON') wrap.appendChild(last); }
    }
    mark();
    ov.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.x !== undefined) close();
      else if (b.dataset.exp !== undefined) download();
      else if (b.dataset.imp !== undefined) ov.querySelector('[data-file]').click();
      else if (b.dataset.on !== undefined) {
        const t = ov.querySelector('[data-tok]').value.trim(); if (!t) return;
        put('sync.cfg', { token: t }); status('Підключаюсь…'); b.disabled = true;
        try {
          const remote = await pull();
          if (remote && remote.updated && confirm('У хмарі вже є дані від ' + fmt(remote.updated) + '. Взяти їх на цей пристрій? (Скасувати — записати в хмару дані з цього пристрою)')) {
            apply(remote); put('sync.last', remote.updated); ls.removeItem('sync.dirty'); location.reload(); return;
          }
          await push(); render(); status('Синхронізацію увімкнено');
        } catch (err) { ls.removeItem('sync.cfg'); render(); status(err.message); }
      }
      else if (b.dataset.now !== undefined) {
        b.disabled = true; status('Синхронізую…');
        try {
          const remote = await pull();
          if (remote && remote.updated > get('sync.last', 0) && !get('sync.dirty', 0)) { apply(remote); put('sync.last', remote.updated); location.reload(); return; }
          await push(); render(); status('Готово');
        } catch (err) { status(err.message); b.disabled = false; }
      }
      else if (b.dataset.off !== undefined) { ls.removeItem('sync.cfg'); render(); status('Вимкнено. Дані на цьому пристрої залишились.'); }
      else if (b.dataset.inst !== undefined && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; render(); }
    });
    ov.querySelector('.sh').addEventListener('change', async e => {
      if (!e.target.matches('[data-file]')) return;
      const f = e.target.files[0]; if (!f) return;
      try {
        const snap = JSON.parse(await f.text());
        if (!confirm('Замінити всі дані на сайті даними з копії від ' + fmt(snap.updated) + '?')) return;
        apply(snap); put('sync.dirty', Date.now());
        if (cfg().token) await push().catch(() => {});
        location.reload();
      } catch (err) { status('Не вдалося відновити: ' + err.message); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) close(); });
    if (!sessionStorage.getItem('sync.reloaded')) syncOnLoad(); else sessionStorage.removeItem('sync.reloaded');
    /* перед закриттям — встигнути відправити */
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pushT && cfg().token) { clearTimeout(pushT); pushT = null; push().catch(() => {}); } });
  }

  /* ---- PWA ---- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
