{
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = { get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} } };
const TINTS = ['#5E5CE6','#FF9F0A','#30B0C7','#FF375F','#32D74B','#BF5AF2','#0A84FF','#AC8E68'];
const tint = id => { let h=0; for (const c of String(id)) h=(h*31+c.charCodeAt(0))%997; return TINTS[h%TINTS.length]; };
const initials = t => String(t||'').split(/[\s:]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const isRussian = x => /(^|\W)(RU|ru|Russian|Russia|рос)/.test([x.origin_country, x.original_language, x.language, x.country].flat().filter(Boolean).join(' '));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };


/* ---------- фраза без повторів ---------- */
const PH = window.TYUISHO_PHRASES || ['Час для хорошого кіно.'];
function nextPhrase(){
  let order = store.get('home.order', null), pos = store.get('home.pos', 0);
  if (!Array.isArray(order) || order.length !== PH.length || pos >= order.length) {
    order = PH.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    pos = 0; store.set('home.order', order);
  }
  store.set('home.pos', pos + 1);
  return PH[order[pos]];
}

/* ---------- теми заставки ---------- */
const THEMES = [
  { id:'matrix',  cap:'у дусі «Матриці»',         font:'JetBrains Mono', w:'700', fx:'matrix', rev:'type' },
  { id:'space',   cap:'у дусі космічних саг',      font:'Oswald',         w:'600', fx:'stars',  rev:'crawl' },
  { id:'noir',    cap:'у дусі нуару',              font:'Playfair Display', w:'1,700', fx:'rain', rev:'words' },
  { id:'horror',  cap:'у дусі «Дивних див»',       font:'Rubik Wet Paint', w:'400', fx:'grain', rev:'letters' },
  { id:'cyber',   cap:'у дусі кіберпанку',         font:'Rubik Glitch',   w:'400', fx:'none',   rev:'letters' },
  { id:'pixel',   cap:'у дусі 8-бітних ігор',      font:'Press Start 2P', w:'400', fx:'none',   rev:'type' },
  { id:'western', cap:'у дусі вестернів',          font:'Yeseva One',     w:'400', fx:'sand',   rev:'words' },
  { id:'silent',  cap:'у дусі німого кіно',        font:'Cormorant Garamond', w:'1,600', fx:'grain', rev:'fade' },
  { id:'magic',   cap:'у дусі «Гаррі Поттера»',    font:'Lobster',        w:'400', fx:'sparks', rev:'letters' },
  { id:'anime',   cap:'у дусі аніме',              font:'Unbounded',      w:'900', fx:'speed',  rev:'words' },
  { id:'comic',   cap:'у дусі коміксів',           font:'Rubik Mono One', w:'400', fx:'none',   rev:'words' },
  { id:'vhs',     cap:'у дусі касет VHS',          font:'Unbounded',      w:'700', fx:'grain',  rev:'fade' },
  { id:'dune',    cap:'у дусі «Дюни»',             font:'Oswald',         w:'300', fx:'sand',   rev:'letters' },
  { id:'romcom',  cap:'у дусі ромкомів',           font:'Caveat',         w:'700', fx:'none',   rev:'type' },
  { id:'cosmos',  cap:'у дусі «Інтерстеллара»',    font:'Cormorant Garamond', w:'300', fx:'stars', rev:'words' },
  { id:'tale',    cap:'у дусі мультфільмів-казок', font:'Amatic SC',      w:'700', fx:'sparks', rev:'letters' }
];
const QS = new URLSearchParams(location.search);
function pickTheme(){
  const forced = THEMES.find(t => t.id === QS.get('theme')); if (forced) return forced;
  const last = store.get('home.lastTheme', '');
  const pool = THEMES.filter(t => t.id !== last);
  const t = pool[Math.floor(Math.random() * pool.length)];
  store.set('home.lastTheme', t.id); return t;
}
function loadFont(t){
  /* шрифти лежать локально (fonts.css) — чекаємо, доки потрібний підвантажиться */
  const italic = t.w.startsWith('1,'), w = t.w.replace('1,', '');
  const wait = document.fonts ? document.fonts.load(`${italic ? 'italic ' : ''}${w} 40px "${t.font}"`, 'Тю і Шо ґ') : Promise.resolve();
  return Promise.race([wait.catch(() => {}), new Promise(r => setTimeout(r, 1200))]);
}

/* ---------- ефекти фону ---------- */
function runFx(cv, kind){
  if (kind === 'none' || reduce) return () => {};
  const ctx = cv.getContext('2d'); let W, H, raf, run = true; const dpr = 1;
  const size = () => { W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);
  const R = (a, b) => a + Math.random() * (b - a);
  let parts = [];
  const N = { stars: 140, rain: 80, sand: 120, sparks: 50, speed: 40, grain: 0 }[kind] || 0;
  for (let i = 0; i < N; i++) parts.push({ x: R(0, W), y: R(0, H), z: R(.2, 1), v: R(.3, 1), a: R(0, Math.PI * 2) });
  const cols = kind === 'matrix' ? Array.from({ length: Math.ceil(W / (16 * dpr)) }, () => R(-H, 0)) : null;
  const glyphs = 'アカサタナハマヤラワ0123456789ЖЮЇЄҐ#$%*+<>'.split('');
  let t0 = performance.now();
  const step = now => {
    if (!run) return; const dt = Math.min(50, now - t0); t0 = now;
    if (kind === 'matrix') {
      ctx.fillStyle = 'rgba(0,0,0,.09)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#3BFF64'; ctx.font = `${15 * dpr}px monospace`;
      cols.forEach((y, i) => { ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * 16 * dpr, y); cols[i] = y > H + R(0, 4000) ? 0 : y + 16 * dpr * dt / 45; });
    } else if (kind === 'grain') {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(255,255,255,.07)';
      for (let i = 0; i < 350; i++) ctx.fillRect(R(0, W), R(0, H), dpr * R(1, 2.4), dpr * R(1, 2.4));
      if (Math.random() < .08) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(R(0, W), 0, dpr, H); }
    } else {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        if (kind === 'stars') {
          const cx = W / 2, cy = H / 2; p.x += (p.x - cx) * .0009 * dt * p.z; p.y += (p.y - cy) * .0009 * dt * p.z;
          if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) { p.x = cx + R(-W * .2, W * .2); p.y = cy + R(-H * .2, H * .2); }
          ctx.fillStyle = `rgba(255,255,255,${p.z})`; ctx.fillRect(p.x, p.y, 1.6 * dpr * p.z, 1.6 * dpr * p.z);
        } else if (kind === 'rain') {
          p.y += 1.2 * dt * p.v * dpr; p.x -= .25 * dt * p.v * dpr; if (p.y > H) { p.y = -20; p.x = R(0, W * 1.2); }
          ctx.strokeStyle = `rgba(200,200,200,${.25 * p.z})`; ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 5 * dpr, p.y - 22 * dpr); ctx.stroke();
        } else if (kind === 'sand') {
          p.x += .25 * dt * p.v * dpr; p.y += Math.sin(now / 900 + p.a) * .2 * dpr; if (p.x > W) { p.x = -4; p.y = R(0, H); }
          ctx.fillStyle = `rgba(255,225,170,${.45 * p.z})`; ctx.fillRect(p.x, p.y, 1.8 * dpr, 1.8 * dpr);
        } else if (kind === 'sparks') {
          p.y -= .05 * dt * p.v * dpr; p.x += Math.sin(now / 700 + p.a) * .3 * dpr; if (p.y < -5) { p.y = H + 5; p.x = R(0, W); }
          const tw = .5 + .5 * Math.sin(now / 250 + p.a);
          ctx.fillStyle = `rgba(255,220,130,${tw * p.z})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8 * dpr * p.z, 0, 7); ctx.fill();
        } else if (kind === 'speed') {
          if (Math.random() < .3) { const len = R(.15, .45) * Math.max(W, H); const r0 = R(.28, .5) * Math.min(W, H);
            ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = R(1, 4) * dpr; ctx.beginPath();
            ctx.moveTo(W / 2 + Math.cos(p.a) * r0, H / 2 + Math.sin(p.a) * r0); ctx.lineTo(W / 2 + Math.cos(p.a) * (r0 + len), H / 2 + Math.sin(p.a) * (r0 + len)); ctx.stroke(); p.a = R(0, 7); }
        }
      });
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { run = false; cancelAnimationFrame(raf); removeEventListener('resize', size); };
}

/* ---------- заставка ---------- */
function splash(text){
  const t = pickTheme();
  document.body.classList.add('splashing');
  const el = document.createElement('div'); el.id = 'splash'; el.className = 'th-' + t.id;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Фраза дня: ' + text);
  el.innerHTML = `<canvas aria-hidden="true"></canvas>${t.id === 'cosmos' ? '<div class="ring" aria-hidden="true"></div>' : ''}${t.id === 'space' ? `<div class="sp-cap sp-top">${esc(t.cap)}</div>` : ''}<div class="sp-in"><div class="sp-cap">${esc(t.cap)}</div><div class="sp-q" aria-hidden="true"></div></div><div class="sp-skip">Торкнись, щоб продовжити</div>`;
  document.body.appendChild(el);
  const q = el.querySelector('.sp-q');
  q.style.fontFamily = `"${t.font}", Georgia, serif`;
  let stopFx = runFx(el.querySelector('canvas'), t.fx), done = false, timers = [];
  const finish = () => {
    if (done) return; done = true; timers.forEach(clearTimeout);
    el.classList.add('out'); document.body.classList.remove('splashing');
    setTimeout(() => { stopFx(); el.remove(); }, 850);
  };
  el.addEventListener('click', finish);
  addEventListener('keydown', function k(e){ if (['Escape','Enter',' '].includes(e.key)) { finish(); removeEventListener('keydown', k); } });
  timers.push(setTimeout(finish, 15000));
  loadFont(t).then(() => {
    if (done) return;
    let dur = 1500;
    if (reduce) { q.textContent = text; dur = 800; }
    else if (t.rev === 'type') {
      const cur = document.createElement('span'); cur.className = 'cursor'; q.appendChild(cur);
      const sp = Math.max(22, Math.min(55, 2600 / text.length)); let i = 0;
      const tick = () => { if (done) return; if (i < text.length) { cur.insertAdjacentText('beforebegin', text[i++]); timers.push(setTimeout(tick, text[i-1] === ' ' ? sp * .5 : sp)); } };
      tick(); dur = text.length * sp + 400;
    } else if (t.rev === 'letters' || t.rev === 'words') {
      const parts = t.rev === 'letters' ? [...text] : text.split(/(\s+)/);
      const gap = t.rev === 'letters' ? Math.max(18, Math.min(45, 2200 / text.length)) : Math.max(90, Math.min(220, 2600 / parts.length * 2));
      let d = 0;
      parts.forEach(p => { const s = document.createElement('span'); s.textContent = p; if (/\S/.test(p)) { s.style.animationDelay = d + 'ms'; d += gap; } else s.style.opacity = 1; q.appendChild(s); });
      if (t.rev === 'letters') { /* щоб слова не розривались по літерах */ q.innerHTML = ''; d = 0; text.split(/(\s+)/).forEach(w => { if (!/\S/.test(w)) { q.appendChild(document.createTextNode(' ')); return; } const wr = document.createElement('span'); wr.style.whiteSpace = 'nowrap'; wr.style.opacity = 1; wr.style.animation = 'none'; [...w].forEach(ch => { const s = document.createElement('span'); s.textContent = ch; s.style.animationDelay = d + 'ms'; d += gap; wr.appendChild(s); }); q.appendChild(wr); }); }
      dur = d + 900;
    } else if (t.rev === 'crawl') { q.textContent = text; dur = 7500; }
    else { q.textContent = text; dur = 2200; }
    timers.push(setTimeout(finish, Math.min(13000, dur + 2800)));
  });
}

/* ---------- дані Кінотеатру ---------- */
const items = store.get('lists.items', []) || [];
const meta = store.get('lists.meta', {});
const posterOf = it => (meta[it.id] && meta[it.id].poster) || it.poster || '';
const posterHTML = (id, title, src) => `<span class="poster" data-p="${esc(id)}" style="background:${tint(id)}">${esc(initials(title))}${src ? `<img alt="" loading="lazy" referrerpolicy="no-referrer" src="${esc(src)}" data-ok data-rm>` : ''}</span>`;
let toastT; const toast = t => { $('#toast').textContent = t; $('#toast').hidden = false; clearTimeout(toastT); toastT = setTimeout(() => $('#toast').hidden = true, 3000); };

function renderTop(text){
  const dt = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }); $('#today').textContent = dt.charAt(0).toUpperCase() + dt.slice(1);
  const h = new Date().getHours();
  document.querySelector('h1').textContent = h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора';
  $('#quote').innerHTML = `${esc(text)}<small>Фраза дня</small>`;
  const watched = items.filter(i => i.status === 'watched'), fire = watched.filter(i => i.pep === 5).length;
  $('#stats').innerHTML = `<span><b>${items.filter(i => i.status === 'planned').length}</b>у планах</span><i></i><span><b>${watched.length}</b>переглянуто</span><i></i><span><b>${fire}</b>🔥</span>`;
}
function renderWatching(){
  const w = items.filter(i => i.status === 'watching');
  w.forEach(wantPoster);
  $('#watchingSec').innerHTML = w.length ? `<h2 class="sec">Продовжити перегляд</h2><div class="row">${w.map(it => `<a class="card" href="kino.html#open=${encodeURIComponent(it.id)}">${posterHTML(it.id, it.title, posterOf(it))}<span class="ct">${esc(it.title)}</span>${it.ep ? `<span class="cs">Серія ${it.ep}${it.total ? ' з ' + it.total : ''}</span>` : ''}</a>`).join('')}</div>` : '';
}
let pickIdx = -1;
function renderPick(){
  const pl = items.filter(i => i.status === 'planned');
  if (!pl.length) { $('#pickSec').innerHTML = items.length ? '' : `<h2 class="sec">Ідея на вечір</h2><div class="empty">Відкрий <a href="kino.html">Кінотеатр</a> — і тут з'являться ідеї з твого списку.</div>`; return; }
  let i; do { i = Math.floor(Math.random() * pl.length); } while (pl.length > 1 && i === pickIdx); pickIdx = i;
  const it = pl[i], TYPE = { movie: 'Фільм', series: 'Серіал', anime: 'Аніме' };
  setTimeout(() => wantPoster(it));
  $('#pickSec').innerHTML = `<h2 class="sec">Ідея на вечір</h2><div class="pick">${posterHTML(it.id, it.title, posterOf(it))}<div><h3>${esc(it.title)}</h3><p>${esc([TYPE[it.type], String(it.year||'').slice(0,4)].filter(Boolean).join(' · '))} · з твого списку «Планую»</p><div class="btns"><a class="btn go" href="kino.html#open=${encodeURIComponent(it.id)}">Відкрити</a><button class="btn" id="another">Інша ідея</button></div></div></div>`;
  $('#another').onclick = renderPick;
}


const getJSON = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); };
/* ---------- підтягування постерів, яких ще немає ---------- */
const pq = [], pDone = new Set(); let pBusy = 0;
async function findPoster(it){
  const yr = String(it.year || '').slice(0, 4), q = it.orig || it.title;
  const key = store.get('lists.tmdb', '');
  if (key) {
    const d = await getJSON(`https://api.themoviedb.org/3/search/${it.type === 'movie' ? 'movie' : 'tv'}?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}${yr ? (it.type === 'movie' ? '&year=' : '&first_air_date_year=') + yr : ''}`);
    const r = (d.results || []).find(x => x.poster_path && !isRussian(x));
    if (r) return 'https://image.tmdb.org/t/p/w342' + r.poster_path;
  }
  if (it.type !== 'movie') {
    if (it.tvm) { const s = await getJSON(`https://api.tvmaze.com/shows/${it.tvm}`); if (s.image) return s.image.medium; }
    if (it.type === 'anime') {
      const r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: 'query($s:String){Page(perPage:5){media(search:$s,type:ANIME){coverImage{large} startDate{year}}}}', variables: { s: q } }) });
      const list = (((await r.json()).data || {}).Page || {}).media || [];
      const m = list.find(x => yr && x.startDate && String(x.startDate.year) === yr) || list[0];
      if (m && m.coverImage) return m.coverImage.large;
    }
    const list = await getJSON(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
    const hit = list.map(x => x.show).filter(s => s.image && !(s.language === 'Russian')).sort((a, b) => (yr && String(b.premiered || '').startsWith(yr)) - (yr && String(a.premiered || '').startsWith(yr)))[0];
    if (hit) return hit.image.medium;
  } else {
    const d = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=400&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(q + ' ' + yr + ' film')}`);
    const pg = Object.values((d.query || {}).pages || {})[0];
    if (pg && pg.thumbnail) return pg.thumbnail.source;
  }
  return '';
}
function paint(id, src){
  document.querySelectorAll(`[data-p="${CSS.escape(id)}"]`).forEach(el => { if (!el.querySelector('img')) el.insertAdjacentHTML('beforeend', `<img alt="" referrerpolicy="no-referrer" src="${esc(src)}" data-ok data-rm>`); });
}
function wantPoster(it){ if (posterOf(it) || pDone.has(it.id)) return; pDone.add(it.id); pq.push(it); pumpP(); }
function pumpP(){
  while (pBusy < 3 && pq.length) {
    const it = pq.shift(); pBusy++;
    findPoster(it).then(src => {
      if (!src) return;
      const m = store.get('lists.meta', {}); m[it.id] = Object.assign({ t: 0 }, m[it.id], { poster: src }); store.set('lists.meta', m); meta[it.id] = m[it.id];
      paint(it.id, src);
    }).catch(() => {}).finally(() => { pBusy--; pumpP(); });
  }
}

/* ---------- новинки ---------- */
const tmdbKey = store.get('lists.tmdb', '');
const SOURCES = tmdbKey
  ? [['cinema','У прокаті'],['soon','Скоро'],['tv','Серіали тижня']]
  : [['premieres','Прем\'єри серіалів']];
let tab = store.get('home.newsTab', SOURCES[0][0]); if (!SOURCES.some(s => s[0] === tab)) tab = SOURCES[0][0];
const ymd = d => d.toISOString().slice(0, 10);
async function loadNews(kind){
  const cache = store.get('home.news', {});
  if (cache[kind] && Date.now() - cache[kind].t < 6 * 3600e3) return cache[kind].list;
  let list = [];
  if (kind === 'premieres') {
    const days = []; for (let k = -6; k <= 3; k++) { const d = new Date(); d.setDate(d.getDate() + k); days.push(ymd(d)); }
    const res = await Promise.allSettled(days.flatMap(d => [getJSON(`https://api.tvmaze.com/schedule/web?date=${d}`), getJSON(`https://api.tvmaze.com/schedule?country=US&date=${d}`), getJSON(`https://api.tvmaze.com/schedule?country=GB&date=${d}`)]));
    const seen = new Set();
    res.forEach(r => (r.value || []).forEach(ep => {
      const s = ep.show || (ep._embedded && ep._embedded.show); if (!s || seen.has(s.id)) return;
      if (ep.season !== 1 || ep.number !== 1) return;
      if (!['Scripted', 'Animation'].includes(s.type)) return;
      const ctry = (s.network && s.network.country && s.network.country.code) || (s.webChannel && s.webChannel.country && s.webChannel.country.code) || '';
      if (s.language === 'Russian' || ctry === 'RU') return;
      seen.add(s.id);
      const anime = s.language === 'Japanese' && s.type === 'Animation';
      list.push({ key: 'tvm' + s.id, tvm: s.id, type: anime ? 'anime' : 'series', title: s.name, orig: s.name, year: (s.premiered || ep.airdate || '').slice(0, 4), poster: s.image ? s.image.medium : '', sub: [(s.network || s.webChannel || {}).name, new Date(ep.airdate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · '), w: (s.weight || 0) + (s.image ? 20 : 0) });
    }));
    list.sort((a, b) => b.w - a.w);
    const withImg = list.filter(n => n.poster); list = (withImg.length >= 8 ? withImg : list).slice(0, 24);
  } else {
    const path = kind === 'cinema' ? 'movie/now_playing' : kind === 'soon' ? 'movie/upcoming' : 'trending/tv/week';
    const base = `https://api.themoviedb.org/3/${path}?api_key=${encodeURIComponent(tmdbKey)}&language=uk-UA`;
    let d = await getJSON(base + (kind === 'tv' ? '' : '&region=UA'));
    if (kind !== 'tv' && (d.results || []).length < 6) d = await getJSON(base);
    list = (d.results || []).filter(x => !isRussian(x)).slice(0, 24).map(x => ({ key: 'tmdb' + x.id, type: kind === 'tv' ? ((x.genre_ids || []).includes(16) && x.original_language === 'ja' ? 'anime' : 'series') : 'movie',
      title: x.title || x.name, orig: x.original_title || x.original_name, year: (x.release_date || x.first_air_date || '').slice(0, 4),
      poster: x.poster_path ? 'https://image.tmdb.org/t/p/w342' + x.poster_path : '', overview: x.overview || '',
      sub: (x.release_date || x.first_air_date) ? new Date(x.release_date || x.first_air_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }) : '' }));
  }
  cache[kind] = { t: Date.now(), list }; store.set('home.news', cache);
  return list;
}
const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const inList = n => items.some(i => (n.tvm && i.tvm === n.tvm) || (norm(i.title) && (norm(i.title) === norm(n.title) || norm(i.orig) === norm(n.orig))));
let news = [];
async function renderNews(){
  $('#newsSeg').innerHTML = SOURCES.length > 1 ? SOURCES.map(([k, l]) => `<button aria-pressed="${k === tab}" data-tab="${k}">${l}</button>`).join('') : '';
  $('#newsSeg').hidden = SOURCES.length < 2;
  $('#newsNote').innerHTML = tmdbKey ? 'Дані: TMDB. Російське відфільтровано.' : 'Прем\'єри перших серій за останній тиждень і найближчі дні (TVmaze). Щоб бачити фільми в прокаті, додай ключ TMDB у налаштуваннях (⚙ угорі).';
  try { news = await loadNews(tab); } catch (e) { $('#news').innerHTML = '<div class="empty" style="width:100%">Не вдалося завантажити новинки. Перевір інтернет.</div>'; return; }
  $('#news').innerHTML = news.length ? news.map((n, i) => { const has = inList(n); return `<div class="card">${posterHTML(n.key, n.title, n.poster)}<button class="add" data-add="${i}" ${has ? 'disabled aria-label="Уже в списку"' : `aria-label="Додати «${esc(n.title)}» у «Планую»"`}>${has ? '✓' : '+'}</button><span class="ct">${esc(n.title)}</span><span class="cs">${esc(n.sub || n.year)}</span></div>`; }).join('') : '<div class="empty" style="width:100%">Поки нічого нового.</div>';
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tab) { tab = b.dataset.tab; store.set('home.newsTab', tab); renderNews(); }
  else if (b.dataset.add) {
    const n = news[Number(b.dataset.add)]; if (!n || inList(n)) return;
    const it = { id: 'u' + Date.now().toString(36), type: n.type, status: 'planned', title: n.title, orig: n.orig, year: n.year, imdb: '', overview: n.overview || '' };
    if (n.tvm) it.tvm = n.tvm;
    const all = store.get('lists.items', []) || []; all.unshift(it); store.set('lists.items', all); items.unshift(it);
    if (n.poster) { const m = store.get('lists.meta', {}); m[it.id] = { poster: n.poster, t: 0 }; store.set('lists.meta', m); meta[it.id] = m[it.id]; }
    b.disabled = true; b.textContent = '✓'; toast(`«${n.title}» додано в «Планую»`); window.TyuSound && TyuSound.play('pop'); renderTop($('#quote').firstChild.textContent); renderPick();
  }
});


/* ---------- аркуш на головній ---------- */
function hSheet(html, label){
  let ov = document.getElementById('hov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'hov'; ov.className = 'overlay'; ov.innerHTML = '<button class="backdrop" data-hx aria-label="Закрити"></button><div class="sheet" role="dialog" aria-modal="true"></div>'; document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target.closest('[data-hx]')) ov.hidden = true; }); addEventListener('keydown', e => { if (e.key === 'Escape') ov.hidden = true; }); }
  const sh = ov.querySelector('.sheet'); sh.setAttribute('aria-label', label || ''); sh.innerHTML = '<div class="grab"></div>' + html; ov.hidden = false; return sh;
}
const fullMeta = () => store.get('lists.meta', {});

/* ---------- «Що подивитися сьогодні?» ---------- */
const MOODS = [
  ['laugh', '😂', 'Посміятися', ['Комедія','Анімація','Сімейний','Сатира']],
  ['nerves', '😱', 'Пощекотати нерви', ['Трилер','Жахи','Детектив','Кримінал']],
  ['think', '🤔', 'Подумати', ['Драма','Фантастика','Історичний','Біографічний','Психологічний','Документальний']],
  ['drive', '💥', 'Драйв і пригоди', ['Бойовик','Пригоди','Фантастика','Фентезі','Меха']],
  ['warm', '💗', 'Щось тепле', ['Мелодрама','Сімейний','Повсякдення','Комедія','Музичний']]
];
const TIMES = [['short','⏱','До півтори години'],['evening','🍿','Цілий вечір'],['night','🌙','Ніч попереду']];
const COMPANY = [['solo','🙋','Сам'],['two','💑','Удвох'],['friends','👯','З друзями'],['kids','👨‍👩‍👧','З дітьми']];
let wiz = {};
function wizard(step){
  if (step === 0) wiz = {};
  const q = [['Який настрій?', MOODS, 'mood'], ['Скільки є часу?', TIMES, 'time'], ['З ким дивишся?', COMPANY, 'company']][step];
  if (!q) return wizResult();
  const sh = hSheet(`<div class="wz-top"><span class="wz-dots">${[0,1,2].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</span><button class="done" data-hx>Закрити</button></div>
    <h2 class="wz-q">${q[0]}</h2><div class="wz-opts">${q[1].map(o => `<button class="wz-o" data-wz="${q[2]}:${o[0]}"><span class="wz-e">${o[1]}</span>${o[2]}</button>`).join('')}</div>`, 'Що подивитися сьогодні?');
  sh.onclick = e => { const b = e.target.closest('[data-wz]'); if (!b) return; const [k, v] = b.dataset.wz.split(':'); wiz[k] = v; b.classList.add('pick-on'); setTimeout(() => wizard(step + 1), 220); };
}
function wizResult(again){
  const M = fullMeta(), mood = MOODS.find(m => m[0] === wiz.mood), want = mood ? mood[3] : [];
  const pool = items.filter(i => i.status === 'planned' || i.status === 'watching');
  const scored = pool.map(it => {
    const m = M[it.id] || {}, g = m.g || [], rt = m.rt || 0; let s = Math.random() * 1.5;
    s += g.filter(x => want.includes(x)).length * 3;
    if (wiz.time === 'short') s += it.type === 'movie' ? (rt && rt <= 100 ? 3 : rt > 130 ? -3 : 0) : 1.5;
    if (wiz.time === 'evening') s += it.type === 'movie' ? 2 : 0.5;
    if (wiz.time === 'night') s += it.type !== 'movie' ? 3 : (rt > 140 ? 2 : 0);
    if (wiz.company === 'two' && g.some(x => ['Мелодрама','Комедія','Драма'].includes(x))) s += 1.5;
    if (wiz.company === 'friends' && g.some(x => ['Комедія','Жахи','Бойовик','Пригоди'].includes(x))) s += 1.5;
    if (wiz.company === 'kids') { if (!g.some(x => ['Сімейний','Анімація'].includes(x))) s -= 8; if (g.includes('Жахи')) s -= 20; }
    if (it.status === 'watching') s += 0.8;
    return { it, s, g };
  }).sort((a, b) => b.s - a.s).slice(0, 3);
  const TYPE = { movie: 'Фільм', series: 'Серіал', anime: 'Аніме' };
  const sh = hSheet(`<div class="wz-top"><span class="lbl">${mood ? mood[1] + ' ' + mood[2] : ''}</span><button class="done" data-hx>Готово</button></div>
    <h2 class="wz-q">Ось що раджу</h2>
    ${scored.length ? `<div class="wz-res">${scored.map((x, n) => `<a class="wz-card${n === 0 ? ' top' : ''}" href="kino.html#open=${encodeURIComponent(x.it.id)}">${posterHTML(x.it.id, x.it.title, posterOf(x.it))}<span><b>${esc(x.it.title)}</b><small>${esc([TYPE[x.it.type], String(x.it.year || '').slice(0, 4), x.g.slice(0, 2).join(', ')].filter(Boolean).join(' · '))}</small>${n === 0 ? '<em>Найкращий збіг</em>' : ''}</span></a>`).join('')}</div>`
      : '<div class="empty">У «Планую» поки порожньо — додай щось у Кінотеатрі.</div>'}
    <div class="btns" style="margin-top:4px"><button class="btn go" data-again>Ще варіанти</button><button class="btn" data-restart>Інший настрій</button></div>
    <p class="note">Підбираю з твоїх «Планую» і «Дивлюся» за жанрами й тривалістю. Жанри підтягуються, коли відкриваєш Кінотеатр.</p>`, 'Порада');
  sh.onclick = e => { if (e.target.closest('[data-again]')) wizResult(true); else if (e.target.closest('[data-restart]')) wizard(0); };
  scored.forEach(x => wantPoster(x.it));
}

/* ---------- нові серії ---------- */
async function renderEpisodes(){
  const w = items.filter(i => i.status === 'watching' && i.tvm);
  if (!w.length) { $('#epsSec').innerHTML = ''; return; }
  const cache = store.get('home.eps', {}), now = Date.now(), out = [];
  await Promise.allSettled(w.map(async it => {
    let c = cache[it.tvm];
    if (!c || now - c.t > 6 * 3600e3) {
      const s = await getJSON(`https://api.tvmaze.com/shows/${it.tvm}?embed[]=nextepisode&embed[]=previousepisode`);
      const e = s._embedded || {}, ep = x => x && { s: x.season, n: x.number, at: x.airstamp || x.airdate, name: x.name };
      c = { t: now, next: ep(e.nextepisode), prev: ep(e.previousepisode) }; cache[it.tvm] = c;
    }
    const day = 864e5;
    if (c.next && new Date(c.next.at) - now < 30 * day) out.push({ it, ep: c.next, when: new Date(c.next.at), up: true });
    else if (c.prev && now - new Date(c.prev.at) < 7 * day) out.push({ it, ep: c.prev, when: new Date(c.prev.at), up: false });
  }));
  store.set('home.eps', cache);
  if (!out.length) { $('#epsSec').innerHTML = ''; return; }
  out.sort((a, b) => (a.up - b.up) || (a.up ? a.when - b.when : b.when - a.when));
  const rel = d => { const t0 = new Date(); t0.setHours(0, 0, 0, 0); const dd = Math.round((new Date(d).setHours(0, 0, 0, 0) - t0) / 864e5);
    return dd === 0 ? 'сьогодні' : dd === 1 ? 'завтра' : dd === -1 ? 'вчора' : dd < 0 ? `${-dd} дн. тому` : d.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' }); };
  $('#epsSec').innerHTML = `<h2 class="sec">Нові серії</h2><div class="eps">${out.map(x => `<a class="ep" href="kino.html#open=${encodeURIComponent(x.it.id)}">${posterHTML(x.it.id, x.it.title, posterOf(x.it))}<span><b>${esc(x.it.title)}</b><small>Сезон ${x.ep.s}, серія ${x.ep.n}</small></span><em class="${x.up ? '' : 'out'}">${x.up ? rel(x.when) : 'вийшла ' + rel(x.when)}</em></a>`).join('')}</div>`;
}

/* ---------- підсумок року ---------- */
function yearStats(){
  const Y = new Date().getFullYear(), M = fullMeta();
  const watched = items.filter(i => i.status === 'watched');
  const dated = watched.filter(i => i.watchedAt && new Date(i.watchedAt).getFullYear() === Y);
  const list = dated.length ? dated : watched;
  const by = t => list.filter(i => i.type === t).length;
  const gc = {}; list.forEach(i => ((M[i.id] || {}).g || []).forEach(g => gc[g] = (gc[g] || 0) + 1));
  const top = Object.entries(gc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  const fire = list.filter(i => i.pep === 5), rated = list.filter(i => i.pep);
  const avg = rated.length ? rated.reduce((a, i) => a + i.pep, 0) / rated.length : 0;
  const mins = list.filter(i => i.type === 'movie').reduce((a, i) => a + ((M[i.id] || {}).rt || 0), 0);
  return { Y, list, dated: dated.length > 0, movies: by('movie'), series: by('series'), anime: by('anime'), top, fire, avg, hours: Math.round(mins / 60) };
}
function yearSheet(){
  const st = yearStats();
  hSheet(`<div class="wz-top"><span class="lbl">${st.dated ? 'Переглянуто цього року' : 'Усе переглянуте (дати перегляду з\'явилися нещодавно)'}</span><button class="done" data-hx>Готово</button></div>
    <div class="yr"><div class="yr-big">${st.Y}</div><div class="yr-sub">мій рік у кіно</div>
      <div class="yr-num"><b>${st.list.length}</b><span>переглянуто</span></div>
      <div class="yr-grid"><span><b>${st.movies}</b>${plural(st.movies,'фільм','фільми','фільмів')}</span><span><b>${st.series}</b>${plural(st.series,'серіал','серіали','серіалів')}</span><span><b>${st.anime}</b>аніме</span>${st.hours ? `<span><b>${st.hours}</b>${plural(st.hours,'година','години','годин')} у фільмах</span>` : ''}</div>
      ${st.top.length ? `<div class="yr-line">Улюблені жанри: <b>${esc(st.top.join(', '))}</b></div>` : ''}
      ${st.avg ? `<div class="yr-line">Середня оцінка: <b>${st.avg.toFixed(1)} 🌶️</b></div>` : ''}
      ${st.fire.length ? `<div class="yr-line">З вогником 🔥</div><div class="row">${st.fire.map(it => `<a class="card" href="kino.html#open=${encodeURIComponent(it.id)}">${posterHTML(it.id, it.title, posterOf(it))}<span class="ct">${esc(it.title)}</span></a>`).join('')}</div>` : ''}
    </div>
    <div class="btns"><button class="btn go" data-share>Поділитися листівкою</button></div>`, 'Підсумок року').onclick = e => { if (e.target.closest('[data-share]')) shareYear(st); };
  st.fire.forEach(wantPoster);
}
async function shareYear(st){
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, '#E0261C'); g.addColorStop(.55, '#7B2FF7'); g.addColorStop(1, '#0B0B1A'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
  [[180, 220, 380, 'rgba(255,170,60,.35)'], [900, 400, 420, 'rgba(255,255,255,.12)'], [600, 1150, 500, 'rgba(60,180,255,.25)']].forEach(([cx, cy, r, col]) => { const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, col); rg.addColorStop(1, 'transparent'); x.fillStyle = rg; x.fillRect(0, 0, 1080, 1350); });
  x.fillStyle = '#fff'; x.textBaseline = 'top'; const F = (w, s) => `${w} ${s}px -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
  x.font = F(700, 40); x.globalAlpha = .8; x.fillText('Тю і Шо глянемо', 90, 90); x.globalAlpha = 1;
  x.font = F(800, 150); x.fillText(String(st.Y), 90, 160); x.font = F(600, 52); x.fillText('мій рік у кіно', 90, 330);
  x.font = F(800, 260); x.fillText(String(st.list.length), 90, 430); x.font = F(600, 46); x.fillText('переглянуто', 96, 700);
  x.font = F(600, 44); let y = 800;
  [`🎬 ${st.movies} ${plural(st.movies,'фільм','фільми','фільмів')}   📺 ${st.series} ${plural(st.series,'серіал','серіали','серіалів')}   ✨ ${st.anime} аніме`, st.top.length ? `Улюблене: ${st.top.join(', ')}` : '', st.avg ? `Середня оцінка: ${st.avg.toFixed(1)} 🌶️` : ''].filter(Boolean).forEach(l => { x.fillText(l, 90, y, 900); y += 72; });
  if (st.fire.length) { x.font = F(700, 44); x.fillText('🔥 Вогонь:', 90, y + 20); x.font = F(500, 40); st.fire.slice(0, 4).forEach((it, i) => x.fillText('• ' + it.title, 110, y + 90 + i * 58, 880)); }
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], `tyu-i-sho-${st.Y}.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `Мій ${st.Y} у кіно` }); return; } } catch(e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
}


/* ---------- налаштування ---------- */
const THEMES_UI = [
  ['standard', 'Стандартна', 'linear-gradient(135deg,#ffd9d4,#e7e0ff 55%,#ffe8c7)', '#E0261C', ''],
  ['xmas', 'Різдвяна', 'linear-gradient(135deg,#f7d6da,#d7efdc 55%,#f8e8b8)', '#C8102E', '🎄'],
  ['summer', 'Літня', 'linear-gradient(135deg,#ffe2a6,#b9f1ee 55%,#ffc9b8)', '#FF7A00', '☀️'],
  ['winter', 'Зимова', 'linear-gradient(135deg,#d6ebff,#eef6ff 55%,#dcd6ff)', '#1C7ED6', '❄️'],
  ['clear', 'Прозора', 'linear-gradient(135deg,#ff5f9e,#8b6cf0 50%,#3fd0ff)', '#7048E8', '◌']
];
function themesHTML(){
  const cur = window.TyuTheme ? window.TyuTheme.get() : 'standard';
  return THEMES_UI.map(([k, n, bg, tint, e]) => `<button class="th" data-theme-pick="${k}" aria-pressed="${k === cur}"><span class="prev" style="background:${bg}"><i style="background:${tint}"></i><i class="g"></i><i class="g2"></i>${e ? `<em>${e}</em>` : ''}</span><b>${n}</b></button>`).join('');
}

async function paintPush(sh){
  const box = sh.querySelector('#pushSet'); if (!box || !window.TyuPush) return;
  const st = await window.TyuPush.status();
  const steps = `<ol class="steps"><li>Увімкни синхронізацію в «Дані» (хмаринка).</li><li>На GitHub у репозиторії Home: Settings → Secrets and variables → Actions → New repository secret. Назва <b>GIST_TOKEN</b>, значення — той самий токен, що для синхронізації.</li><li>Натисни «Увімкнути» нижче й дозволь сповіщення.</li></ol>`;
  let html = '<h3>Сповіщення про нові серії</h3>';
  if (!st.ok && st.why === 'install') html += '<p>На iPhone сповіщення працюють лише для сайту, встановленого на екран: Safari → «Поділитися» → «На екран Додому». Потім відкрий його з іконки й повернись сюди.</p>';
  else if (!st.ok) html += '<p>Цей браузер не підтримує push-сповіщення.</p>';
  else if (st.on) html += '<p>Увімкнено ✓ Щогодини перевіряю серіали зі статусом «Дивлюся» й надсилаю сповіщення, щойно виходить нова серія.</p><div class="btns"><button class="btn" data-push="off">Вимкнути на цьому пристрої</button></div>';
  else html += `<p>Сповіщення приходитимуть, навіть коли сайт закрито. Що потрібно:</p>${steps}<div class="btns"><button class="btn go" data-push="on">Увімкнути</button></div>`;
  box.innerHTML = html;
}


/* ---------- часті питання ---------- */
const FAQ = [
  ['Як встановити застосунок на iPhone?', 'Відкрий сайт у Safari → «Поділитися» → «На екран Додому». Після цього він відкривається з іконки на весь екран, працює без інтернету (з останніми збереженими даними) і може надсилати сповіщення.'],
  ['Де зберігаються мої списки?', 'У пам\'яті цього браузера. Щоб не втратити їх і мати однакові дані на телефоні й комп\'ютері, увімкни синхронізацію: кнопка «Дані» (хмаринка) угорі на будь-якій сторінці. Без синхронізації час від часу збережи резервну копію у файл, застосунок про це нагадає.'],
  ['Як працює синхронізація і чи це безпечно?', 'Дані зберігаються в приватному Gist на твоєму GitHub. Потрібен токен лише з правом «gist», створити його можна за посиланням у «Дані». Токен лежить тільки в браузері, у коді сайту його немає. Якщо в токена є зайві права, застосунок попередить.'],
  ['Як додати фільм, серіал чи аніме?', 'У Кінотеатрі напиши назву в пошуку й обери варіант зі списку. Постер, опис, жанри й тривалість підтягнуться самі. Російські фільми й серіали відфільтровуються автоматично.'],
  ['Які є жести в Кінотеатрі?', 'Свайп картки вліво — «Переглянуто», вправо — «Дивлюся». Довге натискання відкриває меню дій. Натискання відкриває картку на весь екран з трейлером, схожими фільмами, сезонами й нотаткою.'],
  ['Що означають перчики й вогник?', 'Це твоя особиста оцінка переглянутого: від одного до чотирьох перчиків, а п\'ятий, вогник 🔥, — максимум.'],
  ['Навіщо ключ TMDB?', 'Він необов\'язковий. Без нього дані беруться з TVmaze, AniList і Вікіпедії. З ключем з\'являються описи українською, кращі постери, фільми в прокаті, «Де дивитися» і схожі фільми. Ключ безкоштовний (themoviedb.org → Settings → API), зберігається лише в цьому браузері й не синхронізується.'],
  ['Як увімкнути сповіщення про нові серії?', 'Нижче в розділі «Сповіщення» є покрокова інструкція. На iPhone вони працюють лише для застосунку, встановленого на екран Додому. GitHub запускає перевірку із затримками, тому сповіщення можуть приходити на кілька годин пізніше.'],
  ['Як часто оновлюються новини?', 'Раз на день, зранку. Стрічка зберігає новини за останній тиждень. Іноземні новини автоматично перекладаються українською.'],
  ['Як оновити застосунок?', 'Застосунок сам перевіряє нову версію щоразу, коли ти його відкриваєш, і оновлюється. Якщо щось виглядає по-старому, натисни кнопку оновлення угорі сторінки: крапка на ній означає, що є нова версія. Незбережені дані перед цим відправляються в Gist.'],
  ['Щось не працює. Що робити?', 'Відкрий «Дані» → «Пам\'ять і діагностика» → «Скопіювати журнал для Claude» і надішли його мені в чат. Якщо застосунок пише, що пам\'ять заповнена, натисни «Очистити кеш»: списки лишаться, зникнуть лише тимчасові дані.'],
  ['Чому немає якогось російського фільму?', 'Так задумано: російські фільми, серіали й аніме-адаптації не додаються й відфільтровуються в пошуку, новинах і колекціях.']
];
const faqHTML = () => `<div class="set faq"><h3>Часті питання</h3>${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;

function settingsSheet(){
  const key = store.get('lists.tmdb', '');
  const sh = hSheet(`<div class="wz-top"><span style="font-size:17px;font-weight:700">Налаштування</span><button class="done" data-hx>Готово</button></div>
    <div class="set"><h3>Тема оформлення</h3><div class="themes" id="themes">${themesHTML()}</div></div>
    <div class="set"><h3>Звуки</h3>
      <label class="sw"><span>Звуки дій<small>Клацання проектора, «тю!» на вогник, «поп» при додаванні. Мовчать у беззвучному режимі iPhone.</small></span><input type="checkbox" id="sndOn" ${window.TyuSound && TyuSound.on() ? 'checked' : ''}><i></i></label>
      <div class="btns"><button class="btn" data-snd="click">▶︎ Клац</button><button class="btn" data-snd="tyu">▶︎ Тю! 🔥</button><button class="btn" data-snd="pop">▶︎ Поп</button></div></div>
    <div class="set"><h3>Ключ TMDB (необов'язково)</h3>
      <p>Без ключа постери й описи беруться з TVmaze, AniList і Вікіпедії. З ключем — описи українською, кращі постери, фільми в прокаті, «Де дивитися» й схожі фільми. Ключ зберігається тільки в цьому браузері й не синхронізується.</p>
      <input id="keyIn" type="password" autocomplete="off" placeholder="API Key (v3)" value="${esc(key)}" aria-label="Ключ TMDB">
      <p><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Отримати ключ на themoviedb.org</a></p></div>
    <div class="btns"><button class="btn go" data-savekey>Зберегти</button>${key ? '<button class="btn" data-delkey>Видалити ключ</button>' : ''}</div>
    <div class="set" id="pushSet"><h3>Сповіщення про нові серії</h3><p>Перевіряю…</p></div>
    ${faqHTML()}`, 'Налаштування');
  paintPush(sh);
  sh.onchange = e => { if (e.target.id === 'sndOn') { TyuSound.set(e.target.checked); if (e.target.checked) TyuSound.play('click'); toast(e.target.checked ? 'Звуки ввімкнено' : 'Звуки вимкнено'); } };
  sh.onclick = e => {
    const sb = e.target.closest('[data-snd]'); if (sb) { TyuSound.play(sb.dataset.snd, true); return; }
    const tb = e.target.closest('[data-theme-pick]');
    if (tb) { window.TyuTheme.set(tb.dataset.themePick); sh.querySelector('#themes').innerHTML = themesHTML(); toast('Тема: ' + tb.querySelector('b').textContent); return; }
    const pb = e.target.closest('[data-push]');
    if (pb) { pb.disabled = true; const on = pb.dataset.push === 'on';
      (on ? window.TyuPush.enable() : window.TyuPush.disable()).then(() => { toast(on ? 'Сповіщення ввімкнено 🔔' : 'Сповіщення вимкнено'); paintPush(sh); })
        .catch(err => { const p = sh.querySelector('#pushSet p'); if (p) p.textContent = err.message; pb.disabled = false; });
      return; }
    const save = e.target.closest('[data-savekey]'), del = e.target.closest('[data-delkey]'); if (!save && !del) return;
    const v = del ? '' : sh.querySelector('#keyIn').value.trim();
    store.set('lists.tmdb', v);
    ['lists.meta', 'lists.extras', 'lists.more', 'home.news'].forEach(k => localStorage.removeItem(k));
    toast(v ? 'Ключ TMDB збережено' : 'Ключ видалено'); setTimeout(() => location.reload(), 600);
  };
}


/* ---------- свіжі новини (з гілки news-data) ---------- */
async function renderNewsTeaser(){
  let d = store.get('news.cache', null);
  try { const r = await fetch('https://raw.githubusercontent.com/Satilus/Home/news-data/news.json', { cache: 'no-cache' }); if (r.ok) { d = await r.json(); store.set('news.cache', d); } } catch(e) {}
  const list = d && (d.items || []).filter(x => x.lang === 'uk').slice(0, 3);
  if (!list || !list.length) { $('#newsSec').innerHTML = ''; return; }
  const ago = iso => { const h = Math.round((Date.now() - new Date(iso)) / 36e5); return !iso ? '' : h < 1 ? 'щойно' : h < 24 ? h + ' год тому' : Math.round(h / 24) + ' дн. тому'; };
  $('#newsSec').innerHTML = `<h2 class="sec">Свіжі новини <a href="news.html">Усі ›</a></h2><div class="nws">${list.map(x => `<a class="nw" href="${esc(window.safeUrl(x.url) || 'news.html')}" target="_blank" rel="noopener noreferrer"><span class="th">${window.safeUrl(x.img) ? `<img alt="" loading="lazy" referrerpolicy="no-referrer" src="${esc(window.safeUrl(x.img))}" data-ok data-rm>` : ''}</span><span><b>${esc(x.title)}</b><small>${esc(x.src)}${x.date ? ' · ' + esc(ago(x.date)) : ''}</small></span></a>`).join('')}</div>`;
}

/* ---------- старт ---------- */
let phrase = sessionStorage.getItem('home.phrase');
const first = !phrase || QS.has('theme');
if (first) { phrase = QS.has('theme') && phrase ? phrase : nextPhrase(); sessionStorage.setItem('home.phrase', phrase); }
renderTop(phrase); renderWatching(); renderPick(); renderNews(); renderEpisodes().catch(() => {}); renderNewsTeaser();
$('#wizBtn').onclick = () => wizard(0); $('#btnSettings').onclick = settingsSheet;
$('#disc').onclick = e => { const b = e.currentTarget; b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') !== 'true'); }; $('#yearBtn').onclick = yearSheet;
if (first) splash(phrase);
}
