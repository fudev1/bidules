// Le décompte avant un jeu à deux : 3, 2, 1, « C'est parti ! » par-dessus la fenêtre du jeu, puis fini() lance le jeu.
// Commun à tous les jeux : chaque page de jeu l'appelle à son ouverture, qui a lieu en même temps chez les deux joueurs.
function decompte(fini) {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;inset:0;display:grid;place-items:center;pointer-events:none;" +
    "font:700 22vh/1 -apple-system,system-ui,sans-serif;color:#fff;text-shadow:0 .04em 0 rgba(20,16,32,.6)";
  document.body.append(d);
  const etapes = ["3", "2", "1", "C'est parti !"];
  const montrer = i => {
    if (i === etapes.length) { d.remove(); return; }
    d.textContent = etapes[i];
    d.style.fontSize = i === 3 ? "12vh" : "22vh";
    d.animate([{transform: "scale(1.4)", opacity: 0}, {transform: "scale(1)", opacity: 1}], {duration: 250, easing: "ease-out"});
    if (i === 3) fini();
    setTimeout(() => montrer(i + 1), i === 3 ? 600 : 1000);
  };
  montrer(0);
}
