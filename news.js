{
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = { get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} } };
const URL_NEWS = 'https://raw.githubusercontent.com/Satilus/Home/news-data/news.json';
const region = 'uk'; let data = store.get('news.cache', null);

const ago = iso => {
  if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'щойно'; if (m < 60) return m + ' хв тому';
  const h = Math.round(m / 60); if (h < 24) return h + ' год тому';
  const d = Math.round(h / 24); return d === 1 ? 'вчора' : d < 7 ? d + ' дн. тому' : new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
};
const img = (src, cls) => window.safeUrl(src) ? `<img alt="" loading="${cls === 'hero' ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" src="${esc(window.safeUrl(src))}" data-ok data-rm>` : '';
const link = x => esc(window.safeUrl(x.url) || '#');

function render(){
  if (!data) return;
  const list = (data.items || []).filter(x => x.lang === region);
  $('#upd').textContent = 'Оновлено ' + ago(data.updated);
  if (!list.length) { $('#feed').innerHTML = '<div class="empty">Поки немає новин. Спробуй оновити трохи пізніше.</div>'; return; }
  const [h, ...rest] = list;
  $('#feed').innerHTML = `<a class="hero" href="${link(h)}" target="_blank" rel="noopener noreferrer"><div class="img">${img(h.img, 'hero')}</div><div class="txt"><h2>${esc(h.title)}</h2><div class="meta"><span>${esc(h.src)}</span>${h.date ? `<span>· ${esc(ago(h.date))}</span>` : ''}</div></div></a>`
    + rest.map(x => `<a class="nrow" href="${link(x)}" target="_blank" rel="noopener noreferrer"><span class="th">${img(x.img)}</span><span class="bd"><h3>${esc(x.title)}</h3>${x.sum ? `<p>${esc(x.sum)}</p>` : ''}<span class="meta"><span>${esc(x.src)}</span>${x.date ? `<span>· ${esc(ago(x.date))}</span>` : ''}</span></span></a>`).join('');
  $('#foot').innerHTML = 'Кіноновини українською з українських видань: Укрінформ, Детектор медіа, ТСН, УНІАН, РБК-Україна, НВ, Українська правда та інших. Оновлюється кожні дві години, зберігає новини за тиждень. Російські джерела й російськомовні версії відсіяно.';
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
$('#refresh').onclick = () => load(true);
render(); load(false);
}
