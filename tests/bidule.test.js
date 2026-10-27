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
    Horloge.arreter(); img.src = (SHEET_DATA.limace.tags[tag] || SHEET_DATA.limace.all[tag])[i].src;
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

test("le motif reste sur la nausée, et sans motif rien ne change", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const repos = await pixelsAffiches(page, "repos");
  await page.evaluate(() => Apparence.appliquer({motif: "rayures", motifTeinte: "noir doux"}));
  const nausee = await couleursAffichees(page, "nausee");
  assert.ok(nausee.includes("#7fd46a"), "la nausée n'est plus verte");
  assert.ok(NOIR_DOUX.some(c => nausee.includes(c)), "le motif n'est pas sur la nausée");
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

test("les cheveux teints gardent le contour du corps noir", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  await page.evaluate(async () => { cheveux = true; await hairLoad(); cheveux = false; });
  const nu = await pixelsAffiches(page, "repos");
  await page.evaluate(async () => { cheveux = true; await Apparence.appliquer({cheveux: "roux"}); });
  const coiffe = await pixelsAffiches(page, "repos");
  let meches = 0;
  for (let k = 0; k < 64 * 64; k++) {
    if (nu[k] === "#000000") assert.equal(coiffe[k], "#000000", `contour recoloré en ${k}`);
    if (!nu[k] && coiffe[k]) { meches++; assert.equal(coiffe[k], "#d2622e", `mèche pas rousse en ${k}`); }
  }
  assert.ok(meches > 10, "pas de cheveux");
  await page.close();
});

test("la teinte de la bouche ne touche que l'intérieur de la bouche, pas les éclaboussures vertes", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const chute = await pixelsAffiches(page, "chute-vert", 1);
  assert.ok(chute.includes("#3f3f74"), "l'éclaboussure n'a plus sa couleur sombre");
  await page.evaluate(() => Apparence.appliquer({bouche: "rouge"}));
  assert.deepEqual(await pixelsAffiches(page, "chute-vert", 1), chute);
  assert.ok((await pixelsAffiches(page, "baille", 5)).includes("#9c2b3a"), "la bouche ouverte n'est pas rouge");
  await page.close();
});

test("la goutte tenue a le motif, et verdit sous le motif quand on la secoue", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  await page.evaluate(() => Apparence.appliquer({corps: "rose", motif: "rayures", motifTeinte: "noir doux"}));
  const lire = secoue => page.evaluate(async s => {
    Horloge.arreter(); drag = {shaken: s, lastX: 0, lastY: 0}; swingStart(); swingDraw();
    const im = new Image(); im.src = IMG_SRC.get.call(img); await im.decode();
    const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, im.width, im.height).data, vu = new Set();
    for (let k = 0; k < d.length; k += 4) if (d[k + 3]) vu.add("#" + [d[k], d[k + 1], d[k + 2]].map(v => v.toString(16).padStart(2, "0")).join(""));
    return [...vu];
  }, secoue);
  let vu = await lire(false);
  assert.ok(ROSE.some(c => vu.includes(c)), "la goutte n'est pas rose");
  assert.ok(NOIR_DOUX.some(c => vu.includes(c)), "la goutte n'a pas le motif");
  vu = await lire(true);
  assert.ok(vu.includes("#7fd46a"), "la goutte secouée ne verdit pas");
  assert.ok(NOIR_DOUX.some(c => vu.includes(c)), "le motif disparaît quand elle verdit");
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

// Les stats de la saison (jeu.js) : les prompts et les tokens viennent des journaux simulés (window.PROMPTS, window.DEPENSES)
test("les stats de la saison montent : repas, secousses, travail, pauses, soirées tardives, tokens", async () => {
  const page = await sim.ouvrir();
  const s = await page.evaluate(async () => {
    Horloge.arreter();
    const d0 = saisonCourante(), a = d0.getTime() / 1000;
    const h = (j, hh, mm = 0) => { const d = new Date(d0); d.setDate(d.getDate() + j); d.setHours(hh, mm); return d.getTime() / 1000; };
    compter("repas"); compter("repas"); compter("secousses");
    // 21 h, 21 h 10, puis trois pauses de 50 à 90 min jusqu'à 1 h du matin (une seule soirée), puis 10 h le lendemain
    window.PROMPTS = [h(1, 21), h(1, 21, 10), h(1, 22), h(1, 23, 30), h(2, 1), h(2, 10)];
    window.DEPENSES = [{heure: a - 3600, tokens: [1000, 1000, 5, 5, 5]}, {heure: a + 3600, tokens: [100, 20, 999, 999, 999]}, {heure: a + 7200, tokens: [5, 5, 0, 0, 0]}];
    await releverPrompts(); await releverPrompts(); await releverTokens();
    return stats;
  });
  assert.deepEqual([s.repas, s.secousses, s.travail, s.habitudes, s.tard, s.tokens], [2, 1, 300 + 600 + 300 * 4, 3, 1, 130]);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("les stats survivent à une relance et repartent à zéro à la saison suivante", async () => {
  const page = await sim.ouvrir();
  await page.evaluate(() => { compter("repas"); compter("tokens", 500); });
  await page.waitForFunction(() => CALLS.some(c => c[1] === "garder_etat" && JSON.parse(c[2].etat).stats.repas === 1));
  await page.reload({waitUntil: "domcontentloaded"});
  await page.waitForFunction(() => chosen);
  assert.deepEqual(await page.evaluate(() => [stats.repas, stats.tokens]), [1, 500]);
  const s = await page.evaluate(() => { stats.saison = "2020-01-01"; saisonCourante(); return stats; });
  assert.deepEqual([s.repas, s.tokens, s.saison], [0, 0, await page.evaluate(() => cleJour(saisonDebut()))]);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

// Les besoins (jeu.js) : on avance le temps en donnant les secondes de vie à avancerBesoins ; stats.vu, l'heure du dernier prompt, dit si tu travailles
test("la faim descend avec le temps de l'app et les tokens, pas app fermée, et un repas la remplit", async () => {
  const page = await sim.ouvrir();
  const r = await page.evaluate(async () => {
    Horloge.arreter(); const B = REGLAGES.besoins, o = {};
    besoins = {...BESOINS_PLEINS};
    avancerBesoins(3600); o.uneHeure = 100 - besoins.faim;
    besoinsVu = Date.now() - 8 * 3600e3; pasBesoins(); o.apresFermeture = 100 - o.uneHeure - besoins.faim;
    window.DEPENSES = [{heure: Date.now() / 1000, tokens: [1e6, 1e6, 0, 0, 0]}];
    tokensLus = false; stats.tokens = 0; await releverTokens(); o.premierReleve = besoins.faim;
    window.DEPENSES[0].tokens = [2e6, 1e6, 0, 0, 0]; await releverTokens(); o.millionDePlus = o.premierReleve - besoins.faim;
    nourrir(); o.repas = besoins.faim;
    return {o, B};
  });
  assert.equal(r.o.uneHeure, r.B.faim);
  assert.ok(r.o.apresFermeture <= 2 * r.B.pas / 1000 * r.B.faim / 3600 + 1e-9, "le temps app fermée compte");
  assert.ok(Math.abs(r.o.premierReleve - (100 - r.o.uneHeure - r.o.apresFermeture)) < 1e-9);
  assert.ok(Math.abs(r.o.millionDePlus - r.B.parMillionTokens) < 1e-9);
  assert.ok(Math.abs(r.o.repas - Math.min(100, r.o.premierReleve - r.o.millionDePlus + r.B.repas)) < 1e-9);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("la soif descend quand tu travailles et remonte pendant tes pauses", async () => {
  const page = await sim.ouvrir();
  const r = await page.evaluate(() => {
    Horloge.arreter(); const B = REGLAGES.besoins, o = {};
    besoins = {...BESOINS_PLEINS}; stats.vu = Date.now() / 1000;
    avancerBesoins(3600 * (100 - B.bas / 2) / B.soif); o.travail = [Math.round(besoins.soif), etapeBesoins(), [...fx.querySelectorAll(".bub")].pop()?.textContent];
    stats.vu = Date.now() / 1000 - B.pause; avancerBesoins(1800); o.pause = Math.round(besoins.soif);
    return o;
  });
  assert.deepEqual(r, {travail: [20, "soif", "J'ai soif !"], pause: 50});
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("négligé, il a faim, tombe malade, guérit si on le soigne, sinon sa vie se vide, il devient un squelette et un œuf arrive", async () => {
  const page = await sim.ouvrir();
  const r = await page.evaluate(async () => {
    Horloge.arreter(); const B = REGLAGES.besoins, o = {}, h = n => n * 3600 / B.faim;
    besoins = {...BESOINS_PLEINS}; collection = []; stats.malade = 0; stats.vu = 0;
    avancerBesoins(h(100 - B.bas + 1)); o.faim = [etapeBesoins(), (await guessMood())[0]];
    avancerBesoins(h(B.bas)); avancerBesoins(600);
    o.malade = [etapeBesoins(), (await guessMood())[0], Apparence.tonDuCorps(1).join(), stats.malade, besoins.vie < 100];
    nourrir(); nourrir(); o.gueri = [etapeBesoins(), Apparence.tonDuCorps(1).join()];
    avancerBesoins(h(100)); avancerBesoins(B.squelette);
    o.squelette = [collection.length, collection[0].style, etapeBesoins(), besoins.faim, besoins.vie, Apparence.tonDuCorps(1).join()];
    return o;
  });
  assert.deepEqual(r.faim, ["faim", "ronchon"]);
  assert.deepEqual(r.malade, ["malade", "vaseux", "168,200,120", 600, true]);
  assert.deepEqual(r.gueri, ["", "99,155,255"]);
  assert.deepEqual(r.squelette, [1, "limace", "", 100, 0, "216,208,184"]);
  await page.waitForFunction(() => Apparence.tonDuCorps(1).join() === "99,155,255" && besoins.vie === 100, null, {timeout: 9000});
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("les besoins et la collection survivent à une relance, et le temps malade arrive au panneau", async () => {
  const page = await sim.ouvrir();
  await page.evaluate(() => { Horloge.arreter(); T.event.emit = (n, p) => { if (n === "etat") window.ETAT = p.jeu; }; stats.vu = 0; besoins = {...BESOINS_PLEINS, faim: 0}; collection = [{style: "limace", apparence: {}, quand: 1}]; avancerBesoins(1); stats.malade = 0; avancerBesoins(60); });
  await page.waitForFunction(() => CALLS.some(c => c[1] === "garder_etat" && JSON.parse(c[2].etat).besoins.malade === true));
  const etat = await page.evaluate(() => ETAT);
  assert.deepEqual([etat.etape, etat.stats.malade, etat.collection], ["malade", 60, 1]);
  await page.reload({waitUntil: "domcontentloaded"});
  await page.waitForFunction(() => chosen);
  assert.deepEqual(await page.evaluate(() => [besoins.malade, besoins.vie < 100, collection.length, Apparence.tonDuCorps(1).join()]), [true, true, 1, "168,200,120"]);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("les essais de l'onglet Tests sautent aux étapes sans compter dans les stats", async () => {
  const page = await sim.ouvrir();
  const r = await page.evaluate(() => {
    Horloge.arreter(); const o = {}, essai = q => LISTEN.besoins.forEach(f => f({payload: q}));
    besoins = {...BESOINS_PLEINS}; collection = [{style: "limace", apparence: {}, quand: 1}]; stats.malade = 0; stats.repas = 0;
    essai("faim"); o.faim = etapeBesoins();
    essai("soif"); o.soif = etapeBesoins();
    essai("malade"); avancerBesoins(600); o.malade = [etapeBesoins(), stats.malade];
    essai("nourrir"); essai("nourrir"); o.gueri = [etapeBesoins(), stats.repas, besoins.essai];
    essai("squelette"); o.squelette = collection.length;
    essai("malade"); essai("zero"); o.zero = [etapeBesoins(), besoins.faim, besoins.vie, collection.length];
    return o;
  });
  assert.deepEqual(r, {faim: "faim", soif: "soif", malade: ["malade", 0], gueri: ["", 0, undefined], squelette: 2, zero: ["", 100, 100, 1]});
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("les lunettes se posent sur le corps, dans toutes les humeurs, et s'enlèvent", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const envoie = async id => { await page.evaluate(id => LISTEN.evo.forEach(f => f({payload: id})), id); await page.waitForTimeout(1600); };
  const nu = await pixelsAffiches(page, "crawl"), nuJoyeux = await pixelsAffiches(page, "crawl@guilleret");
  await envoie("evo:lunettes");
  assert.equal(await page.evaluate(() => visage), "lunettes");
  for (const [tag, avant] of [["crawl", nu], ["crawl@guilleret", nuJoyeux]]) {
    const vu = await pixelsAffiches(page, tag);
    let verres = 0;
    for (let k = 0; k < 64 * 64; k++) {
      if (!avant[k]) assert.equal(vu[k], "", `${tag} : lunettes hors du corps en ${k}`);
      if (vu[k] === "#ffffff" && avant[k] !== "#ffffff") verres++;
    }
    assert.ok(verres > 30, `${tag} : pas de verres (${verres})`);
  }
  await envoie("evo:lunettes");
  assert.equal(await page.evaluate(() => visage), null);
  assert.deepEqual(await pixelsAffiches(page, "crawl"), nu);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("l'auréole va sur la tête à la place de l'hélice, au-dessus du corps, et prend sa teinte", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const envoie = async id => { await page.evaluate(id => LISTEN.evo.forEach(f => f({payload: id})), id); await page.waitForTimeout(1600); };
  const nu = await pixelsAffiches(page, "crawl");
  await envoie("evo:helice"); await envoie("evo:aureole");
  assert.deepEqual(await page.evaluate(() => [chapeau, helice, cheveux]), ["aureole", false, false]);
  const vu = await pixelsAffiches(page, "crawl");
  assert.ok(vu.filter((c, k) => !nu[k] && c === "#fbf236").length > 15, "pas d'auréole au-dessus de la tête");
  vu.forEach((c, k) => { if (nu[k]) assert.equal(c, nu[k], `l'auréole recouvre le corps en ${k}`); });
  await page.evaluate(() => Apparence.appliquer({aureole: "argent"}));
  const argent = await pixelsAffiches(page, "crawl");
  assert.ok(argent.includes("#d8dce8") && !argent.includes("#fbf236"), "l'auréole n'a pas pris sa teinte");
  await envoie("evo:cheveux");
  assert.deepEqual(await page.evaluate(() => [chapeau, cheveux]), [null, true]);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("écrasée en flaque, la limace garde la teinte du corps, sans tache du motif à un bout", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const r = await page.evaluate(async () => {
    await Apparence.appliquer({corps: "citron", motif: "vache"});
    const cles = Apparence.clesDuMotif;
    const motif = f => { const d = f.cv.getContext("2d").getImageData(0, 0, 64, 64).data; let m = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k + 3] && cles.has(d[k] << 16 | d[k + 1] << 8 | d[k + 2])) m++; return m; };
    const T = SHEET_DATA.limace.all;
    return {flaque: T.ecrase.slice(1).map(motif), debout: motif(T.crawl[0]), mur: T["choc-bord"].map(motif)};
  });
  assert.ok(r.flaque.every(m => m === 0), `motif sur la flaque : ${r.flaque}`);
  assert.ok(r.debout > 0, "plus de motif sur le corps debout");
  assert.ok(r.mur.every(m => m > 0), `plus de motif contre le mur : ${r.mur}`);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});

test("l'hélice va sur la tête à la place des cheveux, et se floute quand elle tourne vite", async () => {
  const page = await sim.ouvrir();
  await page.waitForFunction(() => SHEET_DATA.limace);
  const envoie = async id => { await page.evaluate(id => LISTEN.evo.forEach(f => f({payload: id})), id); await page.waitForTimeout(1600); };
  const nu = await pixelsAffiches(page, "crawl");
  await envoie("evo:cheveux"); await envoie("evo:helice");
  assert.deepEqual(await page.evaluate(() => [helice, cheveux]), [true, false]);
  await page.evaluate(() => { hair.vite = 0; hair.pale = 0; });
  const lente = await pixelsAffiches(page, "crawl");
  const posee = lente.filter((c, k) => !nu[k] && c);
  assert.ok(posee.includes("#fbf236") && posee.includes("#ac3232"), "pas d'hélice au-dessus de la tête");
  lente.forEach((c, k) => { if (nu[k]) assert.equal(c, nu[k], `l'hélice recouvre le corps en ${k}`); });
  await page.evaluate(() => { hair.vite = 14; hair.cache.clear(); });
  const vite = await pixelsAffiches(page, "crawl");
  assert.ok(vite.includes("#fdf99b"), "pas de flou quand elle tourne vite");
  // sa teinte : les pales, la tige et le flou changent de couleur
  await page.evaluate(() => Apparence.appliquer({helice: "bleu", lunettes: "soleil"}));
  const bleue = await pixelsAffiches(page, "crawl");
  assert.ok(bleue.includes("#7fc8ff") && bleue.includes("#2f5fd0") && !bleue.includes("#fbf236"), "l'hélice n'a pas pris sa teinte");
  await envoie("evo:lunettes");
  const soleil = await pixelsAffiches(page, "crawl");
  assert.ok(soleil.includes("#2a2a34") && !soleil.includes("#ffffff"), "les lunettes n'ont pas pris leur teinte");
  await envoie("evo:lunettes");
  await envoie("evo:cheveux");
  assert.deepEqual(await page.evaluate(() => [helice, cheveux]), [false, true]);
  assert.deepEqual(page.erreurs, []);
  await page.close();
});
