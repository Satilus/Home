// «Тю і Шо глянемо» — сповіщення про нові серії.
// Запускається GitHub Actions щогодини. Читає твій приватний Gist (дані сайту), перевіряє TVmaze
// для серіалів зі статусом «Дивлюся» і надсилає web-push на підписані пристрої.
// Секрет: GIST_TOKEN (токен з доступом gist — той самий, що для синхронізації). Ключі в коді не зберігаються.
import webpush from 'web-push';

const TOKEN = process.env.GIST_TOKEN;
const SITE = 'https://satilus.github.io/Home/';
const FILE = 'tyuisho.json', STATE = 'push-state.json';
const WINDOW_H = Number(process.env.WINDOW_H || 30);
const fetchFn = globalThis.__fetch || fetch;

if (!TOKEN) { console.log('Немає секрету GIST_TOKEN — сповіщення вимкнені. Додай його в Settings → Secrets and variables → Actions.'); process.exit(0); }
const gh = async (path, opt = {}) => {
  const r = await fetchFn('https://api.github.com' + path, { ...opt, headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'tyuisho-notify' } });
  if (!r.ok) throw new Error(`GitHub ${r.status} ${path}`);
  return r.json();
};
const fileText = async f => f.truncated ? (await fetchFn(f.raw_url)).text() : f.content;

let gist = null;
for (let page = 1; page <= 5 && !gist; page++) {
  const list = await gh(`/gists?per_page=100&page=${page}`);
  gist = list.find(g => g.files && g.files[FILE]);
  if (list.length < 100) break;
}
if (!gist) { console.log('Gist із даними сайту не знайдено — увімкни синхронізацію на сайті.'); process.exit(0); }
const full = await gh('/gists/' + gist.id);
const snap = JSON.parse(await fileText(full.files[FILE]));
const parse = k => { try { return JSON.parse(snap.data[k] || 'null'); } catch { return null; } };
const items = parse('lists.items') || [], pushCfg = parse('lists.push') || {};
if (!pushCfg.vapid || !(pushCfg.subs || []).length) { console.log('Немає підписаних пристроїв.'); process.exit(0); }
const state = full.files[STATE] ? JSON.parse(await fileText(full.files[STATE])) : { notified: {}, dead: [] };
state.notified ||= {}; state.dead ||= [];

webpush.setVapidDetails(SITE, pushCfg.vapid.pub, pushCfg.vapid.d);
const subs = pushCfg.subs.filter(s => !state.dead.includes(s.endpoint));
const watching = items.filter(i => i.status === 'watching' && i.tvm);
const now = Date.now(); let sent = 0;

for (const it of watching) {
  let show;
  try { show = await (await fetchFn(`https://api.tvmaze.com/shows/${it.tvm}?embed[]=previousepisode`)).json(); } catch { continue; }
  const ep = show && show._embedded && show._embedded.previousepisode; if (!ep || !ep.airstamp) continue;
  const at = new Date(ep.airstamp).getTime();
  const key = `${it.tvm}:${ep.season}.${ep.number}`;
  if (now - at > WINDOW_H * 3600e3 || at > now || state.notified[key]) continue;
  if ((it.seen || []).includes(`${ep.season}.${ep.number}`)) { state.notified[key] = now; continue; }
  const payload = JSON.stringify({ title: `Нова серія: ${it.title}`, body: `Сезон ${ep.season}, серія ${ep.number}${ep.name ? ' «' + ep.name + '»' : ''} уже вийшла`, url: `kino.html#open=${encodeURIComponent(it.id)}`, tag: key });
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 86400 }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) state.dead.push(s.endpoint); console.log('Помилка надсилання:', e.statusCode || e.message); }
  }
  state.notified[key] = now;
}
// прибрати старі записи (старші за 60 днів)
for (const [k, t] of Object.entries(state.notified)) if (now - t > 60 * 864e5) delete state.notified[k];
await gh('/gists/' + gist.id, { method: 'PATCH', body: JSON.stringify({ files: { [STATE]: { content: JSON.stringify(state) } } }) });
console.log(`Перевірено серіалів: ${watching.length}, надіслано сповіщень: ${sent}.`);
