# Issue tracker : GitHub

Les tickets et les specs de ce repo sont des issues GitHub de `fudev1/bidules`. Toutes les opérations passent par la commande `gh`. Titres et contenus en français.

## Conventions

- **Créer une issue** : `gh issue create --title "..." --body "..."`. Utiliser un heredoc pour un contenu sur plusieurs lignes.
- **Lire une issue** : `gh issue view <numéro> --json number,title,body,labels,comments`.
- **Lister les issues** : `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, avec les filtres `--label` et `--state` qui conviennent.
- **Rattacher une issue à une issue parente** : `gh issue create --parent <parente> ...`, ou `gh issue edit <parente> --add-sub-issue <enfant>` après coup (`gh` 2.94 ou plus). Avec un `gh` plus ancien : `gh api --method POST repos/<owner>/<repo>/issues/<parente>/sub_issues -F sub_issue_id=<id-base-enfant>` (id de base de données, comme dans **Blocage** plus bas). Sans sous-issues, mettre `Part of #<parente>` en tête du contenu de l'enfant.
- **Commenter** : `gh issue comment <numéro> --body "..."`
- **Ajouter / retirer une étiquette** : `gh issue edit <numéro> --add-label "..."` / `--remove-label "..."`
- **Fermer** : `gh issue close <numéro> --comment "..."`

Le repo se déduit de `git remote -v` ; `gh` le fait tout seul dans un clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Passer à `yes` si les pull requests externes doivent être traitées comme des demandes ; `/triage` lit ce réglage.)_

Avec `yes`, les pull requests passent par les mêmes étiquettes et les mêmes états que les issues, avec les équivalents `gh pr` :

- **Lire une PR** : `gh pr view <numéro> --comments`, et `gh pr diff <numéro>` pour le diff.
- **Lister les PR externes à trier** : `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Commenter / étiqueter / fermer** : `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub partage la même suite de numéros entre issues et PR : un `#42` seul peut être l'une ou l'autre. Essayer `gh pr view 42`, puis `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Créer une issue GitHub.

## When a skill says "fetch the relevant ticket"

La lire comme dans **Lire une issue** plus haut.

## Wayfinding operations

Utilisé par `/wayfinder`. La **carte** est une seule issue, et les tickets sont ses issues **enfants**.

- **Carte** : une issue avec l'étiquette `wayfinder:map`, dont le contenu tient les parties Notes / Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Ticket enfant** : une issue rattachée à la carte comme sous-issue (voir **Rattacher une issue à une issue parente**). Sans sous-issues, ajouter l'enfant à une liste de tâches dans la carte et mettre `Part of #<carte>` en tête de l'enfant. Étiquettes : `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Une fois pris, le ticket est assigné à la personne qui le mène.
- **Blocage** : les **dépendances d'issues natives** de GitHub, visibles dans l'interface. Ajouter un lien avec `gh api --method POST repos/<owner>/<repo>/issues/<enfant>/dependencies/blocked_by -F issue_id=<id-base-bloquant>`, où `<id-base-bloquant>` est l'**id de base de données** du ticket bloquant (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _pas_ le `#numéro` ni le `node_id`). GitHub donne `issue_dependencies_summary.blocked_by` (seulement les bloquants encore ouverts). Sans dépendances, mettre une ligne `Blocked by: #<n>, #<n>` en tête de l'enfant. Un ticket est débloqué quand tous ses bloquants sont fermés.
- **Frontière** : lister les enfants ouverts de la carte (`gh issue list --state open`, limité aux sous-issues ou à la liste de tâches de la carte), écarter ceux qui ont un bloquant ouvert (`issue_dependencies_summary.blocked_by > 0`, ou une issue ouverte dans la ligne `Blocked by`) ou une personne assignée ; le premier dans l'ordre de la carte l'emporte.
- **Prendre un ticket** : `gh issue edit <n> --add-assignee @me`, première écriture de la session.
- **Résoudre** : `gh issue comment <n> --body "<réponse>"`, puis `gh issue close <n>`, puis ajouter un renvoi (l'essentiel + le lien) dans la partie Decisions-so-far de la carte.
