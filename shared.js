/* «Тю і Шо глянемо» — спільне для всіх сторінок (Головна, Кінотеатр): резервна копія, синхронізація через GitHub Gist, PWA.
   Токен GitHub вводить користувач; він зберігається лише в цьому браузері й ніколи не потрапляє в копію чи Gist. */
(function () {
  'use strict';
  /* ---- захист від вбудовування в чужі сторінки (клікджекінг) ---- */
  if (window.top !== window.self) { document.documentElement.style.display = 'none'; try { window.top.location = window.self.location.href; } catch (e) {} }

  /* ---- картинки без вбудованих обробників (для CSP): data-ok, data-rm, data-rmp, data-minw ---- */
  document.addEventListener('load', e => {
    const t = e.target; if (!t || t.tagName !== 'IMG') return;
    if (t.dataset.minw && t.naturalWidth && t.naturalWidth < Number(t.dataset.minw)) { if (t.parentNode) t.parentNode.remove(); return; }
    if ('ok' in t.dataset) t.classList.add('ok');
  }, true);
  document.addEventListener('error', e => {
    const t = e.target; if (!t || t.tagName !== 'IMG') return;
    if ('rmp' in t.dataset) { if (t.parentNode) t.parentNode.remove(); } else if ('rm' in t.dataset) t.remove();
  }, true);
  /* безпечні посилання з даних: лише https */
  window.safeUrl = u => /^https:\/\//i.test(String(u || '')) ? String(u) : '';

  const FILE = 'tyuisho.json';
  const PREFIXES = ['lists.'];
  /* кеші та ключі — не синхронізуємо */
  const SKIP = new Set(['lists.meta', 'lists.extras', 'lists.more', 'lists.cols', 'lists.epcache', 'lists.tmdb', 'lists.cachev']);
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
    if (!snap || snap.app !== 'tyuisho' || !snap.data) throw new Error('Це не файл «Тю і Шо глянемо»');
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
  /* попередження, якщо токен має більше прав, ніж потрібно (класичні токени повідомляють їх у X-OAuth-Scopes) */
  async function checkScopes() {
    try {
      const r = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + cfg().token, Accept: 'application/vnd.github+json' } });
      const sc = (r.headers.get('X-OAuth-Scopes') || '').split(',').map(x => x.trim()).filter(Boolean);
      const extra = sc.filter(x => x !== 'gist');
      put('sync.scopes', extra);
      if (extra.length) status('⚠️ Токен має зайві права: ' + extra.join(', ') + '. Для безпеки створи новий лише з «gist» і заміни.');
    } catch (e) {}
  }
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
    const body = JSON.stringify({ description: 'Тю і Шо глянемо — дані сайту (не видаляти)', files: { [FILE]: { content: JSON.stringify(snap) } } });
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
  .bk-remind{display:flex;align-items:center;gap:12px;margin:0 0 12px;padding:12px 14px;border-radius:20px;background:var(--glass,var(--card));border:.5px solid var(--glass-edge,transparent);box-shadow:inset 0 1px 0 var(--glass-hi,transparent),0 8px 24px rgba(0,0,0,.08);animation:bkIn .55s cubic-bezier(.32,.72,0,1) both;transition:opacity .35s,transform .35s}\n  .bk-remind.bk-out{opacity:0;transform:translateY(-10px) scale(.97)}\n  @keyframes bkIn{from{opacity:0;transform:translateY(-12px) scale(.97)}}\n  .bk-e{font-size:26px}.bk-t{flex:1;display:flex;flex-direction:column}.bk-t b{font-size:15px}.bk-t small{font-size:12px;color:var(--muted,#6C6C70);line-height:1.35}\n  .bk-b{display:flex;flex-direction:column;gap:6px}.bk-b button{min-height:32px;padding:0 12px;border:0;border-radius:999px;font:600 13px -apple-system,system-ui,sans-serif;background:var(--fill,#EFEFF4);color:var(--ink,#000)}.bk-b button:first-child{background:var(--tint,#E0261C);color:#fff}\n  .syncbtn[data-dirty]::after{content:"";position:absolute;top:10px;right:9px;width:8px;height:8px;border-radius:4px;background:var(--star,#FF9F0A)}`;
  const ICON = '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9a4 4 0 0 1 0 9z"/><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5"/></svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => t ? new Date(t).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'ще ні разу';
  let ov;
  function status(t) { const el = document.getElementById('syncSt'); if (el) el.textContent = t; mark(); }
  function mark() { const b = document.getElementById('syncBtn'); if (b) { if (get('sync.dirty', 0) && !cfg().token) b.setAttribute('data-dirty', ''); else b.removeAttribute('data-dirty'); } }

  function counts() {
    const n = (k, f) => (get(k, []) || []).filter(f || (() => true)).length;
    return `${n('lists.items')} у Кінотеатрі · ${n('lists.items', i => i.status === 'watched')} переглянуто`;
  }
  function render() {
    const c = cfg();
    ov.querySelector('.sh').innerHTML = `
      <div class="hd"><h2>Дані</h2><button class="x" data-x>Готово</button></div>
      <p class="st">${esc(counts())}</p>
      <div class="bx"><h3>Резервна копія</h3>
        <p>Увесь Кінотеатр в одному файлі: списки, статуси, перчики, нотатки. Ключі й токени в копію не потрапляють.</p>
        <button class="b go" data-exp>Завантажити копію</button>
        <button class="b" data-imp>Відновити з файлу…</button>
        <input type="file" accept="application/json,.json" data-file hidden>
      </div>
      <div class="bx"><h3>Синхронізація між пристроями</h3>
        ${c.token ? `<p>Увімкнено. Зміни зберігаються в приватний Gist на твоєму GitHub і підтягуються на інших пристроях при відкритті сторінки.</p>
          <p class="st">Остання синхронізація: ${esc(fmt(get('sync.last', 0)))}</p>
          <button class="b go" data-now>Синхронізувати зараз</button>
          <button class="b" data-off>Вимкнути й забути токен на цьому пристрої</button>${(get('sync.scopes', []) || []).length ? `<p class="st" style="color:var(--tint,#E0261C)">⚠️ Токен має зайві права (${esc(get('sync.scopes', []).join(', '))}). Створи новий лише з доступом «gist» і підключи його замість цього.</p>` : ''}`
        : `<p>Дані зберігатимуться в приватному Gist на твоєму GitHub. Потрібен токен з доступом лише до Gist: <a href="https://github.com/settings/tokens/new?scopes=gist&description=%D0%A2%D1%8E%20%D1%96%20%D0%A8%D0%BE" target="_blank" rel="noopener">створити токен</a> (лише позначка «gist» і обмежений термін дії, наприклад рік). Або fine-grained токен із єдиним правом «Gists: Read and write». Встав його тут на кожному пристрої — дані зійдуться самі. Токен зберігається лише в цьому браузері; нікому його не пересилай.</p>
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
    a.download = 'tyu-i-sho-hlianemo-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    put('sync.lastBackup', Date.now()); ls.removeItem('sync.dirtyBackup');
  }



  /* ---- push-сповіщення про нові серії ----
     Ключі VAPID створюються в браузері й зберігаються лише в lists.push (синхронізується у твій приватний Gist).
     Надсилає сповіщення GitHub Actions (.github/workflows/new-episodes.yml) з секретом GIST_TOKEN. */
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64u = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  async function pushStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { ok: false, why: /iPhone|iPad/.test(navigator.userAgent) && !standalone() ? 'install' : 'unsupported' };
    if (/iPhone|iPad/.test(navigator.userAgent) && !standalone()) return { ok: false, why: 'install' };
    const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription();
    return { ok: true, on: !!sub && Notification.permission === 'granted', perm: Notification.permission, sync: !!cfg().token };
  }
  async function pushEnable() {
    if (!cfg().token) throw new Error('Спершу увімкни синхронізацію в «Дані» — через неї сповіщення дізнаються, що ти дивишся.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Дозвіл на сповіщення не надано. Його можна ввімкнути в Параметрах iPhone → Сповіщення.');
    const data = get('lists.push', {}) || {};
    if (!data.vapid) {
      const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
      data.vapid = { pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), d: (await crypto.subtle.exportKey('jwk', kp.privateKey)).d };
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options && sub.options.applicationServerKey && b64u(sub.options.applicationServerKey) !== data.vapid.pub) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(data.vapid.pub) });
    const j = sub.toJSON();
    data.subs = (data.subs || []).filter(x => x.endpoint !== j.endpoint).concat([{ endpoint: j.endpoint, keys: j.keys, ua: navigator.userAgent.slice(0, 60), at: Date.now() }]);
    data.on = true;
    origSet.call(ls, 'lists.push', JSON.stringify(data)); put('sync.dirty', Date.now());
    await push();
    return true;
  }
  async function pushDisable() {
    const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription();
    const data = get('lists.push', {}) || {};
    if (sub) { data.subs = (data.subs || []).filter(x => x.endpoint !== sub.endpoint); await sub.unsubscribe().catch(() => {}); }
    origSet.call(ls, 'lists.push', JSON.stringify(data)); put('sync.dirty', Date.now());
    if (cfg().token) await push().catch(() => {});
  }
  window.TyuPush = { status: pushStatus, enable: pushEnable, disable: pushDisable };

  /* ---- нагадування про резервну копію (якщо синхронізація вимкнена) ---- */
  function backupReminder() {
    if (cfg().token || !/(\/|index\.html)$/.test(location.pathname)) return;
    if (!ls.getItem('lists.items')) return;
    const now = Date.now(), last = get('sync.lastBackup', 0), rem = get('sync.remind', 0);
    if (now - last < 7 * 864e5 || now - rem < 864e5) return;
    const hdr = document.querySelector('header'); if (!hdr) return;
    const b = document.createElement('div'); b.className = 'bk-remind'; b.setAttribute('role', 'status');
    b.innerHTML = `<span class="bk-e">💾</span><span class="bk-t"><b>${last ? 'Тиждень без резервної копії' : 'Ще не було резервної копії'}</b><small>Збережи файл — і списки не загубляться. Або увімкни синхронізацію в «Дані».</small></span><span class="bk-b"><button data-bk="save">Зберегти</button><button data-bk="later" aria-label="Нагадати пізніше">Пізніше</button></span>`;
    hdr.insertAdjacentElement('afterend', b);
    b.addEventListener('click', e => { const k = e.target.closest('[data-bk]'); if (!k) return;
      if (k.dataset.bk === 'save') download(); else put('sync.remind', Date.now());
      b.classList.add('bk-out'); setTimeout(() => b.remove(), 400); });
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
          checkScopes();
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
      else if (b.dataset.off !== undefined) { ls.removeItem('sync.cfg'); ls.removeItem('sync.scopes'); render(); status('Токен забуто. Дані на цьому пристрої залишились.'); }
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
    backupReminder();
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
