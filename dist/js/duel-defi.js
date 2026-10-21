// Un défi reçu d'un collègue : une bulle au-dessus du Bidule, « Accepter » / « Refuser ». Sans réponse au bout d'une minute, c'est refusé.
// Le nom vient du réseau : il n'entre que par textContent.
(() => {
  const T = window.__TAURI__; if (!T) return;
  let bulle = null, delai = null;
  function fermer() { clearTimeout(delai); if (bulle) bulle.remove(); bulle = null; }
  function repondre(accepte) { fermer(); T.core.invoke("duel_repondre", {accepte}); }
  T.event.listen("duel-defi", e => {
    fermer();
    if (style !== "limace") return T.core.invoke("duel_repondre", {accepte: false});      // seule la limace sait devenir raquette
    bulle = document.createElement("div"); bulle.className = "defi";
    const txt = document.createElement("b"); txt.textContent = `${e.payload.nom} te défie au Pong !`;
    const oui = document.createElement("button"); oui.textContent = "Accepter"; oui.onclick = () => repondre(true);
    const non = document.createElement("button"); non.textContent = "Refuser"; non.onclick = () => repondre(false);
    bulle.append(txt, oui, non); document.body.append(bulle);
    delai = setTimeout(() => repondre(false), 60000);
  });
  T.event.listen("duel-fin", fermer);
})();
