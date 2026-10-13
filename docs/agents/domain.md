# Domain Docs

Comment les skills d'ingénierie lisent la documentation du domaine de ce repo avant d'explorer le code.

## Before exploring, read these

- **`GLOSSARY.md`** à la racine du repo : le vocabulaire du projet (Bidule, humeur, animation...).
- **`docs/adr/`** : lire les ADR qui touchent la partie sur laquelle on va travailler.

Si ces fichiers n'existent pas, **continuer sans rien dire**. Ne pas signaler leur absence, ne pas proposer de les créer d'avance. Le skill `/domain-modeling` (appelé par `/grill-with-docs` et `/improve-codebase-architecture`) les crée au fur et à mesure, quand un terme ou une décision est vraiment tranché.

`NOTES.md` reste l'endroit de l'état du projet et des décisions courantes ; un ADR est réservé aux décisions difficiles à défaire.

## File structure

Repo à un seul contexte :

```
/
├── GLOSSARY.md
├── NOTES.md
├── docs/adr/
│   ├── 0001-<décision>.md
│   └── 0002-<décision>.md
├── dist/
└── src-tauri/
```

## Use the glossary's vocabulary

Quand ce qu'on écrit nomme un concept du domaine (titre d'issue, proposition de refonte, hypothèse, nom de test), utiliser le terme tel qu'il est défini dans `GLOSSARY.md`. Ne pas glisser vers des synonymes que le glossaire écarte.

Si le concept n'est pas encore dans le glossaire, c'est un signal : soit on invente un mot que le projet n'utilise pas (à revoir), soit il manque vraiment (à noter pour `/domain-modeling`).

## Flag ADR conflicts

Si ce qu'on écrit contredit un ADR existant, le dire clairement au lieu de passer outre :

> _Contredit l'ADR-0007 (...), mais mérite d'être rouvert parce que…_
