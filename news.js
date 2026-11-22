{
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = { get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} } };
const URL_NEWS = 'https://raw.githubusercontent.com/Satilus/Home/news-data/news.json';
const REG = [['uk', 'Україна'], ['en', 'Світ']];
let region = store.get('news.region', 'uk'), data = store.get('news.cache', null);

const ago = iso => {
  if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'щойно'; if (m < 60) return m + ' хв тому';
  const h = Math.round(m / 60); if (h < 24) return h + ' год тому';
  const d = Math.round(h / 24); return d === 1 ? 'вчора' : d < 7 ? d + ' дн. тому' : new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
};
const img = (src, cls) => window.safeUrl(src) ? `<img alt="" loading="${cls === 'hero' ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" src="${esc(window.safeUrl(src))}" data-ok data-rm>` : '';
const link = x => esc(window.safeUrl(x.url) || '#');

function render(){
  $('#region').innerHTML = REG.map(([k, l]) => `<button aria-pressed="${k === region}" data-r="${k}">${l}</button>`).join('');
  if (!data) return;
  const list = (data.items || []).filter(x => x.lang === region);
  $('#upd').textContent = 'Оновлено ' + ago(data.updated);
  if (!list.length) { $('#feed').innerHTML = '<div class="empty">Поки немає новин. Спробуй оновити трохи пізніше.</div>'; return; }
  const [h, ...rest] = list;
  $('#feed').innerHTML = `<a class="hero" href="${link(h)}" target="_blank" rel="noopener noreferrer"><div class="img">${img(h.img, 'hero')}</div><div class="txt"><h2>${esc(h.title)}</h2><div class="meta"><span>${esc(h.src)}</span>${h.date ? `<span>· ${esc(ago(h.date))}</span>` : ''}${h.tr ? '<span>· переклад</span>' : ''}</div></div></a>`
    + rest.map(x => `<a class="nrow" href="${link(x)}" target="_blank" rel="noopener noreferrer"><span class="th">${img(x.img)}</span><span class="bd"><h3 ${x.orig ? `title="${esc(x.orig)}"` : ''}>${esc(x.title)}</h3>${x.sum ? `<p>${esc(x.sum)}</p>` : ''}<span class="meta"><span>${esc(x.src)}</span>${x.date ? `<span>· ${esc(ago(x.date))}</span>` : ''}${x.tr ? '<span>· переклад</span>' : ''}</span></span></a>`).join('');
  $('#foot').innerHTML = region === 'uk'
    ? 'Кіноновини з українських видань: Укрінформ, Детектор медіа, ТСН, УНІАН, РБК-Україна, НВ, Українська правда та інших. Російські джерела й російськомовні версії відсіяно.'
    : 'Світові кіноновини (Variety, Deadline, The Hollywood Reporter, IndieWire, Screen Rant, Collider), автоматично перекладені українською — можливі неточності. Стаття відкривається в оригіналі.';
  $('#foot').innerHTML += ' Оновлюється кожні дві години, зберігає новини за тиждень.';
}
async function load(force){
  $('#refresh').classList.add('spin');
  try {
    const r = await fetch(URL_NEWS + (force ? '?t=' + Date.now() : ''), { cache: force ? 'no-store' : 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    data = await r.json(); store.set('news.cache', data);
  } catch (e) {
    if (!data) $('#feed').innerHTML = '<div class="empty">Не вдалося завантажити новини. Перевір інтернет.</div>';
  }
  $('#refresh').classList.remove('spin'); render();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { region = b.dataset.r; store.set('news.region', region); render(); scrollTo({ top: 0 }); } });
$('#refresh').onclick = () => load(true);
render(); load(false);
}
