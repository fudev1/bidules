---
name: commit
description: Écrire et faire un commit dans le repo Bidules au format Conventional Commits, avec un message en français. À utiliser pour chaque commit sur ce projet, y compris quand on demande de "commiter", "faire un commit" ou "enregistrer les changements".
---

# Commit au format Conventional Commits, en français

## Format

```
<type>(<domaine>): <résumé en français>

- <ce qui change, en français>
- <pourquoi, si ce n'est pas évident>
```

- **Type** (en anglais, c'est la convention) :

  | Type | Quand |
  | --- | --- |
  | `feat` | quelque chose de nouveau, visible pour l'utilisateur |
  | `fix` | une correction de bug |
  | `docs` | README, NOTES.md, spec, commentaires seuls |
  | `refactor` | réorganisation du code sans changement de comportement |
  | `perf` | plus rapide ou plus léger |
  | `style` | mise en forme seule (espaces, ordre), sans changement de comportement |
  | `test` | tests ou page de test |
  | `build` | compilation, dépendances, `mise.toml`, Tauri |
  | `ci` | vérifications automatiques sur GitHub |
  | `chore` | rangement, outillage, configuration (`.claude/`, `.gitignore`...) |

  Une nouvelle animation est un `feat`, une animation corrigée un `fix`.

- **Domaine** (facultatif, en minuscules) : `app`, `limace`, `monstres`, `panneau`, `humeur`, `animations`, `outils`, `readme`, `notes`, `git`. Un seul domaine ; si le commit en touche plusieurs, prendre le principal ou s'en passer.
- **Résumé** : en français, en minuscule après les deux-points, sans point final, 72 caractères au plus. Une phrase courte qui dit ce qui change, lisible par quelqu'un qui ne connaît pas le code : `reptation sans glissade`, `ajoute les commandes gh au README`.
- **Corps** : une liste de puces en français, une idée par puce. Il explique ce qui change et pourquoi, pas comment le code est écrit. On peut s'en passer pour un petit commit.
- **Changement qui casse quelque chose** (rare) : `!` après le type, `feat(app)!: ...`, et une puce qui dit ce qu'il faut faire.

## Étapes

1. Regarder ce qui change : `git status` et `git diff` (et `git diff --cached` si des fichiers sont déjà indexés).
2. Si les changements mélangent plusieurs sujets, faire plusieurs commits, un par sujet.
3. Vérifier la branche : jamais de commit sur `main` ni sur `test`. Si on y est, créer une branche partie de `test` (`git switch -c <sujet>`), voir `.claude/rules/git-flux.md`.
4. Vérifier l'auteur : `git config user.email` doit être l'adresse de la personne qui travaille sur le repo.
5. Écrire le message et commiter avec un fichier temporaire ou `-F -`, pour garder les accents et les retours à la ligne :

   ```bash
   git commit -F - <<'EOF'
   feat(limace): deux chutes, petite et grande

   - petite chute : goutte calme puis atterrissage
   - grande chute (deux tiers de l'écran) : elle a peur et s'écrase
   EOF
   ```

6. Aucune mention de Claude ni d'IA dans le message : pas de "Generated with Claude Code", pas de "Co-Authored-By: Claude" (voir `.claude/rules/pas-de-mention-claude.md`).

## Exemples tirés du projet

- `feat(limace): deux chutes, petite et grande`
- `fix(limace): plus d'image retournée au début du demi-tour`
- `perf(app): animations à 60 images par seconde`
- `docs(readme): règle des branches, les pull requests visent test`
- `chore(outils): chemins relatifs dans gen.py et sim.py`
- `build: Rust installé par mise`
