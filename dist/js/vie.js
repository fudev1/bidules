// Une image de vie du Bidule selon son mode : marche, vol, sommeil, plafond, murs...
function tickBody() {
  ticks++;
  const t2 = performance.now(), dtMs = Math.min(200, t2 - lastT), k = Math.min(4, (t2 - lastT) / 33); lastT = t2;
  if (isSheet()) sheetAnim(Date.now());
  if (sweets.length && style !== "candy") sweets.slice().forEach(sweetRemove);
  if (drag) {
    swayStep(dtMs / 1000);
    // une image pas encore décodée n'est pas remplacée : sinon, si le décodage est lent, aucune n'arrive à s'afficher
    if (swing.on && (mode === "held" || mode === "carried")) { swingStep(dtMs / 1000); if (img.complete) swingDraw(); }
    if (pull.on && pull.ready) pullStep(dtMs / 1000);
    if (mode === "carried") {
      wake = Math.max(0, wake - 45 * dtMs / 1000);
    }
    return;
  }
  // juste lâché : le temps de lire l'écran, il reste où il est (sinon la marche le recolle au sol)
  if (mode === "held" || mode === "carried") return;
  if (mode === "walk") calm += dtMs;
  if (mode === "walk" && style === "candy" && mood === "guilleret" && sweets.length < 3 && !feeding) sweetTimer -= dtMs;
  if (mode === "pet") calm += dtMs * PET_BOOST;
  if ((mode === "walk" || mode === "pet") && calm > (sleepyNow() ? NO_CONV_SLEEP : MV().sleepAfter || SLEEP_AFTER)) {
    drowsyEnd = false; setMode("drowsy"); reactUntil = Date.now() + (tagDur("baille") ? tagDur("baille") + 300 : 2600); img.src = FR.baille; pose(""); watching = false; lookKey = ""; playOnce("baille");
    bubble("*bâille*", 1300); say("il a sommeil");
  }
  if (mode === "fly") {
    peakY = peakY === null ? y : Math.min(peakY, y);
    vy += 1.3 * k; vx *= Math.pow(0.985, k); x += vx * k; y += vy * k;
    if (BOUNCY.has(style)) {
      // inclinaison continue : penchée dans le sens du déplacement, un coup de toupie amorti à chaque rebond, ramenée à plat en approchant du sol
      const near = vy > 0 ? Math.max(0, 1 - (floorY - y) / 90) : 0;
      angle += spin * k + (Math.max(-20, Math.min(20, vx * .8)) * (1 - near) - angle) * Math.min(1, (.1 + .3 * near) * k);
      spin *= Math.pow(.88, k); angle = Math.max(-60, Math.min(60, angle));
    } else angle += vx * 1.2 * k;
    // lancé, il cogne : un coup du trackpad à chaque choc (on le sent si le doigt y est encore, et on l'entend)
    if (x < minX) { haptic(Math.abs(vx) > 12 ? "palier" : "clic"); if (hitWall(-1)) { push(); return; } x = minX; vx = -vx * (BOUNCY.has(style) ? .7 : .25); squash("wall"); }
    if (x > maxX) { haptic(Math.abs(vx) > 12 ? "palier" : "clic"); if (hitWall(1)) { push(); return; } x = maxX; vx = -vx * (BOUNCY.has(style) ? .7 : .25); squash("wall"); }
    if (y < minY - headroom()) {          // plafond : le haut du dessin touche le haut de l'écran, pas celui de la fenêtre
      haptic(vy < -10 ? "palier" : "clic");
      if (isSheet() && style !== "candy" && !nausea && vy < -10) { cling(); push(); return; }          // assez d'élan : il s'y colle, à l'envers
      y = minY - headroom(); vy = -vy * 0.4;
    }
    if (y >= floorY) {
      y = floorY; const impact = Math.abs(vy); maxImpact = Math.max(maxImpact, impact);
      if (impact > 4) haptic(impact > 14 ? "palier" : "clic");
      if (impact > (isSheet() ? 10 : 7) && bounces < (isSheet() ? 3 : 4) && (!isSheet() || BOUNCY.has(style))) {
        if (isSheet() && bigFall()) crashed = true;
        if (isSheet()) {
          // elle rebondit dans tous les sens, mais peu : à chaque rebond, un élan de côté et un coup de toupie au hasard, tous deux doux
          vy = -impact * (.45 + Math.random() * .15); vx = vx * .8 + (Math.random() - .5) * Math.min(impact, 16) * .6;
          spin = (Math.random() - .5) * 10 * Math.min(1, impact / 20); peakY = y; playOnce("rebond");
        } else { vy = -impact * 0.45; vx *= 0.7; angle *= 0.4; squash(); }
        bounces++;
      }
      else land();
    }
    img.style.rotate = (mode === "fly" && (!isSheet() || BOUNCY.has(style)) ? angle : 0).toFixed(1) + "deg";
    push(); return;
  }
  const now = Date.now();
  if (mode === "ceiling" && drag) { push(); return; }          // tenu au plafond, avant qu'on le tire : il ne bouge plus
  if (mode === "ceiling") {          // collé au haut de l'écran, à l'envers : il rampe (le pas est fait par sheetAnim), descend par le bord qu'il atteint, ou se décolle
    // le bord atteint, il s'arrête et finit son cycle : le demi-tour part de la première image de la reptation, comme au sol
    if (x < minX || x > maxX) { ceilingEdge = x < minX ? -1 : 1; x = Math.max(minX, Math.min(maxX, x)); }
    const cr = SHEET_DATA[style].tags[sheetLoop.tag];
    if (ceilingEdge && (!cr || sheetLoop.i % cr.length === 0)) { ceilingToWall(ceilingEdge); push(); return; }
    if (ceilSwingAt && now > ceilSwingAt && !faceSeq && HALF && SHEET_DATA[style].tags["pendule-plafond"] && (!cr || sheetLoop.i % cr.length === 0)) { ceilSwingStart(now); push(); return; }
    y = ceilingY(); push();
    if (faceSeq) faceStep(now);
    if (now > ceilingUntil) unceil(true);
    return;
  }
  if (mode === "ceilswing") { ceilSwingStep(now); push(); if (now > ceilingUntil + 20000) { ceilSw = null; unceil(true); } return; }          // il se balance au plafond
  if (mode === "corner") { cornerStep(now); push(); return; }          // il passe le coin du plafond au mur
  if (mode === "wall" && drag) { push(); return; }          // tenu sur le mur, avant qu'on le tire : il ne glisse plus
  if (mode === "wall") {      // collé au bord de l'écran : il coule, de plus en plus vite, jusqu'au sol
    const impact = sheetOnce && /^choc-bord/.test(sheetOnce.tag);          // pendant l'écrasement il reste en place, ensuite il coule
    if (!impact && !wallStick) { wallV = Math.min(1, wallV + .01 * k); y += wallV * k; }
    else if (!impact) {          // venant du plafond, comme une goutte : collé, il glisse d'un coup, freine, se recolle, et recommence
      if (wallRun > 0) { wallV = Math.min(5, wallV + .35 * k); wallRun -= wallV * k; if (wallRun <= 0) wallStick = now + 250 + Math.random() * 700; }
      else if (now >= wallStick) wallRun = 40 + Math.random() * 90;
      else wallV *= Math.pow(.8, k);
      y += wallV * k;
      // un ressort : elle s'étire avec la vitesse pendant la glissade ; à l'arrêt net, elle dépasse et se ramasse, puis reprend sa forme
      wallDefV += ((wallRun > 0 ? wallV * .16 : 0) - wallDef) * .25 * k; wallDefV *= Math.pow(.7, k); wallDef += wallDefV * k; wallShape(true);
    }
    if (y >= floorY) {
      y = floorY;
      const T2 = SHEET_DATA[style].tags, fin = nausea && T2["coule-fin-vert"] ? "coule-fin-vert" : "coule-fin";      // secoué, il se reforme en vert
      if (!T2[fin]) { x = Math.max(minX, Math.min(maxX, x)); push(); land(); return; }
      if (wallStick) wallShape(false);
      setMode("wallland"); wallEnd = now + tagDur(fin); playOnce(fin); say("coule jusqu'au sol : il se reforme");
    }
    push(); return;
  }
  if (mode === "wallland") {      // il se détache du mur et se reforme ; sur les dernières images la fenêtre rentre dans l'écran (le dessin glisse vers le centre)
    const p = Math.max(0, Math.min(1, 1 - (wallEnd - now - WALL_SLIDE) / WALL_SLIDE));
    x = wallSide < 0 ? minX - WALL_OVER * (1 - p) : maxX + WALL_OVER * (1 - p); y = floorY; push();
    if (now >= wallEnd && !sheetOnce) {          // la dernière image est la pose de repos ; secoué, il garde la nausée
      x = Math.max(minX, Math.min(maxX, x)); push(); vx = vy = 0; peakY = null;
      if (nausea) { nausea = false; setMode("nausea"); reactUntil = now + 3500; bubble("Beurk...", 1400); say("secoue : il a la nausee"); } else toWalk();
    }
    return;
  }
  if (mode === "splat") { if (now > reactUntil) { setMode("reform"); playOnce("reforme"); say("il se reforme"); } return; }
  if (mode === "reform" || mode === "still") { if (!sheetOnce) { if (mode === "reform") toWalk(); else { setMode("walk"); pose("walk"); } } return; }
  if (mode === "dizzy") {
    if (now > dizzyUntil) toWalk();
    else if (!isSheet() && Math.random() < 0.18 * k) img.src = img.src === FR.d1 ? FR.d2 : FR.d1;
    return;
  }
  if (mode === "springback") { if (!pull.on) { setMode("walk"); pose("walk"); } else if (pull.ready) pullStep(dtMs / 1000); return; }
  if (mode === "evolving") return;
  if (mode === "turning") {
    if (now >= turnNext) {
      if (turnIdx >= turnSeq.length) {
        setMode("walk"); dir = pendingDir; face(); pose("walk");
        const cr = walkFrames();
        crawlIdx = 1 % cr.length; img.src = cr[crawlIdx].src; crawlNext = now + cr[crawlIdx].dur;
      }
      else { img.src = turnSeq[turnIdx].src; turnNext = nextAt(turnNext, turnSeq[turnIdx].dur, now); turnIdx++; }
    }
    return;
  }
  if (mode === "drowsy") {
    // le bâillement fini (de face), il s'endort doucement : endort (paupières qui tombent, puis il se couche), puis le sommeil
    if (now > reactUntil && !sheetOnce) { if (isSheet() && SHEET_DATA[style].tags.endort && !drowsyEnd) { drowsyEnd = true; playOnce("endort"); } else { drowsyEnd = false; fallAsleep(); } }
    return;
  }
  if (mode === "sleep") {
    wake = Math.max(0, wake - 30 * dtMs / 1000);
    if (now > nextZ) { zz(); nextZ = now + 1100; }
    if (now - sleepSince > AUTO_WAKE && !sleepyNow()) wakeUp("seul");
    return;
  }
  if (mode === "waking") { if (now > reactUntil) toWalk(); return; }
  if (mode === "invite") {          // invité à jouer : figé de face, il sautille et le redit toutes les 3 s, jusqu'à la réponse dans le panneau
    if (!invite) toWalk(); else if (now > nextFx) { bubble(`${invite} t'invite au Pong !`, 2600); nextFx = now + 3000; }
    return;
  }
  if (mode === "nausea") {
    if (now > reactUntil) {          // remis : un perso dessiné se secoue la tête (remis, de profil, jouée une fois) ; les autres tremblent
      setMode("recover"); bubble("Ça va mieux", 1000);
      if (isSheet() && SHEET_DATA[style].tags.remis) { pose(""); playOnce("remis"); reactUntil = now + tagDur("remis"); } else { reactUntil = now + 500; img.src = FR.normal; pose("shake"); }
      return;
    }
    if (now > nextFx) { if (!isSheet()) img.src = img.src === FR.n1 ? FR.n2 : FR.n1; nextFx = now + 220; if (Math.random() < 0.35) { dir = -dir; face(); } }
    if (!isSheet()) x += dir * 0.8 * k;
    y = floorY; x = Math.max(minX, Math.min(maxX, x)); push(); return;
  }
  if (mode === "recover") {          // remis finit de profil, sur la pose de la reptation : il reprend sa marche sans repasser par la face
    if (now > reactUntil && !sheetOnce) { if (isSheet() && SHEET_DATA[style].tags.remis) { setMode("walk"); pose("walk"); crawlIdx = walkFrames().length - 1; crawlNext = now; } else toWalk(); }
    return;
  }
  if (REACT.has(mode)) {
    if (mode === "ooh") return;
    // la caresse finie, il rouvre les yeux (caresse-fin) avant de reprendre sa marche
    if (mode === "pet") { if (now > reactUntil) { if (isSheet() && SHEET_DATA[style].tags["caresse-fin"]) playInPlace("caresse-fin"); else toWalk(); } else if (now > nextFx) { heart(); nextFx = now + 320; } return; }
    if (mode === "laugh") { if (now > reactUntil) toWalk(); else if (!isSheet() && Math.random() < 0.25 * k) img.src = img.src === FR.rire ? FR.content : FR.rire; return; }
    if (mode === "angry") {
      if (now > reactUntil) { dir = cursor && cursor.x < x + 88 ? 1 : -1; face(); react("sulk", 2000, FR.fache, "walk"); say("il boude et s'en va"); }
      return;
    }
    if (mode === "sulk") {
      if (now > reactUntil) { toWalk(); return; }
      x += dir * 4.5 * k; y = floorY;
      if (x < minX || x > maxX) { x = Math.max(minX, Math.min(maxX, x)); dir = -dir; face(); }
      push(); return;
    }
    if (mode === "eat") {
      if (now > reactUntil && !sheetOnce) {
        toWalk();
        if (!isSheet()) bubble("Burp !", 900);
        else if (Math.random() < .5) { playInPlace("rot"); bubble("Burp !", 900); }
        else burpAt = now + 2000 + Math.random() * 3000;
      }
      else if (!isSheet() && now > nextFx) { img.src = img.src === FR.rire ? FR.content : FR.rire; nextFx = now + 170; }
      return;
    }
  }
  if (invite && mode === "walk" && !sheetOnce && !faceSeq && !feeding && !airborne()) { react("invite", 0, FR.normal, "invite"); nextFx = 0; return; }
  if (burpAt && now > burpAt && isSheet() && !sheetOnce) { burpAt = 0; playInPlace("rot"); bubble("Burp !", 900); return; }
  if (!feeding && wanted.length && mode === "walk" && !sheetOnce) { feeding = {s:wanted.shift(), stage:"go", until:Date.now() + 90000}; idleUntil = 0; }
  if (feeding && feeding.stage === "face" && Date.now() > feeding.until) { feeding = null; idleUntil = 0; }
  if (feeding && feeding.stage === "face") {
    // pendant son demi-tour, elle se cale au pixel près devant le bonbon, puis elle le mange une fois de face
    x += (feeding.aim - x) * Math.min(1, .15 * k); y = floorY; push();
    if (FRONT.has(img.src) && !faceSeq && !sheetOnce) { startEat(); return; }
  }
  if (feeding && feeding.stage === "go" && !sheetOnce && !airborne()) feedArrive();
  if (isSheet() && HALF && !sheetOnce && faceStep(now)) return;
  if (now < idleUntil && !airborne()) { if (img.className === "walk") pose(""); return; }
  if (img.className === "") pose("walk");
  if (Math.random() < 0.0025 * k) moodExtra();
  if (!airborne() && !feeding && Math.random() < MV().idle * k * (hopping() ? 3 : 1)) {
    idleUntil = now + 1500 + Math.random() * 2500;
    // Candy chante pendant une partie de ses pauses, sauf quand elle est ronchon
    sing = style === "candy" && mood !== "ronchon" && Math.random() < .37;
    if (sing && Math.random() < .4) bubble("La la la !", 1200);
    return;
  }
  if (!sheetOnce && !feeding && Math.random() < MV().flip * k) { turnTo(-dir); if (mode === "turning") return; }
  if (!isSheet()) x += dir * MV().speed * k;
  y = floorY;
  if (isSheet() && mode === "walk" && !sheetOnce && !airborne() && !feeding && Math.random() < .004 * k) playOnce("saut");
  if (isSheet() && mode === "walk" && !sheetOnce && now >= crawlNext) {
    // l'humeur change la cadence des images, pas la longueur du pas
    let cr = walkFrames();
    if ((crawlIdx + 1) % cr.length === 0) { walkTag = SHEET_DATA[style].tags.sautille && mood !== "ronchon" && mood !== "vaseux" ? "sautille" : "crawl"; cr = walkFrames(); }
    // demi-tour demandé : il prend la place de la première image de la reptation (turn[0] = crawl[0]), donc aucun saut
    if (turnWanted !== null && (crawlIdx + 1) % cr.length === 0) { const nd = turnWanted; turnWanted = null; if (Date.now() < turnWantedUntil && nd !== dir) { turnTo(nd, true); return; } }
    crawlIdx = (crawlIdx + 1) % cr.length; img.src = cr[crawlIdx].src; crawlNext = nextAt(crawlNext, cr[crawlIdx].dur * MOOD_MOVE.normal.speed / MV().speed, now);
    x += dir * 2 * (cr[crawlIdx].step || 0);
    if (sweetTimer <= 0 && hopping() && crawlIdx % 4 === 0 && mood === "guilleret" && sweets.length < 3 && !feeding) { sweetTimer = 12000 + Math.random() * 26000; sweetDrop(); }
  }
  if (x < minX) { x = minX; turnTo(1); }
  if (x > maxX) { x = maxX; turnTo(-1); }
  push();
}
