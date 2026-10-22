// La souris : clics, prise en main, lancer, fichiers déposés, et le regard qui suit le curseur.
function clicked() {
  const now = Date.now();
  if (mode === "ceiling" || mode === "ceilswing") { ceilingUntil = 0; ceilSw = null; setMode("ceiling"); return; }          // collé en haut : un clic le fait se décoller
  if (mode === "sleep") {
    wake += 40;
    if (wake >= 100) wakeUp("clics");
    else { img.src = FR.remue; bubble("Hm...", 700); setTimeout(() => { if (mode === "sleep") img.src = FR.dort; }, 700); }
    return;
  }
  disturb(); sing = false;
  clicks = clicks.filter(t => now - t < 1500); clicks.push(now);
  if (!["walk", "pet", "laugh"].includes(mode)) return;
  if (clicks.length >= 7) { clicks = []; react("angry", 1300, FR.fache, "shake"); bubble("Grrr !", 1300); say("chatouilles : il se fache"); }
  else if (clicks.length >= 3) {
    if (mode !== "laugh") { say("chatouilles : il rit"); bubble("Hi hi !", 900); }
    react("laugh", 1400, FR.rire, isSheet() ? "" : "giggle");      // perso dessiné : son animation rire suffit, pas de tremblement en plus
  } else if (isSheet()) playOnce(watching || Date.now() < idleUntil ? "saut-face" : "saut");
  else { pose("hop"); setTimeout(() => { if (mode === "walk") pose("walk"); }, 450); }
}
img.addEventListener("pointerdown", e => {
  if (e.button !== 0 || pull.on) return;
  // saisi au plafond ou sur un mur (pas pendant l'écrasement contre le bord) : il reste collé, et s'étire depuis ce bord si on tire (pullStart)
  const pullable = isSheet() && !NO_PULL.has(style), edge = !pullable ? null : mode === "ceiling" ? "ceiling"
    : mode === "wall" && !(sheetOnce && /^choc-bord/.test(sheetOnce.tag)) ? (wallSide < 0 ? "left" : "right") : null;
  if (!edge && (mode === "ceiling" || mode === "corner" || mode === "ceilswing")) { corner = null; ceilSw = null; unceil(false); setMode("fly"); }          // pris à la souris pendant qu'il passe le coin ou se balance : il se remet à l'endroit
  img.setPointerCapture(e.pointerId);
  drag = {sx:e.screenX, sy:e.screenY, x0:x, y0:y, gx:e.clientX, gy:e.clientY, moved:false, rev:[], sign:0, shaken:false, asleep:mode === "sleep", edge};
  samples = [{t:performance.now(), x:e.screenX, y:e.screenY}];
  img.style.cursor = "grabbing"; haptic("clic");
  if (!edge && (mode === "fly" || mode === "wall" || mode === "wallland")) {      // rattrapé en l'air (ou décroché du mur) : il se débat dès le clic, sans attendre que la souris bouge
    if (mode === "wall" || mode === "wallland") { x = Math.max(minX, Math.min(maxX, x)); drag.x0 = x; }
    if (mode === "wall" && wallStick) wallShape(false);
    drag.moved = true; drag.lastX = e.screenX; drag.lastY = e.screenY;
    setMode("held"); struggle(true); if (isSheet()) holdByHead(e.screenX, e.screenY); disturb(); if (style === "candy") bubble("Hé !", 900);
    say("rattrape en l'air");
  }
});
img.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.screenX - drag.sx, dy = e.screenY - drag.sy;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 3) {
    drag.moved = true;
    if (mode === "wall" && !drag.edge) { x = Math.max(minX, Math.min(maxX, x)); drag.x0 = x; }          // décroché du mur : la fenêtre revient dans l'écran
    if (drag.edge) { if (!pullStart(drag.edge) && mode === "ceiling") { unceil(false); setMode("fly"); } }          // tiré depuis le plafond ou un mur
    else if (isSheet() && !NO_PULL.has(style) && !drag.asleep && !["fly", "splat", "reform"].includes(mode) && y >= floorY - 4) pullStart();
    if (drag.asleep) { setMode("carried"); pose(isSheet() ? "" : "dangle"); img.src = isSheet() ? FR.p1 : FR.dort; holdByHead(e.screenX, e.screenY); say("porte endormi"); }
    else { setMode("held"); struggle(true); if (isSheet() && !pull.on) holdByHead(e.screenX, e.screenY); disturb(); if (style === "candy") bubble("Hé !", 900); }
  }
  if (!drag.moved) return;
  drag.lastX = e.screenX; drag.lastY = e.screenY;
  if (pull.on && pull.phase === "ground") { pull.d = pull.dm = edgeFrom(EDGE_ROT[pull.side || "floor"], (e.screenX - drag.sx) / 2, (e.screenY - drag.sy) / 2); return; }
  if (drag.asleep) {
    const pv = samples[samples.length - 1], dtm = Math.max(8, performance.now() - pv.t);
    const speed = Math.hypot(e.screenX - pv.x, e.screenY - pv.y) / dtm * 1000;
    if (speed > GENTLE) wake += (speed - GENTLE) * dtm / 1000 * 0.25;
    if (wake > 35 && !stirred) { stirred = true; bubble("Hm ?", 800); say("il commence a se reveiller"); }      // porté, il reste dans attrape : pas de retour à une pose de sommeil
    if (wake >= 100) { drag.asleep = false; setMode("held"); struggle(true); holdByHead(); bubble("Hé !", 900); say("reveille : porte trop vite"); calm = 0; wake = 0; }
  }
  const prev = samples[samples.length - 1], ddx = e.screenX - prev.x;
  if (Math.abs(ddx) > 6) {
    const sg = Math.sign(ddx), t = performance.now();
    if (drag.sign && sg !== drag.sign) {
      drag.rev = drag.rev.filter(r => t - r < 1200); drag.rev.push(t); haptic("clic");
      if (drag.asleep && drag.rev.length >= 3) { drag.asleep = false; setMode("held"); struggle(true); holdByHead(); bubble("Hein ?!", 900); say("reveille : secoue"); calm = 0; wake = 0; }
      if (drag.rev.length >= 5 && !drag.shaken) {
        drag.shaken = true; say("il se fait secouer"); bubble("Ouaaah !", 1100); compter("secousses");
        clearInterval(flap); if (!isSheet()) flap = setInterval(() => { img.src = img.src === FR.n1 ? FR.n2 : FR.n1; }, 90);
      }
    }
    drag.sign = sg;
  }
  if (drag.shaken && performance.now() > nextDrop) { drop(); drop(); nextDrop = performance.now() + 80; }
  samples.push({t:performance.now(), x:e.screenX, y:e.screenY}); if (samples.length > 8) samples.shift();
  x = drag.x0 + dx; y = drag.y0 + dy; push();
  const ox = swingBig ? SWING_OFF[0] : 0, oy = swingBig ? SWING_OFF[1] : 0, dehors = x + ox < minX || x + ox > maxX || y + oy > floorY;          // tenu, il bute contre un bord de l'écran (ou le bas) : un cran en y arrivant
  if (dehors && !drag.dehors) haptic("cran");
  drag.dehors = dehors;
});
img.addEventListener("pointerup", async () => {
  if (!drag) return;
  const {moved, shaken, asleep} = drag; drag = null; img.style.cursor = "grab"; struggle(false);
  if (pull.on && pull.phase === "ground") { pull.phase = "back"; pull.vd = [0, 0]; setMode("springback"); return; }
  const now = performance.now(), last = samples[samples.length - 1];
  const old = samples.find(s => now - s.t < 90) || last, dt = Math.max(16, last.t - old.t);
  const tvx = Math.max(-28, Math.min(28, (last.x - old.x) / dt * 33 * 0.55)), tvy = Math.max(-28, Math.min(28, (last.y - old.y) / dt * 33 * 0.55));
  const fromPull = pull.on && pull.phase === "hang";
  if (fromPull) await pullFinish();
  if (!moved) { clicked(); return; }
  vx = tvx; vy = tvy;
  nausea = shaken;
  await bounds();
  if (asleep) { bubble("Hein ?!", 900); say(Math.hypot(vx, vy) > 10 ? "reveille : lance" : "reveille : repose au sol"); calm = 0; wake = 0; }     // attrapé endormi, il ne se rendort pas : il retombe réveillé
  disturb();
  say(`lance : vitesse ${Math.round(vx)}, ${Math.round(vy)}`);
  if (!isSheet()) img.src = FR.p1; pose(""); setMode("fly"); bounces = 0; angle = 0; spin = 0; maxImpact = 0; crashed = false;
  if (isSheet()) sheetAnim(Date.now());
  if (fromPull) img.style.opacity = "";
});
function stopWatch() { watching = false; lookKey = ""; if (mode === "walk" && !isSheet()) img.src = FR.normal; }
// La souris n'est lue que dans les modes où il la regarde ; loin de lui, moins souvent.
const REGARDE = new Set(["walk", "pet", "sleep"]);
let cursorFar = false;
quandMode(m => { if (!REGARDE.has(m)) { if (watching) stopWatch(); pet.last = null; } });
async function watchCursor() {
  if (drag || !REGARDE.has(mode)) { if (watching) stopWatch(); pet.last = null; return; }
  let c;
  try { c = await T.window.cursorPosition(); } catch (e) { say("cursorPosition: " + e); Horloge.retirer("curseur"); return; }
  const cx = c.x / scale, cy = c.y / scale; cursor = {x:cx, y:cy};
  const inside = cx > x + 54 && cx < x + 122 && cy > y + 96 && cy < y + WH;
  cursorFar = !inside && Math.hypot(cx - (x + 88), cy - (y + 120)) > 400;
  if (inside && pet.last !== null) {
    const ddx = cx - pet.last;
    if (Math.abs(ddx) >= 3) {
      const sg = Math.sign(ddx), t = Date.now();
      if (pet.dir && sg !== pet.dir) { pet.flips = pet.flips.filter(f => t - f < 1200); pet.flips.push(t); haptic("cran"); }          // caressé : un cran à chaque aller-retour, comme un ronron
      pet.dir = sg;
    }
    if (pet.flips.length >= 2 && mode === "sleep") {
      if (Date.now() > nextFx) { heart(); nextFx = Date.now() + 450; }
    } else if (pet.flips.length >= 2) {
      if (mode !== "pet") { say("caresse : il est content"); react("pet", 900, FR.content, ""); }
      else reactUntil = Date.now() + 900;
    }
  }
  if (!inside) { pet.flips = []; pet.dir = 0; }
  pet.last = inside ? cx : null;
  if (mode === "pet" || mode === "sleep") return;
  if (isSheet() && sheetOnce) { lookKey = ""; return; }
  if (feeding) { if (watching) stopWatch(); return; }
  const eyeY = EYE_Y[style] - (style !== "classique" && partsBy[style].pattes === "longues" ? 14 : 0);
  const dx = cx - (x + 88), dy = cy - (y + eyeY), dist = Math.hypot(dx, dy);
  if (dist < 240 && mood === "ronchon") {
    if (!watching) { say("il te tourne le dos"); bubble("Laisse-moi...", 1100); }
    watching = true; idleUntil = Date.now() + 700;
    const away = dx < 0 ? 1 : -1; if (away !== dir) { dir = away; face(); }
    return;
  }
  if (dist < 240) {
    if (!watching) say("il te regarde");
    watching = true; idleUntil = Date.now() + 700;
    // perso dessiné encore de profil ou en train de se tourner : on attend qu'il soit de face pour changer son regard
    const turning = isSheet() && (faceSeq || !FRONT.has(img.src));
    const nd = dx < 0 ? -1 : 1; if (!turning && nd !== dir && Math.abs(dx) > 12) { dir = nd; face(); }
    const key = (Math.abs(dx) > 20 ? 1 : 0) + "," + (dy < -30 ? -1 : dy > 30 ? 1 : 0);
    if (turning) lookKey = ""; else if (key !== lookKey) { lookKey = key; img.src = LOOK[key]; }
  } else if (watching) stopWatch();
}
try {
  T.webview.getCurrentWebview().onDragDropEvent(ev => {
    const p = ev.payload;
    if (p.type === "enter" || p.type === "over") {
      if (mode === "walk" || mode === "pet") { react("ooh", 600000, FR.ooh, ""); bubble("Oh ?", 900); say("un fichier approche"); }
    } else if (p.type === "leave") { if (mode === "ooh") toWalk(); }
    else if (p.type === "drop") {
      const paths = p.paths || [], name = (paths[0] || "").split("/").pop();
      say(`il fait semblant de manger ${name}${paths.length > 1 ? ` et ${paths.length - 1} autre(s)` : ""} (fichier non touche)`);
      disturb(); react("eat", tagDur("mange") || 1800, FR.rire, ""); playOnce("mange"); bubble("Miam !", 1000); compter("repas");
    }
  });
} catch (e) { say("drag-drop: " + e); }
