---
name: aseprite-mcp
description: Mettre en place et vérifier la connexion entre Claude Code et l'Aseprite ouvert (MCP aseprite-live), pour dessiner en direct dans Aseprite. À utiliser quand on veut travailler dans Aseprite avec Claude, quand le MCP est « déconnecté », quand Aseprite n'affiche pas les changements, ou au début d'une séance de dessin.
---

# Travailler dans Aseprite avec le MCP

Deux serveurs existent (`.mcp.json`) : `aseprite` (fichiers `.aseprite` sur le disque, sans ouvrir l'app) et `aseprite-live` (dessine **dans l'Aseprite ouvert**, les changements s'affichent tout de suite). Ce skill règle `aseprite-live`.

## Comment ça marche

```
Claude Code --lance--> serveur node (server.mjs, port 9123) <--se connecte-- Aseprite (extension MCP Bridge)
```

- Le serveur n'existe que pendant une **session Claude Code ouverte dans le projet**. Elle le démarre et l'arrête avec elle.
- Aseprite est le **client** : File > MCP Bridge > Connect. Rien à « connecter » du côté de Claude : les outils `aseprite_*` sont là dès que le serveur tourne.
- Quand la session se ferme, la connexion d'Aseprite tombe (« Unable to connect to 127.0.0.1:9123 »). C'est normal : rouvrir une session, puis recliquer sur Connect.

## 1. Vérifier l'état

`python3 tools/aseprite_mcp.py` : il contrôle l'installation (serveurs dans `~/mcp/`, node, jeton), les processus (un seul serveur, Aseprite ouvert), le port 9123 et la connexion d'Aseprite. Chaque ligne « !! » dit quoi faire. Il ne modifie rien.

Première installation sur un poste : suivre le README, « Faire éditer Aseprite par Claude Code » (clones dans `~/mcp/`, `npm install`, extension `aseprite-mcp-bridge`, jeton dans File > MCP Bridge).

## 2. Réparer, dans cet ordre

1. **Pas de serveur** : ouvrir une session Claude Code dans le projet (le serveur est approuvé dans `.claude/settings.json`).
2. **Deux serveurs** (ils se disputent le port 9123) : garder le plus récent, tuer l'autre avec `kill <pid>`. Demander l'accord avant de tuer un processus.
3. **Aseprite pas connecté** : dans Aseprite, File > MCP Bridge, **Disconnect** puis **Connect** (jeton et port 9123 déjà remplis).
4. Relancer le diagnostic, puis `aseprite_status` : il rend le fichier ouvert, ses calques et ses images.

## 3. Travailler

- Ouvrir le fichier voulu dans Aseprite (ou `aseprite_open`). `aseprite_sprites` liste les onglets ; si Thibault change d'onglet, les outils refusent : rappeler `aseprite_sprites` avec `select`.
- **Dessiner dans le sprite ouvert** (`aseprite_pixel_map`, `aseprite_set_pixels`, `aseprite_read_pixels`), puis `aseprite_save`. Les scripts Python (`tools/*.py` qui écrivent un `.aseprite`) modifient le **disque** : Aseprite ne recharge pas un fichier ouvert (File > Revert), et un Ctrl+S dans Aseprite écraserait le travail du script. Pour recalculer des images avec un script tout en gardant le sprite ouvert : lire une copie (`aseprite_save` avec `copy`), calculer, redessiner avec `aseprite_pixel_map` (voir `tools/attrape_vitesse.py --live`).
- Après l'enregistrement : `mise run publier`, puis relancer l'app (`mise run bidule`) pour voir le résultat.

## Pièges connus

- Le calque actif est celui qui reçoit les pixels : vérifier avec `aseprite_status` quand le sprite a plusieurs calques.
- Le serveur du même nom peut aussi être déclaré dans la config utilisateur de Claude Code : il en lance alors deux. Ne pas y toucher sans l'accord de Thibault.
