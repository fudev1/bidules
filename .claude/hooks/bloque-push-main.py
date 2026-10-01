#!/usr/bin/env python3
# Garde-fou pour Claude Code : refuse un push vers main et tout push forcé.
# Le flux du projet : branche -> pull request vers test -> pull request test -> main (voir .claude/rules/git-flux.md).
import json, re, shlex, subprocess, sys

data = json.load(sys.stdin)
cmd = (data.get("tool_input") or {}).get("command") or ""
cwd = data.get("cwd") or None


def deny(reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}}))
    sys.exit(0)


def current_branch():
    r = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd, capture_output=True, text=True)
    return r.stdout.strip()


for part in re.split(r"&&|\|\||;|\||\n", cmd):
    try:
        words = shlex.split(part)
    except ValueError:
        words = part.split()
    if "git" not in words:
        continue
    rest = words[words.index("git") + 1:]
    # options de git placées avant la sous-commande (-C dossier, -c clé=valeur...)
    j = 0
    while j < len(rest) and rest[j].startswith("-"):
        j += 2 if rest[j] in ("-C", "-c") else 1
    if j >= len(rest) or rest[j] != "push":
        continue
    args = rest[j + 1:]
    opts = [a for a in args if a.startswith("-")]
    refs = [a for a in args if not a.startswith("-")]
    if any(o in ("-f", "--force", "--force-with-lease", "--force-if-includes") or o.startswith("--force-with-lease=") for o in opts) or any(r.startswith("+") for r in refs):
        deny("Push forcé interdit sur ce projet.")
    if any(o in ("--all", "--mirror") for o in opts):
        deny("Push de toutes les branches interdit : il pousserait aussi main.")
    targets = refs[1:]  # le premier est le dépôt distant (origin)
    branch = current_branch()
    for t in targets:
        dest = t.split(":")[-1]
        if dest in ("HEAD", "@"):
            dest = branch
        if dest == "main" or dest.endswith("/main"):
            deny("Pas de push direct sur main : passe par une branche et une pull request vers test.")
    if not targets and branch == "main":
        deny("Tu es sur main : pas de push direct sur main, passe par une branche et une pull request vers test.")

sys.exit(0)
