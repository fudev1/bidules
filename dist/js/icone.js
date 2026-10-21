// Icône de la barre de menu : la limace montre ce que fait Claude. Elle rampe s'il travaille (avec le visage de l'humeur),
// elle est intriguée s'il attend (une permission, sans doute), elle dort s'il a fini. Fermée, l'app la fige au repos (main.rs).
// Chaque image n'est convertie en PNG qu'une fois, et n'est envoyée que quand elle change.
const Icone = (() => {
  const T = window.__TAURI__, cv = document.createElement("canvas"), png = new Map(), imgs = new Map();
  cv.width = 64; cv.height = 36;
  let tag = "", i = 0, next = 0, montree = "";
  // l'apparence a changé : les images déjà converties ne valent plus
  Apparence.quandElleChange(() => { montree = ""; png.clear(); imgs.clear(); });
  function octets(src) {
    if (png.has(src)) return png.get(src);
    if (!imgs.has(src)) imgs.set(src, Object.assign(new Image(), {src}));
    const im = imgs.get(src);
    if (!im.complete) return null;          // pas encore décodée : on réessaie au tour suivant
    const g = cv.getContext("2d"); g.clearRect(0, 0, 64, 36); g.drawImage(im, 0, 29, 64, 32, 0, 2, 64, 32);   // la bande du bas de l'image, où vit la limace
    const p = new Promise(r => cv.toBlob(r, "image/png")).then(b => b.arrayBuffer()).then(a => new Uint8Array(a));
    png.set(src, p);
    return p;
  }
  return {
    oublier() { montree = ""; },
    // D : la feuille de la limace ; voulu : la balise à jouer
    async pas(D, voulu) {
      const now = Date.now();
      if (voulu !== tag) { tag = voulu; i = 0; next = 0; }
      if (now < next) return;
      const fr = D.tags[tag], f = fr[i % fr.length], src = Apparence.affichee(f.src);
      if (src !== montree) {
        const p = octets(src); if (!p) return;
        montree = src;
        await T.core.invoke("icone", await p);          // les octets bruts, sans passer par du JSON
      }
      i++; next = now + f.dur;
    },
  };
})();
