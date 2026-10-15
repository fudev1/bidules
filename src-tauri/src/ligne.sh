#!/bin/sh
# Bidules : barre d'état de Claude Code, recopiée dans ~/.bidules/ligne.sh par l'app (main.rs, brancher_hooks). $1 : le profil (claude, claude-masana).
# Claude Code lui envoie l'état de la session ; on n'en garde que les deux limites de l'abonnement (5 h et semaine : pourcentage et heure de remise
# à zéro), dans ~/.bidules/limites.json. Puis on lance la barre d'état qu'on avait avant le Bidule, s'il y en avait une : elle affiche la même chose.
d="$HOME/.bidules"
in=$(cat)
j=$(printf '%s' "$in" | tr -d '\n\r')
bloc() { printf '%s' "$j" | sed -n "s/.*\"$1\" *: *{\([^{}]*\)}.*/\1/p"; }
c=$(bloc five_hour); s=$(bloc seven_day)
if [ -n "$c$s" ]; then
  printf '{"cinq_h":{%s},"semaine":{%s}}' "$c" "$s" > "$d/limites.json.$$" && mv "$d/limites.json.$$" "$d/limites.json"
fi
[ -f "$d/ligne-avant-$1" ] && printf '%s' "$in" | sh -c "$(cat "$d/ligne-avant-$1")"
exit 0
