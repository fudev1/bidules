# Diagnostic de la connexion entre Claude Code et l'Aseprite ouvert (serveur MCP aseprite-live, port 9123). Ne modifie rien.
#   python3 tools/aseprite_mcp.py
# Le serveur est lancé par Claude Code (session ouverte dans le projet) ; Aseprite s'y connecte avec File > MCP Bridge > Connect.
import os, re, shutil, subprocess, sys

PORT = 9123
HOME = os.path.expanduser("~")
SERVEUR = f"{HOME}/mcp/aseprite-mcp-live/server.mjs"
sh = lambda *a: subprocess.run(a, capture_output=True, text=True).stdout

def main():
    ok = True
    def dit(bon, msg, suite=None):
        nonlocal ok
        print(("  ok  " if bon else "  !!  ") + msg)
        if not bon: ok = False; suite and print("      -> " + suite)
    print("Installation")
    dit(os.path.exists(SERVEUR), "serveur aseprite-live installé (~/mcp/aseprite-mcp-live)", "voir README, « Faire éditer Aseprite par Claude Code » (git clone, npm install)")
    dit(os.path.isdir(f"{HOME}/mcp/aseprite-mcp"), "serveur aseprite installé (~/mcp/aseprite-mcp)", "voir README (git clone)")
    dit(bool(shutil.which("node")), "node est installé", "installer Node 20 ou plus")
    dit(os.path.exists(f"{HOME}/.config/aseprite-mcp/token"), "jeton d'appairage présent", f"cd ~/mcp/aseprite-mcp-live && node server.mjs token, puis le coller dans File > MCP Bridge")
    print("Processus")
    serveurs = [l for l in sh("ps", "-axo", "pid,lstart,command").splitlines() if "aseprite-mcp-live/server.mjs" in l and "grep" not in l]
    for l in serveurs: print("      serveur :", re.sub(r"\s+", " ", l)[:110])
    dit(len(serveurs) >= 1, "un serveur aseprite-live tourne", "ouvrir une session Claude Code dans le projet : c'est elle qui le lance")
    dit(len(serveurs) <= 1, "un seul serveur", "deux serveurs se disputent le port : garder le plus récent, tuer l'autre (kill <pid>)")
    app = sh("pgrep", "-x", "aseprite").split()
    dit(bool(app), "Aseprite est ouvert", "ouvrir Aseprite")
    print(f"Port {PORT}")
    ecoute = [l for l in sh("lsof", "-nP", f"-iTCP:{PORT}").splitlines() if "LISTEN" in l]
    dit(bool(ecoute), f"quelqu'un écoute sur {PORT}", "pas de serveur : voir plus haut")
    liens = [l for l in sh("lsof", "-nP", f"-iTCP:{PORT}").splitlines() if "ESTABLISHED" in l and "aseprite" in l.lower().split()[0]]
    dit(bool(liens), "Aseprite est connecté au serveur", "dans Aseprite : File > MCP Bridge, Disconnect puis Connect")
    print("\n" + ("Tout est en place : demander à Claude de vérifier avec aseprite_status." if ok else "Corriger les lignes « !! » dans l'ordre, puis relancer ce script."))
    return 0 if ok else 1

if __name__ == "__main__": sys.exit(main())
