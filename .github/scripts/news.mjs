// «Тю і Шо глянемо» — збирач стрічки новин кіно. Запускається GitHub Actions.
// Читає RSS кіновидань (і GDELT), додає прев'ю (з RSS або og:image статті), відсіює російське,
// і записує news.json, який сайт читає з гілки news-data. Без ключів і залежностей.
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (compatible; TyuiShoNewsBot/1.0; +https://satilus.github.io/Home/)';
const SOURCES = [
  // Лише українськомовні видання. kino: true — розділ про кіно/шоубіз (беремо все, крім явно некіношного)
  { lang: 'uk', name: 'РБК-Україна Стайлер', url: 'https://www.rbc.ua/static/rss/styler.ukr.rss.xml', filter: true },
  { lang: 'uk', name: 'ТСН Гламур', url: 'https://tsn.ua/rss/glamur.rss', filter: true },
  { lang: 'uk', name: 'Укрінформ', url: 'https://www.ukrinform.ua/rss/rubric-culture', filter: true },
  { lang: 'uk', name: 'Детектор медіа', url: 'https://detector.media/rss/', filter: true },
  { lang: 'uk', name: 'Українська правда. Життя', url: 'https://life.pravda.com.ua/rss/', filter: true },
  { lang: 'uk', name: 'ТСН', url: 'https://tsn.ua/rss/full.rss', filter: true },
  { lang: 'uk', name: 'УНІАН', url: 'https://rss.unian.net/site/news_ukr.rss', filter: true },
  { lang: 'uk', name: 'РБК-Україна', url: 'https://www.rbc.ua/static/rss/all.ukr.rss.xml', filter: true },
  { lang: 'uk', name: 'НВ', url: 'https://nv.ua/ukr/rss/all.xml', filter: true },
  { lang: 'uk', name: '24 Канал', url: 'https://24tv.ua/rss/all.xml', filter: true },
  { lang: 'uk', name: 'Главред', url: 'https://glavred.net/rss', filter: true },
  { lang: 'uk', name: 'ZAXID.NET', url: 'https://zaxid.net/rss/all.xml', filter: true },
  { lang: 'uk', name: 'Радіо Свобода', url: 'https://www.radiosvoboda.org/api/zrqiteuuir', filter: true },
];
// слово має починатися з цих основ (щоб «редактор» не ловився як «актор»)
const KINO = /(?<!\p{L})(кіно(?!а)|фільм|серіал|кінопрем|трейлер|режисер|актор|акторк|мультфільм|мультсеріал|аніме|оскар|берлінале|netflix|кінофестивал|кінотеатр|голлівуд|кастинг)/iu;
const NOT_KINO = /(?<!\p{L})(вистав|театр|концерт|альбом|пісн|виставк|книжк|роман\b)/iu;
const RUSSIAN = /[ыэъё]/i;                      // російськомовні заголовки
const BAD_DOMAIN = /^https?:\/\/[^/]*\.(ru|by)(\/|$)|\/(rus|ru)\//i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, ms = 12000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, application/json, text/html;q=0.8' }, signal: c.signal, redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); } finally { clearTimeout(t); }
}
const decode = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const strip = s => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (x, n) => { const m = x.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, 'i')); return m ? m[1] : ''; };
const attr = (x, re) => { const m = x.match(re); return m ? decode(m[1]) : ''; };

function parseRss(xml, src) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map(b => {
    const title = strip(tag(b, 'title'));
    let link = strip(tag(b, 'link')) || attr(b, /<link[^>]+href="([^"]+)"/i);
    const desc = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content');
    const img = attr(b, /<media:content[^>]+url="([^"]+)"/i) || attr(b, /<media:thumbnail[^>]+url="([^"]+)"/i)
      || attr(b, /<enclosure[^>]+url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i) || attr(decode(desc), /<img[^>]+src="([^"]+)"/i);
    const date = strip(tag(b, 'pubDate')) || strip(tag(b, 'published')) || strip(tag(b, 'updated')) || strip(tag(b, 'dc:date'));
    return { title, url: link, img, date: date ? new Date(date).toISOString() : '', sum: strip(desc).slice(0, 220), src: src.name, lang: src.lang };
  }).filter(x => x.title && x.url);
}
async function gdelt(src) {
  const q = encodeURIComponent(src.gdelt);
  const j = JSON.parse(await get(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=40&sort=datedesc&timespan=3d`));
  return (j.articles || []).map(a => ({ title: a.title, url: a.url, img: a.socialimage || '', date: a.seendate ? a.seendate.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z') : '', sum: '', src: a.domain || 'GDELT', lang: src.lang }));
}
async function ogImage(url) {
  try { const h = await get(url, 8000); return attr(h, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || attr(h, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i); } catch { return ''; }
}

const report = [];
let all = [];
for (const s of SOURCES) {
  try {
    let items = s.gdelt ? await gdelt(s) : parseRss(await get(s.url), s);
    const n0 = items.length;
    if (s.filter) items = items.filter(x => KINO.test(x.title) && !NOT_KINO.test(x.title));
    if (s.kino) items = items.filter(x => !NOT_KINO.test(x.title));
    items.forEach(x => { if (/^https:\/\/([a-z]+\.)?rbc\.ua\/rus\//.test(x.url)) x.url = x.url.replace('/rus/', '/ukr/'); });
    const n1 = items.length, sample = items[0] ? items[0].url : '';
    items = items.filter(x => !RUSSIAN.test(x.title) && !BAD_DOMAIN.test(x.url) && /^https:\/\//.test(x.url));
    report.push(`✓ ${s.name}: ${n0} → кіно ${n1} → ${items.length}${n1 && !items.length ? ' (відсіяно, напр. ' + sample.slice(0, 60) + ')' : ''}`); all = all.concat(items.slice(0, 20));
  } catch (e) { report.push(`✗ ${s.name}: ${e.message}`); }
  await sleep(300);
}
const trCache = new Map();
// додати новини з попереднього запуску (останні 7 днів), щоб стрічка накопичувалась
try {
  const prev = JSON.parse(await get('https://raw.githubusercontent.com/Satilus/Home/news-data/news.json?t=' + Date.now()));
  const fresh = x => x.date && Date.now() - new Date(x.date) < 7 * 864e5;
  (prev.items || []).filter(x => x.lang === 'en' && x.tr && x.orig).forEach(x => trCache.set(x.url.split('?')[0], x));
  const keep = (prev.items || []).filter(x => fresh(x) && ((x.lang === 'uk' && KINO.test(x.title) && !NOT_KINO.test(x.title) && !RUSSIAN.test(x.title) && !BAD_DOMAIN.test(x.url)) || (x.lang === 'en' && x.tr)));
  report.push(`↺ з попереднього запуску: ${keep.length}`); all = all.concat(keep);
} catch (e) { report.push('↺ попередня стрічка недоступна'); }
// прибрати дублікати за посиланням і схожими заголовками
const seen = new Set();
all = all.filter(x => { const k = x.url.split('?')[0]; const t = x.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 60); if (seen.has(k) || seen.has(t)) return false; seen.add(k); seen.add(t); return true; });
all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const uk = all.filter(x => x.lang === 'uk').slice(0, 80), en = all.filter(x => x.lang === 'en').slice(0, 70);

// ---------- автоматичний переклад світових новин українською ----------
async function gtx(text) {
  const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=uk&dt=t&q=' + encodeURIComponent(text);
  const j = JSON.parse(await get(u, 10000));
  return (j[0] || []).map(p => p[0]).join('');
}
async function mymemory(text) {
  const j = JSON.parse(await get('https://api.mymemory.translated.net/get?langpair=en|uk&q=' + encodeURIComponent(text.slice(0, 480)), 10000));
  const t = j && j.responseData && j.responseData.translatedText;
  if (!t || /MYMEMORY WARNING|QUERY LENGTH/i.test(t)) throw new Error('mymemory');
  return t;
}
let trOk = 0, trFail = 0, trReused = 0, trEngine = {};
async function translate(text) {
  if (!text) return '';
  for (const [name, fn] of [['google', gtx], ['mymemory', mymemory]]) {
    try { const t = (await fn(text)).trim(); if (t) { trEngine[name] = (trEngine[name] || 0) + 1; return t; } } catch (e) {}
  }
  throw new Error('переклад недоступний');
}
for (const x of en) {
  const c = trCache.get(x.url.split('?')[0]);
  if (c) { x.orig = c.orig; x.title = c.title; x.sum = c.sum; x.tr = true; trReused++; continue; }
  try {
    const sep = '\n\n§§\n\n';
    const out = await translate(x.title + (x.sum ? sep + x.sum : ''));
    const [t, ...rest] = out.split(/\s*§§\s*/);
    x.orig = x.title; x.title = t.trim(); x.sum = rest.join(' ').trim(); x.tr = true; trOk++;
  } catch (e) { x.tr = false; trFail++; }
  await sleep(250);
}
report.push(`🌐 переклад: нових ${trOk}, з кешу ${trReused}, не вдалося ${trFail} ${JSON.stringify(trEngine)}`);
const enShown = en.filter(x => x.tr);   // без перекладу не показуємо

// прев'ю для тих, у кого немає картинки (og:image статті)
const need = uk.concat(en).filter(x => !x.img).slice(0, 70);
for (let i = 0; i < need.length; i += 6) await Promise.all(need.slice(i, i + 6).map(async x => { x.img = await ogImage(x.url); }));
const fix = u => /^https:\/\//.test(u) ? u : (/^\/\//.test(u) ? 'https:' + u : '');
const out = { updated: new Date().toISOString(), sources: report, items: uk.concat(enShown).map(x => ({ ...x, img: fix(x.img) })) };
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/news.json', JSON.stringify(out));
console.log(report.join('\n'));
console.log(`Україна: ${uk.length}, світ (перекладено): ${enShown.length}, з прев'ю: ${out.items.filter(x => x.img).length}`);
