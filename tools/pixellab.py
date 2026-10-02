# Génère avec l'API PixelLab à partir des images des Bidules, et range la sortie brute avec tout ce qu'il faut pour la refaire.
# Le jeton est lu dans la variable PIXELLAB_SECRET (voir mise.local.toml.exemple) ; il ne va jamais dans le repo.
#
#   python3 tools/pixellab.py solde
#   python3 tools/pixellab.py animer <nom> <image> "<action>" [--fin <image>] [--images 8] [--graine N]
#        anime une image existante (animate-with-text-v3) ; --fin impose la dernière image
#   python3 tools/pixellab.py interpoler <nom> <image de début> <image de fin> "<action>" [--graine N]
#        images intermédiaires entre deux poses dessinées (interpolation-v2)
#   python3 tools/pixellab.py style <nom> "<description>" <image> [<image>...] [--style "<description du style>"] [--graine N]
#        16 propositions dans le style de 1 à 4 images de référence (generate-with-style-v2), pour un nouveau Bidule ou une nouvelle pose
#
# <image> : « perso:balise:n » (n-ième image de la balise dans dist/persos/<perso>/sheet.png) ou un chemin de PNG 64 × 64.
# Sortie : animations/<nom>/pixellab/<date>-<commande>/brut_00.png… et requete.json (paramètres, graine, coût). Ensuite : tools/importer.py.
import base64, datetime, json, os, random, sys, time, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bidules import ROOT, image, png_b64

API = "https://api.pixellab.ai/v2"

def appel(methode, chemin, corps=None):
    jeton = os.environ.get("PIXELLAB_SECRET")
    if not jeton: sys.exit("PIXELLAB_SECRET n'est pas défini : copie mise.local.toml.exemple en mise.local.toml et mets-y ton jeton")
    req = urllib.request.Request(API + chemin, method=methode, data=json.dumps(corps).encode() if corps is not None else None,
                                 headers={"Authorization": f"Bearer {jeton}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.load(r)
    except urllib.error.HTTPError as e: sys.exit(f"PixelLab {chemin} : {e.code} {e.read().decode()[:500]}")

def attendre(rep):
    """suit une tâche de fond jusqu'au bout ; renvoie la tâche terminée"""
    jid = rep.get("background_job_id")
    if not jid: return {"status": "completed", "last_response": rep, "usage": rep.get("usage")}
    t0 = time.time()
    while True:
        time.sleep(5); j = appel("GET", f"/background-jobs/{jid}")
        if j["status"] == "completed": return j
        if j["status"] == "failed": sys.exit(f"PixelLab a échoué : {json.dumps(j.get('last_response'))[:500]}")
        lr = j.get("last_response") or {}
        print(f"  … {int(time.time() - t0)} s" + (f", file d'attente {lr['queue_position']}" if lr.get("queue_position") else ""), flush=True)

def images_de(reponse):
    """les PNG (octets) d'une réponse, qu'ils viennent en base64 ou en adresse"""
    out = []
    for im in (reponse.get("images") or ([reponse["image"]] if reponse.get("image") else [])):
        im = im.get("image", im) if isinstance(im, dict) else im
        if isinstance(im, dict) and im.get("base64"): out.append(base64.b64decode(im["base64"].split(",")[-1]))
        elif isinstance(im, dict) and im.get("url"): out.append(urllib.request.urlopen(im["url"]).read())
        elif isinstance(im, str): out.append(base64.b64decode(im.split(",")[-1]))
    return out

def b64(ref): return {"type": "base64", "base64": png_b64(image(ref)), "format": "png"}

def lancer(nom, commande, chemin, corps, sources):
    print(f"PixelLab {chemin}, graine {corps.get('seed')} (30 s à 3 min)…", flush=True)
    j = attendre(appel("POST", chemin, corps))
    ims = images_de(j["last_response"])
    if not ims: sys.exit(f"pas d'image dans la réponse : {json.dumps(j['last_response'])[:500]}")
    d = f"{ROOT}/animations/{nom}/pixellab/{datetime.datetime.now():%Y%m%d-%H%M%S}-{commande}"; os.makedirs(d)
    for k, b in enumerate(ims): open(f"{d}/brut_{k:02}.png", "wb").write(b)
    sans_images = {k: v for k, v in corps.items() if k not in ("first_frame", "last_frame", "start_image", "end_image", "style_images")}
    json.dump({"commande": commande, "point_d_entree": chemin, "sources": sources, "parametres": sans_images,
               "cout": j.get("usage"), "date": datetime.datetime.now().isoformat(timespec="seconds")}, open(f"{d}/requete.json", "w"), ensure_ascii=False, indent=1)
    print(f"{len(ims)} images dans {os.path.relpath(d, ROOT)}\nensuite : python3 tools/importer.py {os.path.relpath(d, ROOT)}" + ("" if sources.get("debut") and ":" in str(sources["debut"]) else " --perso <perso>"))

def options(args, **defauts):
    o, reste, i = dict(defauts), [], 0
    while i < len(args):
        if args[i].startswith("--"): o[args[i][2:]] = args[i + 1]; i += 2
        else: reste.append(args[i]); i += 1
    return o, reste

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__ or open(__file__).read().split("\nimport")[0])
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "solde": print(json.dumps(appel("GET", "/balance"), ensure_ascii=False, indent=1)); sys.exit()
    o, a = options(args, images="8", graine=str(random.randint(1, 2 ** 31 - 1)))
    graine = int(o["graine"])
    if cmd == "animer" and len(a) == 3:
        nom, src, action = a
        corps = {"first_frame": b64(src), "action": action, "frame_count": int(o["images"]), "seed": graine, "no_background": True}
        if o.get("fin"): corps["last_frame"] = b64(o["fin"])
        lancer(nom, cmd, "/animate-with-text-v3", corps, {"debut": src, "fin": o.get("fin")})
    elif cmd == "interpoler" and len(a) == 4:
        nom, debut, fin, action = a
        kf = lambda r: {"image": b64(r), "size": {"width": 64, "height": 64}}
        lancer(nom, cmd, "/interpolation-v2", {"start_image": kf(debut), "end_image": kf(fin), "action": action,
               "image_size": {"width": 64, "height": 64}, "seed": graine, "no_background": True}, {"debut": debut, "fin": fin})
    elif cmd == "style" and len(a) >= 3:
        nom, description, *refs = a
        if len(refs) > 4: sys.exit("4 images de référence au plus")
        corps = {"style_images": [{"image": b64(r), "width": 64, "height": 64} for r in refs], "description": description, "seed": graine, "no_background": True}
        if o.get("style"): corps["style_description"] = o["style"]
        lancer(nom, cmd, "/generate-with-style-v2", corps, {"references": refs})
    else: sys.exit(open(__file__).read().split("\nimport")[0])
