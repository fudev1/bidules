// L'apparence de la limace (voir GLOSSARY.md) : une teinte par partie (corps, cheveux, pupilles, bouche), choisie dans une liste fermée.
// Chaque partie est reconnue à ses couleurs dans la feuille et dans l'image des cheveux ; chaque couleur d'origine est remplacée par le ton
// correspondant de la teinte (lumière -> lumière, base -> base, ombre -> ombre). Le contour (#000000) n'est pas une partie : il ne change jamais.
// Les pupilles (#000001) et l'intérieur de la bouche (#3f3f75) ont leur couleur à eux, presque celle de l'encre ou de
// l'ombre des éclaboussures vertes (#3f3f74), pour être reconnus sans toucher au reste (posées par gen.py). Les cheveux sont une image à part.
// Les images sont transformées une fois, au chargement de la feuille ou au changement d'apparence, pas à chaque image affichée.
// img.src garde l'image de la feuille (tout le reste du code la compare) ; l'affichage reçoit l'image teinte (Apparence.affichee, cheveux.js).
// Les verts de la nausée sont d'autres couleurs : ils ne sont jamais teints, la nausée passe donc devant la teinte du corps ; le motif, lui, reste dessus.
// Chaque sous-système qui dessine avec ces couleurs (cheveux, goutte tenue, icône, déformation) s'abonne : Apparence.quandElleChange(fn).
// Dans la page de test : await Apparence.appliquer({corps:"rose", cheveux:"roux", pupilles:"brun", bouche:"rouge", motif:"pois", motifTeinte:"blanc"}) ;
// {} = l'apparence d'origine. Le motif est posé sur les pixels du corps (ses trois tons d'origine et ceux de la nausée), dans toutes les animations et tous les états.
// Teintes provisoires : elles seront remplacées par la planche validée, puis écrites dans moodboard/style-bidules.md.
const Apparence = (() => {
  const TEINTES = {
    corps: {          // lumière, base, ombre
      bleu:["#a4c6ff", "#639bff", "#4577e0"], rose:["#ffd6e8", "#ff9cc6", "#e0679f"], menthe:["#c8f4e6", "#8ee5cf", "#5cc8c0"],
      lavande:["#ddd0ff", "#a98cf0", "#7c62cc"], peche:["#ffe0c4", "#ffb07c", "#e08452"], citron:["#fff6a8", "#f5dc4a", "#cfae22"],
      gris:["#e2e4ea", "#a9adb8", "#7c8090"], brun:["#d8b48c", "#a87850", "#7c5434"], blanc:["#f6f6f0", "#dcdcd2", "#b4b4aa"],
      "noir doux":["#7a7a90", "#4e4e62", "#34343f"],
    },
    cheveux: {encre:["#000000"], brun:["#6b4226"], roux:["#d2622e"], blond:["#e8c04a"], rose:["#ff7fb8"], bleu:["#3d6fd8"]},
    pupilles: {noir:["#000001"], brun:["#5a3a22"], bleu:["#2f5fd0"], vert:["#2f8f4a"], violet:["#6a3fa0"]},
    bouche: {prune:["#3f3f75"], rose:["#a8476e"], rouge:["#9c2b3a"], brun:["#5e3a3a"]},
  };
  const ORIGINE = {corps:"bleu", cheveux:"encre", pupilles:"noir", bouche:"prune"};
  // l'état du jeu (jeu.js : besoins) passe devant la teinte et le motif du corps, sans toucher à l'apparence gardée ; à part de TEINTES, que le panneau propose
  const VERTS = ["#c6f0b0", "#7fd46a", "#4fae45"];          // le corps vert de la nausée (gen.py : VERT D, A, C), lumière, base, ombre
  const ETATS = {malade:["#d4e8b0", "#a8c878", "#7c9a52"], squelette:["#f4f0e0", "#d8d0b8", "#a8a088"]};
  // les motifs du corps : nom affiché, deuxième teinte par défaut (une teinte du corps, celle du dessin ; le fond reste la teinte du corps)
  // et dessin : (x, y) dans l'image 64 x 64 de face (SHEET_DATA.limace.front) -> vrai si le pixel est dans le dessin.
  // Le dessin est collé au corps : dans chaque image de la feuille, il est étiré, écrasé et décalé comme le corps (voir repere).
  const COEUR = [".x.x.", "xxxxx", "xxxxx", ".xxx.", "..x.."];
  const TACHES = [[16, 41, 4, 5], [43, 38, 4, 3], [21, 56, 6, 2], [42, 54, 4, 3], [30, 35, 4, 2]];
  const MOTIFS = {
    rayures: {nom:"Rayures", teinte:"blanc", dessin:(x, y) => y % 6 < 2},
    pois: {nom:"Pois", teinte:"blanc", dessin:(x, y) => { const a = (x + (Math.floor(y / 8) % 2) * 4) % 8 - 2, b = y % 8 - 2; return Math.abs(a) + Math.abs(b) <= 1 || (a >= -1 && a <= 0 && b >= -1 && b <= 0); }},
    coeurs: {nom:"Cœurs", teinte:"rose", dessin:(x, y) => { const r = Math.floor(y / 8); return COEUR[y % 8]?.[(x + (r % 2) * 5) % 10] === "x"; }},
    vache: {nom:"Vache", teinte:"noir doux", dessin:(x, y) => TACHES.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + 0.25 * Math.sin(x * 1.7 + y) <= 1)},
  };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), cleCouleur = (r, g, b) => r << 16 | g << 8 | b;
  let choisie = {}, etat = "", chargement = 0;
  const imagesTeintes = new Map();          // image de la feuille -> image teinte (absente : la même)
  const abonnes = [];
  // les remplacements de couleurs de quelques parties pour une apparence : clé de la couleur d'origine -> ton ; vide pour l'apparence d'origine
  function remplacements(app, parties) {
    const r = new Map();
    for (const p of parties) {
      const de = TEINTES[p][ORIGINE[p]], vers = TEINTES[p][app[p]];
      if (!vers || vers === de) continue;
      de.forEach((h, k) => { const [R, G, B] = rgb(h); r.set(cleCouleur(R, G, B), rgb(vers[k])); });
    }
    return r;
  }
  // le motif posé : ton d'origine du corps (sa clé) -> ton de la deuxième teinte, pour que le dessin reprenne l'ombre du pixel recouvert
  function motifPose(app) {
    const m = MOTIFS[app.motif]; if (!m) return null;
    const vers = TEINTES.corps[app.motifTeinte] || TEINTES.corps[m.teinte], tons = new Map();
    for (const de of [TEINTES.corps[ORIGINE.corps], VERTS]) de.forEach((h, k) => { const [r, g, b] = rgb(h); tons.set(cleCouleur(r, g, b), rgb(vers[k])); });
    return {dessin:m.dessin, tons};
  }
  // la forme du corps dans une image : sa ligne du bas, sa hauteur, sa largeur, et le milieu de chaque ligne
  function forme(d, w) {
    const h = d.length / 4 / w, mil = new Array(h).fill(null);
    let haut = h, bas = -1, gauche = w, droite = -1;
    for (let y = 0; y < h; y++) {
      let l = w, r = -1;
      for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (l === w) l = x; r = x; }
      if (r < 0) continue;
      mil[y] = (l + r) / 2; haut = Math.min(haut, y); bas = y; gauche = Math.min(gauche, l); droite = Math.max(droite, r);
    }
    return {bas, H:bas - haut + 1, W:droite - gauche + 1, cx:(gauche + droite) / 2, mil};
  }
  // (x, y) d'une image -> (x, y) dans l'image de face : la hauteur et la largeur du corps sont ramenées à celles de face (posé sur la même ligne du bas),
  // et chaque ligne garde son milieu : le dessin s'étire, s'écrase et se penche avec le corps, comme des pixels peints dessus
  function repere(d, w, ref) {
    const f = forme(d, w), sx = ref.W / f.W, sy = ref.H / f.H;
    return (x, y) => [Math.round(ref.cx + (x - (f.mil[y] ?? f.cx)) * sx), Math.round(ref.bas - (f.bas - y) * sy)];
  }
  function teindre(d, remp, motif = null, w = 64, ref = null) {
    if (!remp.size && !motif) return d;
    const o = new Uint8ClampedArray(d), vers = motif && ref ? repere(d, w, ref) : (x, y) => [x, y];
    for (let i = 0; i < o.length; i += 4) {
      if (!o[i + 3]) continue;
      const c = cleCouleur(o[i], o[i + 1], o[i + 2]), p = i / 4;
      const ton = (motif && motif.tons.has(c) && motif.dessin(...vers(p % w, Math.floor(p / w)))) ? motif.tons.get(c) : remp.get(c);
      if (ton) { o[i] = ton[0]; o[i + 1] = ton[1]; o[i + 2] = ton[2]; }
    }
    return o;
  }
  // la feuille de la limace : chaque image garde ses pixels d'origine (f.px0) ; f.cv reçoit les pixels teints, que lisent l'étirement et la déformation.
  // Puis chaque abonné refait ce qu'il avait gardé.
  async function preparer() {
    const D = SHEET_DATA.limace; if (!D) return;
    const n = ++chargement, remp = remplacements(choisie, ["corps", "pupilles", "bouche"]), motif = motifPose(choisie);
    if (etat) TEINTES.corps[ORIGINE.corps].forEach((h, k) => { const [r, g, b] = rgb(h); remp.set(cleCouleur(r, g, b), rgb(ETATS[etat][k])); });
    const g0 = D.front.cv.getContext("2d", {willReadFrequently:true});
    if (!D.front.px0) D.front.px0 = g0.getImageData(0, 0, D.front.cv.width, D.front.cv.height).data.slice();
    const ref = motif ? forme(D.front.px0, D.front.cv.width) : null;
    for (const [k, f] of D.frames.entries()) {
      if (k % 40 === 39) { await new Promise(r => setTimeout(r)); if (n !== chargement) return; }
      const g = f.cv.getContext("2d", {willReadFrequently:true});
      if (!f.px0) f.px0 = g.getImageData(0, 0, f.cv.width, f.cv.height).data.slice();
      g.putImageData(new ImageData(teindre(f.px0, remp, motif, f.cv.width, ref), f.cv.width, f.cv.height), 0, 0);
      if (remp.size || motif) imagesTeintes.set(f.src, f.cv.toDataURL()); else imagesTeintes.delete(f.src);
    }
    for (const fn of abonnes) fn();
  }
  const affichee = src => imagesTeintes.get(src) || src;
  return {
    TEINTES, ORIGINE, MOTIFS, affichee, preparer,
    // la seule question à poser : ce Bidule a-t-il une apparence ? Seule la limace a des teintes pour l'instant.
    aUneApparence: s => s === "limace",
    // fn est appelée après chaque changement d'apparence, une fois la feuille teinte
    quandElleChange(fn) { abonnes.push(fn); },
    // les pixels de l'image des cheveux (RGBA), aux couleurs de l'apparence choisie
    teindreCheveux: px => teindre(px, remplacements(choisie, ["cheveux"])),
    // un ton du corps dessiné par le code (k : 0 lumière, 1 base, 2 ombre), au pixel (x, y) de l'image 64 x 64 : la teinte du corps, ou le motif ;
    // sans (x, y) : la teinte du corps seule
    tonDuCorps(k, x, y) {
      const m = this.tonDuMotif(k, x, y); if (m) return m;
      if (etat) return rgb(ETATS[etat][k]);
      return rgb((TEINTES.corps[choisie.corps] || TEINTES.corps[ORIGINE.corps])[k]);
    },
    // le ton du motif au pixel (x, y) de l'image de face, ou null hors du dessin ; sans (x, y) : le ton du motif, s'il y en a un
    tonDuMotif(k, x, y) {
      const motif = MOTIFS[choisie.motif];
      if (!motif || (x !== undefined && !motif.dessin(x, y))) return null;
      return rgb((TEINTES.corps[choisie.motifTeinte] || TEINTES.corps[motif.teinte])[k]);
    },
    // les couleurs du motif posé (clés r << 16 | g << 8 | b), pour le reconnaître dans une image teinte
    get clesDuMotif() { return new Set([0, 1, 2].map(k => this.tonDuMotif(k)).filter(Boolean).map(([r, g, b]) => cleCouleur(r, g, b))); },
    // apparence : {corps, cheveux, pupilles, bouche}, chaque valeur un nom de TEINTES ; une partie absente garde sa teinte d'origine.
    // motif : un nom de MOTIFS (absent ou null : aucun motif) ; motifTeinte : sa deuxième teinte, un nom de TEINTES.corps (absente : celle du motif)
    appliquer(apparence) { choisie = Object.assign({}, apparence || {}); return preparer(); },
    // "malade", "squelette" ou "" (sa teinte)
    etat(e) { if (e === etat) return; etat = e; return preparer(); },
    get courante() { return Object.assign({}, choisie); },
  };
})();
