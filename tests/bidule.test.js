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

// Apparence : on applique une apparence, puis on lit les couleurs de la limace affichée
const ROSE = ["#ffd6e8", "#ff9cc6", "#e0679f"], BLEU = ["#a4c6ff", "#639bff", "#4577e0"];
async function couleursAffichees(page, tag, i = 0) {
  return page.evaluate(async ([tag, i]) => {
    Horloge.arreter(); img.src = SHEET_DATA.limace.tags[tag][i].src;
    const im = new Image(); im.src = IMG_SRC.get.call(img); await im.decode();
    const cv = document.createElement("canvas"); cv.width = cv.height = 64; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, 64, 64).data, vu = new Set();
    for (let k = 0; k < d.length; k += 4) if (d[k + 3]) vu.add("#" + [d[k], d[k + 1], d[k + 2]].map(v => v.toString(16).padStart(2, "0")).join(""));
    return [...vu];
  }, [tag, i]);
}

test("une apparence recolore le corps avec ses trois tons, change les pupilles et garde le contour noir", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  await page.evaluate(() => Apparence.appliquer({corps: "rose", pupilles: "brun"}));
  const vu = await couleursAffichees(page, "repos");
  for (const c of ROSE) assert.ok(vu.includes(c), `ton ${c} absent`);
  for (const c of BLEU) assert.ok(!vu.includes(c), `bleu d'origine ${c} encore là`);
  assert.ok(vu.includes("#000000"), "le contour n'est plus noir");
  assert.ok(vu.includes("#5a3a22"), "pupilles pas recolorées");
  assert.ok(!vu.includes("#000001"), "pupilles d'origine encore là");
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("le vert de la nausée passe devant la teinte du corps", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  await page.evaluate(() => Apparence.appliquer({corps: "rose"}));
  const vu = await couleursAffichees(page, "nausee");
  assert.ok(vu.includes("#7fd46a"), "plus de vert pendant la nausée");
  for (const c of ROSE) assert.ok(!vu.includes(c), `teinte ${c} pendant la nausée`);
  await page.close();
});

test("les cheveux prennent leur teinte, et l'icône de la barre de menu montre l'apparence", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  await page.evaluate(async () => { cheveux = true; await hairLoad(); await Apparence.appliquer({corps: "rose", cheveux: "roux"}); });
  const vu = await couleursAffichees(page, "repos");
  assert.ok(vu.includes("#d2622e"), "cheveux pas roux");
  const icone = await page.evaluate(async () => {
    Horloge.demarrer(); CALLS.length = 0; await new Promise(r => setTimeout(r, 800));
    const a = CALLS.filter(c => c[1] === "icone").pop()[2], im = new Image(); im.src = URL.createObjectURL(new Blob([a], {type: "image/png"})); await im.decode();
    const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, im.width, im.height).data, vu = new Set();
    for (let k = 0; k < d.length; k += 4) if (d[k + 3]) vu.add([d[k], d[k + 1], d[k + 2]].join(","));
    return [...vu];
  });
  assert.ok(icone.includes("255,156,198"), "l'icône n'est pas rose");
  assert.ok(!icone.includes("99,155,255"), "l'icône est encore bleue");
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("revenir à l'apparence d'origine rend la feuille pixel pour pixel", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const r = await page.evaluate(async () => {
    await Apparence.appliquer({corps: "citron", pupilles: "vert", bouche: "rouge"});
    await Apparence.appliquer({});
    const im = new Image(); im.src = "persos/limace/sheet.png"; await im.decode();
    const meta = await (await fetch("persos/limace/sheet.json")).json(), cases = Object.values(meta.frames).map(f => f.frame);
    const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
    let diff = 0, faux = 0;
    for (const [k, f] of SHEET_DATA.limace.frames.entries()) {
      const a = g.getImageData(cases[k].x, cases[k].y, 64, 64).data, b = f.cv.getContext("2d").getImageData(0, 0, 64, 64).data;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { diff++; break; }
      if (Apparence.affichee(f.src) !== f.src) faux++;
    }
    return {diff, faux};
  });
  assert.deepEqual(r, {diff: 0, faux: 0});
  await page.close();
});

// Motifs : on lit les pixels d'une image affichée avec leur position
async function pixelsAffiches(page, tag, i = 0) {
  return page.evaluate(async ([tag, i]) => {
    Horloge.arreter(); img.src = SHEET_DATA.limace.tags[tag][i].src;
    const im = new Image(); im.src = IMG_SRC.get.call(img); await im.decode();
    const cv = document.createElement("canvas"); cv.width = cv.height = 64; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, 64, 64).data, px = [];
    for (let k = 0; k < d.length; k += 4) px.push(d[k + 3] ? "#" + [d[k], d[k + 1], d[k + 2]].map(v => v.toString(16).padStart(2, "0")).join("") : "");
    return px;
  }, [tag, i]);
}
const NOIR_DOUX = ["#7a7a90", "#4e4e62", "#34343f"];

test("un motif n'est posé que sur le corps et garde ses ombres", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const avant = await pixelsAffiches(page, "repos");
  for (const motif of ["rayures", "pois", "coeurs", "vache"]) {
    await page.evaluate(m => Apparence.appliquer({corps: "rose", motif: m, motifTeinte: "noir doux"}), motif);
    const apres = await pixelsAffiches(page, "repos");
    let dessin = 0;
    const tons = new Set();
    for (let k = 0; k < 64 * 64; k++) {
      const o = BLEU.indexOf(avant[k]);
      if (o < 0) { assert.equal(apres[k], avant[k], `${motif} : pixel hors du corps changé en ${k}`); continue; }
      const n = NOIR_DOUX.indexOf(apres[k]);
      if (n >= 0) { dessin++; tons.add(n); assert.equal(n, o, `${motif} : le dessin ne reprend pas l'ombre en ${k}`); }
      else assert.equal(apres[k], ROSE[o], `${motif} : fond pas à la teinte du corps en ${k}`);
    }
    assert.ok(dessin > 20, `${motif} : presque pas de dessin (${dessin})`);
    assert.ok(tons.size >= 2, `${motif} : le dessin n'a qu'un ton`);
  }
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("chaque motif a une deuxième teinte par défaut", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  await page.evaluate(() => Apparence.appliquer({motif: "vache"}));
  const vu = await pixelsAffiches(page, "repos");
  assert.ok(NOIR_DOUX.some(c => vu.includes(c)), "la vache n'est pas noire par défaut");
  await page.close();
});

test("la nausée passe devant le motif, et sans motif rien ne change", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const nausee = await pixelsAffiches(page, "nausee"), repos = await pixelsAffiches(page, "repos");
  await page.evaluate(() => Apparence.appliquer({motif: "pois"}));
  assert.deepEqual(await pixelsAffiches(page, "nausee"), nausee);
  await page.evaluate(() => Apparence.appliquer({motif: null}));
  assert.deepEqual(await pixelsAffiches(page, "repos"), repos);
  await page.close();
});

// Enregistrement : le panneau envoie l'apparence (événement « apparence »), l'app la garde (simulée dans la page de test) et la rend au lancement
const envoyer = (page, app) => page.evaluate(a => Promise.all(LISTEN.apparence.map(f => f({payload: a}))), app);
test("l'apparence choisie dans le panneau revient après un rechargement, motif compris", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  await envoyer(page, {corps: "rose", cheveux: "roux", motif: "vache", motifTeinte: "noir doux"});
  await page.reload({waitUntil: "domcontentloaded"});
  await page.waitForFunction(() => chosen && SHEET_DATA.limace);
  assert.deepEqual(await page.evaluate(() => Apparence.courante), {corps: "rose", cheveux: "roux", motif: "vache", motifTeinte: "noir doux"});
  const vu = await couleursAffichees(page, "repos");
  for (const c of ROSE) assert.ok(vu.includes(c), `ton ${c} absent après rechargement`);
  assert.ok(NOIR_DOUX.some(c => vu.includes(c)), "le motif n'est pas revenu");
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("« Remettre d'origine » rend la limace bleue sans motif, aussi au lancement suivant", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  await envoyer(page, {corps: "rose", pupilles: "brun", motif: "pois"});
  await envoyer(page, {});
  let vu = await couleursAffichees(page, "repos");
  for (const c of BLEU) assert.ok(vu.includes(c), `bleu ${c} absent`);
  assert.ok(vu.includes("#000001") && !vu.includes("#5a3a22"), "pupilles pas revenues");
  await page.reload({waitUntil: "domcontentloaded"});
  await page.waitForFunction(() => chosen && SHEET_DATA.limace);
  assert.deepEqual(await page.evaluate(() => Apparence.courante), {});
  vu = await couleursAffichees(page, "repos");
  for (const c of ROSE) assert.ok(!vu.includes(c), `rose ${c} revenu après rechargement`);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});
