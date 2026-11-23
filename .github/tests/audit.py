"""Автотест «Тю і Шо глянемо»: емуляція iPhone SE / 15 / Pro Max, світла й темна тема, сенсорні жести.
Зовнішні сервіси підміняються тестовими даними. Запуск: python3 .github/tests/audit.py (сайт має віддаватися на BASE)."""
import asyncio, json, sys, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
POSTER = os.path.join(HERE, "poster.jpg")
OUT = os.environ.get("AUDIT_OUT", "/tmp/audit"); os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
from playwright.async_api import async_playwright
BASE=os.environ.get("BASE","http://localhost:8765/")
RES=[]; SHOTS=[]
def check(name, ok, info=""):
    RES.append((("PASS" if ok else "FAIL"), name, info))
EPS=[{"season":s,"number":n,"name":f"Серія {n}","airstamp":("2023-01-%02dT00:00:00Z"%n) if s==1 else ("2025-0%d-01T00:00:00Z"%min(n,9) if n<=5 else "2027-01-01T00:00:00Z")} for s in (1,2) for n in range(1,9)]
async def route(r):
    u=r.request.url
    if u.startswith(BASE): return await r.continue_()
    if "poster" in u or "image" in u or "ytimg" in u or "wikimedia" in u or "tvmaze.com/uploads" in u: return await r.fulfill(path=POSTER,content_type="image/jpeg")
    if "fonts.googleapis" in u: return await r.fulfill(body="",content_type="text/css")
    if "api.tvmaze.com/search/shows" in u: return await r.fulfill(json=[{"show":{"id":4242,"name":"Test Show","premiered":"2024-01-01","language":"English","network":{"country":{"code":"US"}},"image":{"medium":"https://static.tvmaze.com/uploads/p.jpg"}}}])
    if "api.tvmaze.com/schedule" in u: return await r.fulfill(json=[{"airdate":"2026-11-20","season":1,"number":1,"show":{"id":5000+i,"name":f"Новинка {i}","type":"Scripted","language":"English","weight":90,"network":{"name":"HBO","country":{"code":"US"}},"image":{"medium":"https://static.tvmaze.com/uploads/n.jpg"},"premiered":"2026-11-20"}} for i in range(6)])
    if "api.tvmaze.com/shows/" in u:
        if u.split("?")[0].endswith("/episodes"): return await r.fulfill(json=EPS)
        if u.endswith("/images") or u.endswith("/cast"): return await r.fulfill(json=[] if u.endswith("/images") else [{"person":{"name":"Актор Один","image":None},"character":{"name":"Герой"}}])
        sid=int(u.split("/shows/")[1].split("?")[0].split("/")[0])
        return await r.fulfill(json={"id":sid,"name":"X","genres":[["Drama","Science-Fiction"],["Comedy"],["Thriller","Crime"]][sid%3],"averageRuntime":[25,45,60][sid%3],"status":"Running","image":{"medium":"https://static.tvmaze.com/uploads/p.jpg"},"summary":"<p>Опис</p>","rating":{"average":8.1},"premiered":"2021-01-01",
            "_embedded":{"nextepisode":{"season":2,"number":6,"airstamp":"2026-11-25T02:00:00Z"},"previousepisode":{"season":2,"number":5,"airstamp":"2026-11-18T02:00:00Z"}}})
    if "graphql.anilist.co" in u:
        body=r.request.post_data or ""
        if "Page" in body and "countryOfOrigin" in body: return await r.fulfill(json={"data":{"Page":{"media":[{"id":777,"countryOfOrigin":"JP","title":{"romaji":"Test Anime","english":"Test Anime"},"startDate":{"year":2024},"coverImage":{"medium":"https://poster/a.jpg"}}]}}})
        return await r.fulfill(json={"data":{"Media":{"id":1,"startDate":{"year":2023},"coverImage":{"large":"https://poster/a.jpg"},"averageScore":88,"episodes":12,"genres":["Fantasy","Adventure"],"duration":24,"description":"Опис аніме","status":"FINISHED","bannerImage":None,"streamingEpisodes":[],"characters":{"edges":[]},"trailer":{"id":"abc","site":"youtube"},"recommendations":{"nodes":[]}},
            "Page":{"media":[{"id":1,"startDate":{"year":2023},"coverImage":{"large":"https://poster/a.jpg"},"averageScore":88,"episodes":12,"genres":["Fantasy"],"duration":24,"description":"x","status":"FINISHED","trailer":{"id":"abc","site":"youtube"},"recommendations":{"nodes":[]},"characters":{"edges":[]},"streamingEpisodes":[]}]}}})
    if "wikidata.org/w/api.php" in u and "sites=enwiki" in u:
        return await r.fulfill(json={"entities":{"Q2":{"claims":{"P57":[{"mainsnak":{"datavalue":{"value":{"id":"Q10"}}}}],"P2047":[{"mainsnak":{"datavalue":{"value":{"amount":"+118"}}}}],"P136":[{"mainsnak":{"datavalue":{"value":{"id":"Q30"}}}}],"P1651":[{"mainsnak":{"datavalue":{"value":"dQw4w9WgXcQ"}}}]}}}})
    if "wikidata.org/w/api.php" in u: return await r.fulfill(json={"entities":{"Q10":{"labels":{"uk":{"value":"Режисер Тест"}}},"Q30":{"labels":{"uk":{"value":"драматичний фільм"}}}}})
    if "query.wikidata.org" in u: return await r.fulfill(json={"results":{"bindings":[]}})
    if "wikipedia.org" in u:
        if "generator=search" in u: return await r.fulfill(json={"query":{"pages":{"1":{"index":1,"title":"Test Film (2024 film)","description":"2024 American film","extract":"Опис фільму","thumbnail":{"source":"https://poster/w.jpg"}}}}})
        return await r.fulfill(json={"query":{"pages":{"1":{"title":"T","extract":"Опис","thumbnail":{"source":"https://poster/w.jpg"},"pageimage":"x.jpg"}}}})
    if "youtube" in u: return await r.fulfill(body="<html><body style='background:#000'></body></html>",content_type="text/html")
    return await r.abort()

async def run_device(p, name, vp, scheme, reduce=False, deep=True):
    b = p["b"]
    ctx = await b.new_context(viewport=vp, device_scale_factor=3, is_mobile=True, has_touch=True, color_scheme=scheme, reduced_motion="reduce" if reduce else "no-preference",
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
    await ctx.route("**/*", route)
    pg = await ctx.new_page(); errs=[]; cons=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: cons.append(m.text) if m.type=="error" else None)
    tag=f"{name}/{scheme}"
    async def overflow(where):
        w = await pg.evaluate("[document.documentElement.scrollWidth, innerWidth, [...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(); return r.right>innerWidth+1 && getComputedStyle(e).position!=='fixed' && !e.closest('.row,.cols-row,.chips2,.pills,.simrow,.ss-tabs,.gchips,.shots,.cast,#news,.stack,.sheet,.ctx,#splash,.navbar')}).slice(0,3).map(e=>e.tagName+'.'+e.className)]")
        check(f"{tag} {where}: немає горизонтального переповнення", w[0] <= w[1] + 1 and not w[2], str(w))
    # ---------- ГОЛОВНА ----------
    await pg.goto(BASE+"kino.html"); await pg.wait_for_timeout(400)   # засіяти дані
    await pg.goto(BASE+"index.html"); await pg.wait_for_timeout(1200)
    sp = await pg.locator("#splash").count()
    check(f"{tag} заставка показується при першому вході", sp==1)
    await pg.screenshot(path=f"{OUT}/{name}-{scheme}-splash.png"); SHOTS.append(f"{name}-{scheme}-splash")
    if sp: await pg.mouse.click(vp["width"]//2, vp["height"]//2); await pg.wait_for_timeout(1000)
    check(f"{tag} заставка закривається дотиком", await pg.locator("#splash").count()==0)
    await pg.reload(); await pg.wait_for_timeout(800)
    check(f"{tag} заставка не повторюється в тій самій сесії", await pg.locator("#splash").count()==0)
    await pg.wait_for_timeout(1500)
    await pg.screenshot(path=f"{OUT}/{name}-{scheme}-home.png", full_page=True); SHOTS.append(f"{name}-{scheme}-home")
    await overflow("Головна")
    h1 = await pg.locator("h1").text_content(); check(f"{tag} привітання в заголовку", h1 and "Добр" in h1, h1)
    check(f"{tag} рядок статистики", await pg.locator("#stats b").count()==3)
    check(f"{tag} новинки завантажились", await pg.locator("#news .card").count()>0)
    # додати новинку
    if await pg.locator("#news .add:not([disabled])").count():
        await pg.locator("#news .add:not([disabled])").first.tap(); await pg.wait_for_timeout(400)
        check(f"{tag} «+» у новинках додає в план", "додано" in (await pg.locator("#toast").text_content() or ""))
    # налаштування
    await pg.locator("#btnSettings").tap(); await pg.wait_for_timeout(700)
    check(f"{tag} налаштування відкриваються", await pg.locator("#keyIn").count()==1)
    txt = await pg.locator("#pushSet").text_content(); check(f"{tag} блок сповіщень показує підказку", txt and len(txt)>30, txt[:80] if txt else "")
    await pg.screenshot(path=f"{OUT}/{name}-{scheme}-settings.png"); SHOTS.append(f"{name}-{scheme}-settings")
    await pg.locator("#hov .done").first.tap(); await pg.wait_for_timeout(400)
    check(f"{tag} налаштування закриваються «Готово»", await pg.locator("#hov").evaluate("e=>e.hidden"))
    # майстер
    await pg.locator("#wizBtn").tap(); await pg.wait_for_timeout(500)
    for k in ["mood:warm","time:short","company:solo"]:
        await pg.locator(f'[data-wz="{k}"]').tap(); await pg.wait_for_timeout(450)
    n = await pg.locator(".wz-card").count(); check(f"{tag} майстер дає поради", n>=1, str(n))
    await pg.screenshot(path=f"{OUT}/{name}-{scheme}-wizard.png"); SHOTS.append(f"{name}-{scheme}-wizard")
    await pg.locator("[data-again]").tap(); await pg.wait_for_timeout(300)
    check(f"{tag} «Ще варіанти» працює", await pg.locator(".wz-card").count()>=1)
    await pg.locator("#hov .done").first.tap(); await pg.wait_for_timeout(300)
    # рік
    await pg.locator("#yearBtn").tap(); await pg.wait_for_timeout(500)
    check(f"{tag} «Мій рік» відкривається", await pg.locator(".yr").count()==1)
    await pg.screenshot(path=f"{OUT}/{name}-{scheme}-year.png"); SHOTS.append(f"{name}-{scheme}-year")
    async with pg.expect_download(timeout=5000) as dl:
        await pg.locator("[data-share]").tap()
    d = await dl.value; check(f"{tag} листівка року генерується (PNG)", d.suggested_filename.endswith(".png"), d.suggested_filename)
    await pg.locator("#hov .done").first.tap(); await pg.wait_for_timeout(300)
    # Дані
    await pg.locator("#syncBtn").tap(); await pg.wait_for_timeout(500)
    check(f"{tag} «Дані» відкриваються", await pg.locator(".syncov:not([hidden])").count()==1)
    async with pg.expect_download(timeout=5000) as dl2:
        await pg.locator("[data-exp]").tap()
    d2 = await dl2.value; path = await d2.path(); snap=json.load(open(path))
    check(f"{tag} резервна копія містить список", "lists.items" in snap.get("data",{}) and "lists.tmdb" not in snap["data"], d2.suggested_filename)
    await pg.locator(".syncov [data-x]").last.tap(); await pg.wait_for_timeout(300)
    # продовжити перегляд → картка
    if await pg.locator("#watchingSec a.card").count():
        await pg.locator("#watchingSec a.card").first.tap(); await pg.wait_for_timeout(1500)
        check(f"{tag} «Продовжити перегляд» відкриває картку в Кінотеатрі", "kino.html" in pg.url and not await pg.locator("#ov").evaluate("e=>e.hidden"), pg.url)
    # ---------- КІНОТЕАТР ----------
    await pg.goto(BASE+"kino.html"); await pg.wait_for_timeout(2500)
    await overflow("Кінотеатр")
    await pg.screenshot(path=f"{OUT}/{name}-{scheme}-kino.png"); SHOTS.append(f"{name}-{scheme}-kino")
    for t in ["movie","anime","series"]:
        await pg.locator(f'[data-type="{t}"]').tap(); await pg.wait_for_timeout(350)
        check(f"{tag} вкладка {t}", (await pg.evaluate("JSON.parse(localStorage.getItem('lists.ui')).type"))==t)
    for st in ["watched","watching","planned"]:
        await pg.locator(f'[data-status="{st}"]').tap(); await pg.wait_for_timeout(250)
    check(f"{tag} статуси перемикаються", (await pg.evaluate("JSON.parse(localStorage.getItem('lists.ui')).status"))=="planned")
    before = await pg.locator("#grid .item").count()
    await pg.locator("#q").fill("зз_немає"); await pg.wait_for_timeout(300)
    check(f"{tag} пошук фільтрує", await pg.locator("#grid .item").count()==0 and not await pg.locator("#empty").evaluate("e=>e.hidden"))
    await pg.locator("#qx").tap(); await pg.wait_for_timeout(300)
    check(f"{tag} очищення пошуку", await pg.locator("#grid .item").count()==before, f"{before}")
    await pg.locator("#sort").select_option("title"); await pg.wait_for_timeout(300)
    titles = await pg.locator("#grid .ttl").all_text_contents()
    ok = await pg.evaluate("t => t.every((x,i)=> i===0 || t[i-1].localeCompare(x,'uk')<=0)", titles)
    check(f"{tag} сортування за назвою", ok, str(titles[:4]))
    await pg.locator("#sort").select_option("added"); await pg.wait_for_timeout(200)
    gchips = await pg.locator("#genres button[data-genre]").count()
    check(f"{tag} жанрові фільтри з'явились", gchips>1, str(gchips))
    if gchips>1:
        await pg.locator("#genres button[data-genre]").nth(1).tap(); await pg.wait_for_timeout(300)
        gn = await pg.locator("#grid .item").count(); await pg.locator('#genres button[data-genre=""]').tap(); await pg.wait_for_timeout(300)
        check(f"{tag} фільтр жанру працює", 0 < gn <= before, f"{gn}/{before}")
    check(f"{tag} жанри під назвами в списку", await pg.locator("#grid .gn:not(:empty)").count()>0)
    # додавання
    await pg.locator("#btnAdd").tap(); await pg.wait_for_timeout(400)
    await pg.locator("#addQ").fill("Test Show"); await pg.wait_for_timeout(1000)
    check(f"{tag} пошук при додаванні дає результат", await pg.locator("#res [data-add]").count()>0)
    if await pg.locator("#res [data-add]").count():
        await pg.locator('#res [data-add="0"]').tap(); await pg.wait_for_timeout(400)
        check(f"{tag} додавання серіалу", (await pg.evaluate("JSON.parse(localStorage.getItem('lists.items'))[0].tvm"))==4242)
        await pg.locator("#btnAdd").tap(); await pg.wait_for_timeout(300); await pg.locator("#addQ").fill("Test Show"); await pg.wait_for_timeout(1000)
        await pg.locator('#res [data-add="0"]').tap(); await pg.wait_for_timeout(300)
        check(f"{tag} дублікат не додається", "уже є" in (await pg.locator("#toastText").text_content() or ""))
        await pg.locator("#ov .done").first.tap(); await pg.wait_for_timeout(300)
    # картка
    await pg.locator("#grid .item .open").first.tap(); await pg.wait_for_timeout(1800)
    check(f"{tag} картка відкривається", not await pg.locator("#ov").evaluate("e=>e.hidden"))
    await pg.screenshot(path=f"{OUT}/{name}-{scheme}-sheet.png"); SHOTS.append(f"{name}-{scheme}-sheet")
    check(f"{tag} фон картки з постера", await pg.locator("#ovBgImg").count()==1)
    check(f"{tag} сітка сезонів", await pg.locator(".ss-grid .epi").count()>0)
    if await pg.locator(".ss-grid .epi:not([disabled])").count():
        await pg.locator(".ss-grid .epi:not([disabled])").nth(1).tap(); await pg.wait_for_timeout(500)
        check(f"{tag} відмітка серії", await pg.locator(".ss-grid .epi.on").count()>=1)
        await pg.locator("[data-ssall]").first.tap(); await pg.wait_for_timeout(500)
        check(f"{tag} «Весь сезон»", await pg.locator(".ss-grid .epi.on").count()>=8 or await pg.locator(".ss-grid .epi.on").count()==0)
    sh = await pg.evaluate("(()=>{const s=document.querySelector('#sheet');return [s.scrollHeight,s.clientHeight]})()")
    check(f"{tag} картка прокручується", sh[0] > sh[1], str(sh))
    await pg.locator("#myNote").fill("Тестова нотатка"); await pg.locator("#myNote").blur(); await pg.wait_for_timeout(200)
    nid = await pg.locator("#ov").get_attribute("data-id")
    note = await pg.evaluate(f"JSON.parse(localStorage.getItem('lists.items')).find(i=>i.id==='{nid}').note")
    check(f"{tag} нотатка зберігається", note=="Тестова нотатка", str(note))
    await pg.locator('[data-watch]').tap(); await pg.wait_for_timeout(700)
    check(f"{tag} «Позначити переглянутим» показує перчики", await pg.locator(".pep button").count()==5)
    await pg.locator('.pep [data-pep="5"]').tap(); await pg.wait_for_timeout(300)
    check(f"{tag} вогник ставиться", (await pg.evaluate(f"JSON.parse(localStorage.getItem('lists.items')).find(i=>i.id==='{nid}').pep"))==5)
    await pg.locator("#ov .done").first.tap(); await pg.wait_for_timeout(400)
    check(f"{tag} картка закривається", await pg.locator("#ov").evaluate("e=>e.hidden"))
    # фільм: трейлер, колекції
    await pg.locator('[data-type="movie"]').tap(); await pg.wait_for_timeout(300)
    await pg.locator('[data-status="planned"]').tap(); await pg.wait_for_timeout(1500)
    await pg.locator("#grid .item .open").first.tap(); await pg.wait_for_timeout(2500)
    hasTr = await pg.locator("[data-play]").count()
    check(f"{tag} трейлер у картці фільму", hasTr==1)
    if hasTr:
        await pg.locator("[data-play]").tap(); await pg.wait_for_timeout(500)
        ifr = await pg.locator(".trailer iframe").get_attribute("referrerpolicy")
        check(f"{tag} трейлер вбудовується з referrerpolicy", ifr=="strict-origin-when-cross-origin")
    check(f"{tag} кнопка колекції режисера", await pg.locator("#scol button").count()>=1)
    await pg.locator("#ov .done").first.tap(); await pg.wait_for_timeout(400)
    check(f"{tag} трейлер зупиняється при закритті", await pg.locator(".trailer iframe").count()==0)
    # свайп вліво (сенсор)
    box = await pg.locator("#grid .item .open").first.bounding_box(); first_id = await pg.locator("#grid .item .open").first.get_attribute("data-open")
    cdp = await ctx.new_cdp_session(pg)
    async def touch(points, kind):
        await cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": points})
    x0, y0 = box["x"]+box["width"]*0.7, box["y"]+box["height"]*0.4
    await touch([{"x":x0,"y":y0}], "touchStart")
    for i in range(1,13): await touch([{"x":x0-i*12,"y":y0}], "touchMove"); await pg.wait_for_timeout(16)
    await touch([], "touchEnd"); await pg.wait_for_timeout(700)
    st = await pg.evaluate(f"JSON.parse(localStorage.getItem('lists.items')).find(i=>i.id==='{first_id}').status")
    check(f"{tag} свайп вліво → переглянуто (дотик)", st=="watched", st)
    # довге натискання (сенсор)
    box = await pg.locator("#grid .item .open").first.bounding_box()
    await touch([{"x":box["x"]+40,"y":box["y"]+60}], "touchStart"); await pg.wait_for_timeout(700); await touch([], "touchEnd"); await pg.wait_for_timeout(500)
    check(f"{tag} довге натискання відкриває меню", await pg.locator(".ctx-menu").count()==1)
    await pg.screenshot(path=f"{OUT}/{name}-{scheme}-menu.png"); SHOTS.append(f"{name}-{scheme}-menu")
    check(f"{tag} після довгого натискання картка не відкрилась", await pg.locator("#ov").evaluate("e=>e.hidden"))
    if await pg.locator(".ctx-menu").count():
        await pg.locator('.ctx-menu [data-m="x"], .ctx-bg').first.tap(position={"x":5,"y":5}); await pg.wait_for_timeout(400)
    # вертикальне прокручування з пальця на постері не має міняти статус
    box = await pg.locator("#grid .item .open").nth(0).bounding_box(); sid=await pg.locator("#grid .item .open").nth(0).get_attribute("data-open"); s0=await pg.evaluate(f"JSON.parse(localStorage.getItem('lists.items')).find(i=>i.id==='{sid}').status")
    await touch([{"x":box["x"]+50,"y":box["y"]+150}], "touchStart")
    for i in range(1,12): await touch([{"x":box["x"]+50+i*1.5,"y":box["y"]+150-i*14}], "touchMove"); await pg.wait_for_timeout(16)
    await touch([], "touchEnd"); await pg.wait_for_timeout(500)
    s1=await pg.evaluate(f"JSON.parse(localStorage.getItem('lists.items')).find(i=>i.id==='{sid}').status")
    check(f"{tag} вертикальний жест не міняє статус і не відкриває меню", s0==s1 and await pg.locator(".ctx-menu").count()==0 and await pg.locator("#ov").evaluate("e=>e.hidden"))
    # лінза: дотик до перемикача не має стрибати
    tb = await pg.locator("#types").bounding_box()
    await touch([{"x":tb["x"]+30,"y":tb["y"]+20}], "touchStart"); await pg.wait_for_timeout(120)
    lens = await pg.locator("#types.lensing").count(); await touch([], "touchEnd"); await pg.wait_for_timeout(400)
    check(f"{tag} дотик без руху не вмикає лінзу", lens==0)
    # прокручування: довгі кадри
    fr = await pg.evaluate("""() => new Promise(res => { let t=performance.now(), n=0, long=0; const f=now=>{ const d=now-t; t=now; n++; if(d>34) long++; if(n<90){ scrollBy(0,22); requestAnimationFrame(f);} else res({n,long}); }; requestAnimationFrame(f); })""")
    check(f"{tag} прокручування без підвисань (кадри >34мс)", fr["long"] <= 3, str(fr))
    check(f"{tag} скляна панель зверху при прокручуванні", await pg.locator("body.scrolled").count()==1)
    # колекції
    await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(300)
    nc = await pg.locator(".colc").count()
    if nc:
        await pg.locator(".colc").first.tap(); await pg.wait_for_timeout(800)
        check(f"{tag} аркуш колекції", await pg.locator(".col-list .col-r").count()>=1)
        await pg.locator("#ov .done").first.tap(); await pg.wait_for_timeout(300)
    # нижня панель → Головна
    await pg.locator('.tabbar a[href="index.html"]').tap(); await pg.wait_for_timeout(800)
    check(f"{tag} вкладка «Головна» з нижньої панелі", pg.url.endswith("index.html"))
    check(f"{tag} немає помилок JavaScript", not errs, "; ".join(errs[:3]))
    check(f"{tag} немає помилок у консолі (крім мережі)", not [c for c in cons if "Failed to load resource" not in c and "net::" not in c], "; ".join(cons[:3]))
    await ctx.close()

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        P={"b":b}
        await run_device(P, "SE", {"width":320,"height":568}, "light")
        await run_device(P, "15", {"width":393,"height":852}, "dark")
        await run_device(P, "ProMax", {"width":430,"height":932}, "light", reduce=True)
        await b.close()
    fails=[r for r in RES if r[0]=="FAIL"]
    print(f"Всього перевірок: {len(RES)}, провалено: {len(fails)}")
    for r in fails: print("FAIL", r[1], "|", r[2][:200])
    sys.exit(1 if fails else 0)
asyncio.run(main())
