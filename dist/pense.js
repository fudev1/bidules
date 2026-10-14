// Les icônes de la bulle de pensée (ce que fait Claude) : grilles de pixels, couleurs, libellés, et l'icône d'après l'outil appelé.
// Partagé par la fenêtre du Bidule (index.html) et le panneau (panel.html).
const PENSE_ICONS = {
  pense:   [[".........", ".........", ".kk......", ".kk......", ".........", ".........", "........."], [".........", ".........", ".kk.kk...", ".kk.kk...", ".........", ".........", "........."],
            [".........", ".........", ".kk.kk.kk", ".kk.kk.kk", ".........", ".........", "........."]],
  lit:     [["kkkk.kkkk", "kwwkkkwwk", "kbbkkkbbk", "kwwkkkwwk", "kbbkkkbbk", "kwwkkkwwk", "kkkkkkkkk"], ["kkkk.kkkk", "kbbkkkwwk", "kwwkkkbbk", "kbbkkkwwk", "kwwkkkbbk", "kbbkkkwwk", "kkkkkkkkk"]],
  ecrit:   [[".......kk", "......kpk", ".....kyk.", "....kyk..", "...kyk...", "..kk.....", "bbbbb...."], ["......kk.", ".....kpk.", "....kyk..", "...kyk...", "..kyk....", ".kk......", "bbbbbbbb."]],
  commande:[["kkkkkkkkk", "kgk.....k", "k.gk....k", "kgk.ggg.k", "k.......k", "kkkkkkkkk", "........."], ["kkkkkkkkk", "kgk.....k", "k.gk....k", "kgk.....k", "k.......k", "kkkkkkkkk", "........."]],
  cherche: [["..kkk....", ".kbbbk...", "kbwbbbk..", "kbbbbbk..", ".kbbbk...", "..kkkkk..", "......kk."], ["...kkk...", "..kbbbk..", ".kbwbbbk.", ".kbbbbbk.", "..kbbbk..", "...kkkkk.", ".......kk"]],
  web:     [["..kkkkk..", ".kbgbbgk.", "kggbbgggk", "kbbbggbbk", "kbggbbbgk", ".kbbbggk.", "..kkkkk.."], ["..kkkkk..", ".kgbbgbk.", "kbbgggbgk", "kggbbbggk", "kbbbggbbk", ".kggbbbk.", "..kkkkk.."]],
  agent:   [[".kk...kk.", "kppk.kbbk", "kppk.kbbk", ".kk...kk.", ".........", "..k...k..", "........."], [".kk...kk.", "kbbk.kppk", "kbbk.kppk", ".kk...kk.", ".........", "...k.k...", "........."]],
  outil:   [["......kk.", ".....k..k", "....kk.k.", "...kyk...", "..kyk....", ".kyk.....", "kk......."], [".....kk..", "....k..k.", "...kk.k..", "..kyk....", ".kyk.....", "kyk......", "kk......."]],
};
const PENSE_COL = {k:"#2a2238", w:"#ffffff", b:"#8ec5ff", g:"#5fd38a", p:"#ff7fa0", y:"#ffd25a"};
const PENSE_LABEL = {pense:"il réfléchit", lit:"il lit", ecrit:"il écrit", commande:"il lance une commande", cherche:"il cherche", web:"il va sur le web", agent:"il délègue", outil:"il bricole"};
function penseIcon(tool) {
  if (!tool || tool === "pense") return tool && "pense";
  if (/^(Read|NotebookRead)$/.test(tool)) return "lit";
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return "ecrit";
  if (/^(Bash|BashOutput|Monitor|KillShell|TaskStop)$/.test(tool)) return "commande";
  if (/^(Grep|Glob|LS|ToolSearch)$/.test(tool)) return "cherche";
  if (/^Web/.test(tool)) return "web";
  if (/^(Agent|Task|SendMessage)$/.test(tool)) return "agent";
  return "outil";
}
