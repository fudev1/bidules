# Mesure ce que la retouche a changé entre l'import PixelLab (images net_*.png) et l'animation enregistrée dans Aseprite.
# C'est la matière des leçons : ce qu'on corrige à chaque fois devient une règle de moodboard/style-bidules.md.
#
#   python3 tools/bilan.py <nom> [<balise>]     le dossier animations/<nom>/ et la balise importée par tools/importer.py (par défaut <nom>)
#
# Écrit animations/<nom>/pixellab/bilan-<balise>.md et l'affiche.
import collections, glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bidules import ROOT, corps, lire_png
from verifier import images_de

hexa = lambda c: "#%02x%02x%02x" % c

def comparer(a, b):
    """compte, entre deux images, les pixels ajoutés, effacés et recoloriés, et où (contour du corps final ou intérieur)"""
    C = corps(b); bord = {(x, y) for x, y in C if any((x + i, y + j) not in C for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    n = collections.Counter(); recol = collections.Counter()
    for y in range(64):
        for x in range(64):
            p, q = a[y][x], b[y][x]
            if not p[3] and not q[3]: continue
            ou = "contour" if (x, y) in bord else "intérieur"
            if not p[3]: n["ajoutés"] += 1; n[f"ajoutés ({ou})"] += 1
            elif not q[3]: n["effacés"] += 1
            elif p[:3] != q[:3]: n["recoloriés"] += 1; n[f"recoloriés ({ou})"] += 1; recol[(p[:3], q[:3])] += 1
    return n, recol, sum(1 for row in b for p in row if p[3])

if __name__ == "__main__":
    if len(sys.argv) not in (2, 3): sys.exit(open(__file__).read().split("\nimport")[0])
    nom = sys.argv[1]; balise = sys.argv[2] if len(sys.argv) == 3 else nom; d = f"{ROOT}/animations/{nom}"
    imp = json.load(open(f"{d}/pixellab/import-{balise}.json"))
    nets = [lire_png(p) for p in sorted(glob.glob(f"{ROOT}/{imp['essai']}/net_*.png"))]
    fin = images_de(f"{d}/{imp['balise']}.aseprite")
    req = json.load(open(f"{ROOT}/{imp['essai']}/requete.json")) if os.path.exists(f"{ROOT}/{imp['essai']}/requete.json") else {}
    lignes = [f"# Bilan : {imp['balise']} ({imp['perso']})", "",
              f"- essai : `{imp['essai']}` ({req.get('commande', '?')}, action « {req.get('parametres', {}).get('action', req.get('parametres', {}).get('description', '?'))} », graine {req.get('parametres', {}).get('seed', '?')})",
              f"- images : {len(nets)} importées, {len(fin)} gardées" + (f" ({len(fin) - len(nets):+d})" if len(fin) != len(nets) else ""), "",
              "| image | retouchés | ajoutés | effacés | recoloriés | dont contour |", "| --- | --- | --- | --- | --- | --- |"]
    total, tous, recol_tot = collections.Counter(), 0, collections.Counter()
    for k in range(min(len(nets), len(fin))):
        n, r, op = comparer(nets[k], fin[k]); total += n; recol_tot += r; tous += op
        ch = n["ajoutés"] + n["effacés"] + n["recoloriés"]
        lignes.append(f"| {k} | {ch} ({100 * ch / max(op, 1):.0f} %) | {n['ajoutés']} | {n['effacés']} | {n['recoloriés']} | {n['ajoutés (contour)'] + n['recoloriés (contour)']} |")
    ch = total["ajoutés"] + total["effacés"] + total["recoloriés"]
    lignes += ["", f"**Retouché : {ch} pixels sur {tous} ({100 * ch / max(tous, 1):.0f} %)**, dont {total['ajoutés (contour)'] + total['recoloriés (contour)']} sur le contour.", ""]
    if recol_tot: lignes += ["Recoloriages les plus fréquents :", ""] + [f"- {hexa(a)} -> {hexa(b)} : {v}" for (a, b), v in recol_tot.most_common(6)] + [""]
    lignes += ["Leçons (à écrire avec Thibault, puis à reporter dans moodboard/style-bidules.md) :", "", "- "]
    open(f"{d}/pixellab/bilan-{balise}.md", "w").write("\n".join(lignes) + "\n"); print("\n".join(lignes))
