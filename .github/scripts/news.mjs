// «Тю і Шо глянемо» — збирач стрічки новин кіно. Запускається GitHub Actions.
// Читає RSS кіновидань (і GDELT), додає прев'ю (з RSS або og:image статті), відсіює російське,
// і записує news.json, який сайт читає з гілки news-data. Без ключів і залежностей.
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (compatible; TyuiShoNewsBot/1.0; +https://satilus.github.io/Home/)';
const SOURCES = [
  // Лише українськомовні видання; загальні стрічки фільтруються за кіно-словами в заголовку
  { lang: 'uk', name: 'Укрінформ', url: 'https://www.ukrinform.ua/rss/rubric-culture', filter: true },
  { lang: 'uk', name: 'Укрінформ', url: 'https://www.ukrinform.ua/rss/block-lastnews', filter: true },
  { lang: 'uk', name: 'Детектор медіа', url: 'https://detector.media/rss/', filter: true },
  { lang: 'uk', name: 'Українська правда. Життя', url: 'https://life.pravda.com.ua/rss/', filter: true },
  { lang: 'uk', name: 'Українська правда', url: 'https://www.pravda.com.ua/rss/', filter: true },
  { lang: 'uk', name: 'ТСН', url: 'https://tsn.ua/rss/full.rss', filter: true },
  { lang: 'uk', name: 'УНІАН', url: 'https://rss.unian.net/site/news_ukr.rss', filter: true },
  { lang: 'uk', name: 'РБК-Україна', url: 'https://www.rbc.ua/static/rss/all.ukr.rss.xml', filter: true },
  { lang: 'uk', name: 'НВ', url: 'https://nv.ua/ukr/rss/all.xml', filter: true },
  { lang: 'uk', name: '24 Канал', url: 'https://24tv.ua/rss/all.xml', filter: true },
  { lang: 'uk', name: 'Главред', url: 'https://glavred.net/rss', filter: true },
  { lang: 'uk', name: 'Обозреватель', url: 'https://www.obozrevatel.com/ukr/rss.xml', filter: true },
  { lang: 'uk', name: 'ZAXID.NET', url: 'https://zaxid.net/rss/all.xml', filter: true },
  { lang: 'uk', name: 'LB.ua', url: 'https://lb.ua/rss/ukr/news.xml', filter: true },
  { lang: 'uk', name: 'Радіо Свобода', url: 'https://www.radiosvoboda.org/api/zrqiteuuir', filter: true },
  { lang: 'uk', name: 'Еспресо', url: 'https://espreso.tv/rss', filter: true },
  { lang: 'uk', name: 'Фокус', url: 'https://focus.ua/uk/rss', filter: true },
  { lang: 'uk', name: 'Новини.LIVE', url: 'https://novyny.live/rss', filter: true },
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
    items = items.filter(x => !RUSSIAN.test(x.title) && !BAD_DOMAIN.test(x.url) && /^https:\/\//.test(x.url));
    report.push(`✓ ${s.name}: ${n0} → ${items.length}`); all = all.concat(items.slice(0, 20));
  } catch (e) { report.push(`✗ ${s.name}: ${e.message}`); }
  await sleep(300);
}
// прибрати дублікати за посиланням і схожими заголовками
const seen = new Set();
all = all.filter(x => { const k = x.url.split('?')[0]; const t = x.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 60); if (seen.has(k) || seen.has(t)) return false; seen.add(k); seen.add(t); return true; });
all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const uk = all.filter(x => x.lang === 'uk').slice(0, 80), en = [];
// прев'ю для тих, у кого немає картинки (og:image статті)
const need = uk.filter(x => !x.img).slice(0, 60);
for (let i = 0; i < need.length; i += 6) await Promise.all(need.slice(i, i + 6).map(async x => { x.img = await ogImage(x.url); }));
const fix = u => /^https:\/\//.test(u) ? u : (/^\/\//.test(u) ? 'https:' + u : '');
const out = { updated: new Date().toISOString(), sources: report, items: uk.concat(en).map(x => ({ ...x, img: fix(x.img) })) };
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/news.json', JSON.stringify(out));
console.log(report.join('\n'));
console.log(`Новин: ${uk.length}, з прев'ю: ${out.items.filter(x => x.img).length}`);
