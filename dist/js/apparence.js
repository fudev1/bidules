// L'apparence de la limace (voir GLOSSARY.md) : une teinte par partie (corps, cheveux, pupilles, bouche), choisie dans une liste fermée.
// Chaque partie est reconnue à ses couleurs dans la feuille et dans l'image des cheveux ; chaque couleur d'origine est remplacée par le ton
// correspondant de la teinte (lumière -> lumière, base -> base, ombre -> ombre). Le contour (#000000) n'est pas une partie : il ne change jamais.
// Les images sont transformées une fois, au chargement de la feuille ou au changement d'apparence, pas à chaque image affichée.
// img.src garde l'image de la feuille (tout le reste du code la compare) ; l'affichage reçoit l'image teinte (Apparence.affichee, cheveux.js).
// Les verts de la nausée sont d'autres couleurs : ils ne sont jamais teints, la nausée passe donc devant l'apparence.
// Dans la page de test : await Apparence.appliquer({corps:"rose", cheveux:"roux", pupilles:"brun", bouche:"rouge"}) ; {} = l'apparence d'origine.
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
    bouche: {prune:["#3f3f74"], rose:["#a8476e"], rouge:["#9c2b3a"], brun:["#5e3a3a"]},
  };
  const ORIGINE = {corps:"bleu", cheveux:"encre", pupilles:"noir", bouche:"prune"};
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), cle = (r, g, b) => r << 16 | g << 8 | b;
  let voulue = {}, version = 0;
  const AFF = new Map();          // image de la feuille -> image teinte (absente : la même)
  // les remplacements de couleurs d'une partie (ou de toutes) pour une apparence ; vide pour l'apparence d'origine
  function table(app, parties) {
    const t = new Map();
    for (const p of parties) {
      const de = TEINTES[p][ORIGINE[p]], vers = TEINTES[p][app[p]];
      if (!vers || vers === de) continue;
      de.forEach((h, k) => { const [r, g, b] = rgb(h); t.set(cle(r, g, b), rgb(vers[k])); });
    }
    return t;
  }
  function teindre(d, t) {
    if (!t.size) return d;
    const o = new Uint8ClampedArray(d);
    for (let i = 0; i < o.length; i += 4) { if (!o[i + 3]) continue; const v = t.get(cle(o[i], o[i + 1], o[i + 2])); if (v) { o[i] = v[0]; o[i + 1] = v[1]; o[i + 2] = v[2]; } }
    return o;
  }
  // la feuille de la limace : chaque image garde ses pixels d'origine (f.px0) ; f.cv reçoit les pixels teints, que lisent l'étirement et la déformation
  async function preparer() {
    const D = SHEET_DATA.limace; if (!D) return;
    const v = ++version, t = table(voulue, ["corps", "pupilles", "bouche"]);
    for (const [k, f] of D.frames.entries()) {
      if (k % 40 === 39) { await new Promise(r => setTimeout(r)); if (v !== version) return; }
      const g = f.cv.getContext("2d", {willReadFrequently:true});
      if (!f.px0) f.px0 = g.getImageData(0, 0, f.cv.width, f.cv.height).data.slice();
      g.putImageData(new ImageData(teindre(f.px0, t), f.cv.width, f.cv.height), 0, 0);
      if (t.size) AFF.set(f.src, f.cv.toDataURL()); else AFF.delete(f.src);
    }
    // la goutte tenue (tenu.js) est dessinée par le code : ses couleurs suivent la teinte du corps, et le vert de la nausée les remplace toujours
    const c = TEINTES.corps[voulue.corps] || TEINTES.corps.bleu, vert = [[198, 240, 176], [127, 212, 106], [79, 174, 69]];
    [SW_COL.light, SW_COL.base, SW_COL.shade] = c.map(rgb);
    for (const k in SW_GREEN) delete SW_GREEN[k];
    c.forEach((h, k) => { SW_GREEN[rgb(h).join(",")] = vert[k]; });
    const P = D.tags["attrape-boule-parts"];
    if (P && style === "limace") swing.parts = P.map(f => Object.assign(new Image(), {src:affichee(f.src)}));
    cheveuxTeints();
    hair.cache.clear(); DEF_CACHE.clear(); Icone.oublier(true);
    hairPaint();
  }
  // les cheveux : leurs pixels d'origine (hair.px0) et leurs pixels teints (hair.px, que lit cheveux.js)
  function cheveuxTeints() {
    if (!hair.px0) return;
    hair.px = teindre(hair.px0, table(voulue, ["cheveux"])); hair.cache.clear();
  }
  const affichee = src => AFF.get(src) || src;
  return {
    TEINTES, ORIGINE, affichee, cheveuxTeints, preparer,
    // app : {corps, cheveux, pupilles, bouche}, chaque valeur un nom de TEINTES ; une partie absente garde sa teinte d'origine
    appliquer(app) { voulue = Object.assign({}, app || {}); return preparer(); },
    get courante() { return Object.assign({}, voulue); },
  };
})();
