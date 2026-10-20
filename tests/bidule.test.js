// Le comportement du Bidule dans la page de test : mise run tests
const {test, before, after} = require("node:test");
const assert = require("node:assert/strict");
const {demarrer} = require("./page");

let sim;
before(async () => { sim = await demarrer(); });
after(async () => { await sim.fermer(); });

test("la vie ne commence qu'une fois le Bidule choisi chargé", async () => {
  const page = await sim.ouvrir({delai: {lire_choix: 1200}, attendre: false});
  await page.evaluate(() => { window.TICKS = 0; const vrai = tick; tick = (...a) => { TICKS++; return vrai(...a); }; });
  await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(() => [chosen, TICKS]), [false, 0]);
  await page.waitForFunction(() => chosen && TICKS > 5, null, {timeout: 5000});
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("la fenêtre ne reçoit que la dernière position, et rien si elle y est déjà", async () => {
  const page = await sim.ouvrir();
  const n = await page.evaluate(async () => {
    Horloge.arreter();
    const compte = () => CALLS.filter(c => c[1] === "setPosition").length;
    await Fenetre.aller(300, 400);
    const a = compte();
    await Fenetre.aller(300, 400); await Fenetre.aller(300.2, 399.8);
    const b = compte();
    for (let i = 0; i < 20; i++) Fenetre.aller(300 + i, 400);
    await Fenetre.aller(500, 400);
    const pos = CALLS.filter(c => c[1] === "setPosition");
    return [a, b, compte() - b, pos[pos.length - 1][2].x];
  });
  assert.equal(n[0], 1);
  assert.equal(n[1], 1, "même position : pas d'appel");
  assert.ok(n[2] <= 2, `rafale de 21 positions : ${n[2]} appels`);
  assert.equal(n[3], 500);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("l'icône de la barre de menu part en octets PNG, seulement quand l'image change", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const r = await page.evaluate(async () => {
    CALLS.length = 0;
    await new Promise(r => setTimeout(r, 2000));
    const ic = CALLS.filter(c => c[1] === "icone").map(c => c[2]);
    const durMin = Math.min(...Object.values(SHEET_DATA.limace.tags).flat().map(f => f.dur));
    return {n: ic.length, octets: ic.every(a => a instanceof Uint8Array && a[0] === 137 && a[1] === 80), max: Math.ceil(2000 / durMin) + 1};
  });
  assert.ok(r.n > 0, "aucune icône envoyée");
  assert.ok(r.octets, "l'icône n'est pas un PNG en octets");
  assert.ok(r.n <= r.max, `${r.n} icônes en 2 s, au plus ${r.max} attendues`);
  await page.close();
});

test("caché, il ne lit plus la souris ; loin, il la lit moins souvent", async () => {
  const page = await sim.ouvrir();
  const r = await page.evaluate(async () => {
    const att = ms => new Promise(r => setTimeout(r, ms));
    let n = 0, ou = {x: -5000, y: -5000};
    __TAURI__.window.cursorPosition = async () => { n++; return ou; };
    LISTEN["bidule-visible"].forEach(f => f({payload: false}));
    await att(200); n = 0; await att(1000); const cache = n;
    LISTEN["bidule-visible"].forEach(f => f({payload: true}));
    await att(300); n = 0; await att(1000); const loin = n;
    ou = {x: x + 88, y: y + 120}; await att(300); n = 0; await att(1000); const pres = n;
    return {cache, loin, pres};
  });
  assert.equal(r.cache, 0);
  assert.ok(r.loin >= 2 && r.loin <= 6, `loin : ${r.loin} lectures en 1 s`);
  assert.ok(r.pres > r.loin * 2, `près : ${r.pres} lectures, loin : ${r.loin}`);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

// tiré vite vers le haut depuis le sol : il se décolle, puis la fenêtre reprend sa taille d'un seul coup
test("tiré vite du sol, il se décolle même s'il pendait juste avant", async () => {
  const page = await sim.ouvrir();
  await page.evaluate(() => { setMode("walk"); x = 400; y = floorY; pull.wasHang = true; });
  await page.waitForTimeout(400);
  const box = await page.locator("img").first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * .6;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx, cy - 10); await page.mouse.move(cx, cy - 380); await page.mouse.move(cx + 300, cy - 380);
  await page.waitForFunction(() => !pull.on && ["held", "fly"].includes(mode), null, {timeout: 5000});
  const r = await page.evaluate(() => {
    const i = CALLS.findLastIndex(c => c[1] === "cadre" && c[2].w === WW);
    return {wasHang: pull.wasHang, petit: i >= 0, tailleSeule: CALLS.some(c => c[1] === "setSize" && c[2].w === WW)};
  });
  await page.mouse.up();
  assert.equal(r.wasHang, false);
  assert.ok(r.petit, "la fenêtre n'a pas repris sa taille");
  assert.equal(r.tailleSeule, false, "la fenêtre a repris sa taille comme après une pendaison");
  await page.waitForFunction(() => mode === "walk", null, {timeout: 10000});
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("tiré doucement du sol puis lâché, il revient en place et remarche", async () => {
  const page = await sim.ouvrir();
  await page.evaluate(() => { setMode("walk"); x = 400; y = floorY; });
  await page.waitForTimeout(400);
  const box = await page.locator("img").first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * .6;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let k = 1; k <= 10; k++) { await page.mouse.move(cx, cy - k * 3); await page.waitForTimeout(20); }
  await page.waitForFunction(() => pull.on && pull.phase === "ground");
  await page.mouse.up();
  await page.waitForFunction(() => !pull.on && mode === "walk", null, {timeout: 5000});
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("pris au plafond et tiré un peu, il y retourne", async () => {
  const page = await sim.ouvrir({taille: {width: 176, height: 176}});
  await page.evaluate(async () => {
    x = 600; y = 20; vx = 0; vy = -22; setMode("fly"); peakY = null; dir = 1;
    for (let i = 0; i < 120 && mode !== "ceiling"; i++) await new Promise(r => setTimeout(r, 16));
    ceilingUntil = Date.now() + 60000; ceilSwingAt = 0;
  });
  assert.equal(await page.evaluate(() => mode), "ceiling");
  await page.waitForTimeout(600);
  const box = await page.locator("img").first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.waitForTimeout(300);
  for (let k = 1; k <= 30; k++) { await page.mouse.move(cx + k, cy + k * 4); await page.waitForTimeout(20); }
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForFunction(() => !pull.on && mode === "ceiling", null, {timeout: 5000});
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("les réglages du panneau passent sans erreur", async () => {
  const page = await sim.ouvrir();
  await page.evaluate(async () => {
    const att = ms => new Promise(r => setTimeout(r, ms)), envoie = (n, payload) => LISTEN[n].forEach(f => f({payload}));
    for (const m of ["guilleret", "ronchon", "vaseux", "auto"]) { envoie("mood", m); await att(200); }
    envoie("evo", "evo:cheveux"); await att(1800);
    envoie("haptique", false); envoie("bidule-visible", false); await att(300); envoie("bidule-visible", true);
    envoie("style", "goutte"); await att(500); envoie("style", "limace"); await att(800);
  });
  assert.deepEqual(page.erreurs, []);
  assert.deepEqual(await page.evaluate(() => LOG.map(l => l[1]).filter(m => /erreur|init:|: [A-Z]\w*Error/.test(m))), []);
  await page.close();
});
