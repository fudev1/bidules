#!/bin/sh
# Bidules : hook de Claude Code, recopié dans ~/.bidules/hook.sh par l'app (main.rs, brancher_hooks).
# Note l'état de la session ($1 : travaille, attend, fini, ou fin quand elle se ferme) dans ~/.bidules/sessions/<id de la session>.
# Ne lit que l'identifiant de la session dans ce que Claude Code envoie ; ni le texte des messages, ni rien d'autre n'est gardé.
d="$HOME/.bidules/sessions"
id=$(sed -n 's/.*"session_id" *: *"\([A-Za-z0-9_-]*\)".*/\1/p' | head -n 1)
[ -n "$id" ] || exit 0
mkdir -p "$d"
if [ "$1" = fin ]; then rm -f "$d/$id"; else printf '%s' "$1" > "$d/$id"; fi
[ "$1" = fini ] && touch "$HOME/.bidules/claude-fini"
exit 0
