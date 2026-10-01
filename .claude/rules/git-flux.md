# Flux git : branche, puis test, puis main

```
ma-branche  --PR-->  test  --PR test -> main-->  main
```

- **Jamais de push direct sur `main`**, ni de push forcé. Un garde-fou (`.claude/hooks/bloque-push-main.py`) refuse ces commandes ; ne pas chercher à le contourner.
- **Tout changement part d'une branche créée depuis `test`** :

  ```bash
  git switch test
  git pull
  git switch -c <sujet>
  ```

- **Il arrive par une pull request vers `test`**, la branche par défaut du repo (`gh pr create --fill` la vise d'office).
- **`main` est mise à jour par une pull request de `test` vers `main`**, seulement quand Matteo le demande.
- **Ne jamais merger une pull request sans accord explicite** de la personne qui la demande, même si elle est approuvée.
- Ne pas commiter sur `main` ni sur `test` : si on y est, créer d'abord une branche.
- Si le dossier local est sur la branche de quelqu'un d'autre, ne pas y toucher : travailler dans un `git worktree` à part.
