# La palette fermée s'étend aux teintes proposées

Un Bidule n'utilise que les couleurs de sa fiche (`moodboard/style-bidules.md`), et une nouvelle couleur est une décision prise avec Thibault. L'utilisateur peut maintenant choisir l'apparence de la limace : nous gardons la palette fermée en l'étendant aux teintes qu'on lui propose. Chaque partie (corps, cheveux, pupilles, intérieur de la bouche) a une liste fermée de teintes, chacune avec ses tons déjà choisis (lumière, base, ombre pour le corps), et ces teintes entrent dans la fiche du style une fois validées sur une planche du moodboard. Pas de sélecteur de couleur libre ni de calcul automatique des ombres : une couleur libre donnerait des ombres ratées et un contour qui se perd sur certains fonds, alors qu'une liste fermée se vérifie à l'œil, teinte par teinte. Le contour n'est pas une partie et reste toujours sombre.

## Conséquences

- Ajouter une teinte, c'est ajouter des couleurs à la palette : même décision qu'une nouvelle couleur, avec la planche à l'appui.
- Les teintes de `dist/js/apparence.js` sont provisoires tant que la planche n'est pas validée (#72).
- Les pupilles ont leur propre couleur dans la feuille (`#000001`) pour être reconnues sans toucher au contour.
