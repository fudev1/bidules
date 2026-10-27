// Les accessoires du visage de la limace (évolution, premier essai) : pour l'instant les lunettes (un seul emplacement, le visage).
// Une image dessinée (animations/accessoires/lunettes.aseprite, exportée par tools/accessoires.py), 32 × 16, autour de deux yeux de profil :
// l'œil de gauche en x 12, celui de droite en x 18, leur bas sur la ligne 8. Elle est posée en direct sur chaque image affichée, recalée sur
// ses yeux (« yeux » dans sheet.json, trouvés par gen.py), seulement sur le corps, jamais sur son contour : elle suit le corps dans toutes les
// animations et toutes les humeurs : la moitié gauche suit l'œil de gauche, la droite l'œil de droite, le pont (colonne 15)
// s'allonge entre les deux ; les verres sont d'un blanc plein, qui cache les yeux : pas de regard à suivre derrière. Une image sans yeux trouvés (écrasée contre un mur, en éclaboussure) reste sans accessoire. Posées par cheveux.js (hairComposite).
const VISAGE_W = 32, VISAGE_H = 16, VISAGE_G = 12, VISAGE_D = 18, VISAGE_PONT = 15, VISAGE_Y = 8;
const VISAGES = ["lunettes"];
let visage = null;          // null ou "lunettes" ; gardé dans l'état (demarrage.js)
const visagePx = {}, visagePx0 = {};          // aux couleurs de l'apparence (la monture, les verres : apparence.js), et d'origine
async function visageCharger() {
  await Promise.all(VISAGES.map(async n => {
    if (visagePx[n]) return;
    const im = new Image(); im.src = `persos/limace/${n}.png`; await im.decode();
    const cv = document.createElement("canvas"); cv.width = VISAGE_W; cv.height = VISAGE_H; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
    visagePx0[n] = g.getImageData(0, 0, VISAGE_W, VISAGE_H).data; visagePx[n] = Apparence.teindreLunettes(visagePx0[n]);
  }));
}
// avant cheveux.js et tenu.js, qui refont alors leurs images avec ces couleurs
Apparence.quandElleChange(() => { for (const n in visagePx0) visagePx[n] = Apparence.teindreLunettes(visagePx0[n]); });
const visagePret = () => !!(visage && visagePx[visage]);
// pose l'accessoire sur d (les pixels RGBA 64 x 64 affichés de l'image f de la feuille) ; corps : les pixels qui disent où est le corps
// (par défaut d ; null : partout, pour les parties d'attrape-boule, posées sur la boule que dessine tenu.js)
function visagePoser(d, f, corps = d) {
  if (!visagePret() || !f.yeux) return;
  const A = visagePx[visage], s = f.renverse ? -1 : 1, [[lx, ly], [rx, ry]] = f.yeux, my = Math.round((ly + ry) / 2);
  const opaque = (X, Y) => X >= 0 && Y >= 0 && X < 64 && Y < 64 && (!corps || corps[(Y * 64 + X) * 4 + 3] > 0);
  const surLeCorps = (X, Y) => opaque(X, Y) && opaque(X + 1, Y) && opaque(X - 1, Y) && opaque(X, Y + 1) && opaque(X, Y - 1);
  const poser = (X, Y, i) => {
    if (!surLeCorps(X, Y)) return;
    const o = (Y * 64 + X) * 4;
    for (let k = 0; k < 3; k++) d[o + k] = A[i + k];
    d[o + 3] = 255;
  };
  for (let v = 0; v < VISAGE_H; v++) for (let u = 0; u < VISAGE_W; u++) {
    const i = (v * VISAGE_W + u) * 4; if (!A[i + 3]) continue;
    if (u < VISAGE_PONT) poser(lx + u - VISAGE_G, ly + s * (v - VISAGE_Y), i);
    else if (u > VISAGE_PONT) poser(rx + u - VISAGE_D, ry + s * (v - VISAGE_Y), i);
    else for (let X = lx + VISAGE_PONT - VISAGE_G; X <= rx + VISAGE_PONT - VISAGE_D; X++) poser(X, my + s * (v - VISAGE_Y), i);
  }
}
