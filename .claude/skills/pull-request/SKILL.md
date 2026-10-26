---
name: pull-request
description: Écrire le titre et la description d'une pull request du repo Bidules - titre en anglais au format Conventional Commits, description en français, simple et sans jargon. À utiliser pour ouvrir une pull request, mettre à jour sa description après de nouveaux commits, ou réécrire celle d'un collègue ("ouvre une PR", "mets à jour la PR", "réécris la description").
---

# Pull request : titre en anglais, description en français

La description est lue par toute l'équipe, y compris des personnes qui ne lisent pas le code. Elle dit ce que la pull request apporte, avec des mots ordinaires.

## Titre

```
<type>(<domaine>): <summary in English>
```

- Format Conventional Commits, **toujours en anglais** : le type (`feat`, `fix`, `docs`...), le domaine (`limace`, `app`, `panneau`...) et le résumé. Seule la description reste en français.
- Résumé en minuscule, sans point final, 72 caractères au plus : `feat(limace): three moods on every animation`.

## Description

En français, trois parties, dans cet ordre :

```markdown
## Ce que ça apporte

<Une ou deux phrases : ce qui change pour la personne qui utilise le Bidule.>

## Les gros changements

- <un changement par puce, ce qu'on voit ou ce qui se passe>
- ...

## Résultat

- <ce qu'on obtient maintenant>
- <ce qui a été vérifié, et ce qui ne l'a pas été>
- Pour le voir : <une ou deux étapes simples>
```

## Écrire sans jargon

- Décrire ce qu'on **voit** ou ce qui **se passe**, pas comment c'est fait : "elle secoue la tête et des gouttes vertes s'envolent", pas "nouveau calque gouttes généré par un script".
- **Pas** de noms de fichiers, de dossiers, d'outils, de fonctions, de balises ni de numéros d'images. Un nom d'animation se traduit en mots : "la glissade le long des bords", pas `coule`.
- Seulement les gros changements : les petites retouches tiennent en une puce ("retouches du sommeil"), le détail est dans les commits.
- Phrases courtes, une idée par puce. Pas d'images ni de métaphores.
- Quand de nouveaux commits arrivent, **mettre à jour la description** (`gh pr edit <numéro> --body-file -`) au lieu d'ajouter une partie "ajouté depuis".
- Aucune mention de Claude ni d'IA (voir `.claude/rules/pas-de-mention-claude.md`).

## Ouvrir ou modifier

```bash
gh pr create --base test --title "feat(limace): ..." # titre en anglais --body-file - <<'EOF'
## Ce que ça apporte
...
EOF
```

Pour la pull request d'un collègue : `gh pr edit <numéro> --title "..." --body-file -`.

## Exemple

Titre : `feat(limace): three moods (neutral, happy, tired) on every animation`

```markdown
## Ce que ça apporte

La limace a maintenant trois humeurs sur toutes ses animations : neutre, joyeuse et fatiguée. On choisit l'humeur dans le panneau de la barre de menus.

## Les gros changements

- Joyeuse : elle tire la langue et cligne des yeux, de profil comme de face, sur toutes les animations.
- Fatiguée : un visage fatigué retouché à la main, repris partout ; elle garde les yeux fermés quand elle glisse le long d'un bord.
- Malade : des yeux en spirale sur toutes les animations vertes.

## Résultat

- Les trois humeurs se voient sur chaque animation de la limace.
- Vérifié dans la page de test ; pas encore essayé dans l'app.
- Pour le voir : lancer le Bidule, puis changer l'humeur dans le panneau.
```
