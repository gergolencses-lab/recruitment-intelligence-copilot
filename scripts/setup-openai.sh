#!/usr/bin/env bash
# JEL — OpenAI kulcs beállítása és élesben tesztelése.
#
# A kulcsot CSENDES prompton kéri be, nem parancssori argumentumként:
# így nem kerül bele sem a shell-előzménybe (~/.zsh_history), sem a
# folyamatlistába (ps), sem egy megosztott képernyőképbe.
#
# Használat:  bash scripts/setup-openai.sh
set -uo pipefail

REPO_MAIN="/Users/gergolencses/Documents/!Projects and Clients/recruitment-intelligence-copilot"
REPO_WT="$REPO_MAIN/.worktrees/openai-provider"
REPORT="/tmp/jel-openai-smoke.txt"

# A tesztet ott futtatjuk, ahol a szolgáltató-váltó kód van.
if [ -f "$REPO_WT/scripts/smoke-openai.mjs" ]; then
  RUN_DIR="$REPO_WT"
else
  RUN_DIR="$REPO_MAIN"
fi

printf '\n\033[1mJEL — OpenAI beállítás\033[0m\n'
printf 'A kulcs nem jelenik meg gépelés közben, és nem kerül a shell-előzménybe.\n\n'

printf 'OpenAI API kulcs (sk-...): '
IFS= read -rs OPENAI_KEY
printf '\n\n'

if [ -z "${OPENAI_KEY:-}" ]; then
  printf '\033[31mNem adtál meg kulcsot. Kilépek, semmit nem módosítottam.\033[0m\n'
  exit 1
fi
case "$OPENAI_KEY" in
  sk-*) ;;
  *) printf '\033[31mEz nem "sk-" kezdetű. Elgépelted? Kilépek, semmit nem módosítottam.\033[0m\n'; exit 1 ;;
esac

# ── .env frissítése (mindkét munkapéldányban, ha van worktree) ──────────
update_env() {
  local dir="$1"
  local env_file="$dir/.env"
  [ -d "$dir" ] || return 0

  if [ -f "$env_file" ]; then
    cp "$env_file" "$env_file.bak.$(date +%Y%m%d-%H%M%S)"
  elif [ -f "$REPO_MAIN/.env" ] && [ "$env_file" != "$REPO_MAIN/.env" ]; then
    # Hiányzó worktree-.env: a főpéldányból indulunk ki, különben elveszne a
    # FIRECRAWL_API_KEY és a keresés némán szintetikus módba esne vissza.
    cp "$REPO_MAIN/.env" "$env_file"
  else
    touch "$env_file"
  fi

  # A meglévő OPENAI_API_KEY / LLM_PROVIDER sorokat kivesszük, majd újraírjuk.
  # (grep -v helyett awk, hogy az üres fájl se okozzon gondot.)
  awk '!/^[[:space:]]*(OPENAI_API_KEY|LLM_PROVIDER|OPENAI_MODEL)[[:space:]]*=/' \
      "$env_file" > "$env_file.tmp" && mv "$env_file.tmp" "$env_file"

  {
    printf 'LLM_PROVIDER=openai\n'
    printf 'OPENAI_API_KEY=%s\n' "$OPENAI_KEY"
    printf 'OPENAI_MODEL=gpt-5.6-terra\n'
  } >> "$env_file"

  chmod 600 "$env_file"
  printf '  ✅ %s\n' "$env_file"
}

printf '\033[1m.env frissítése:\033[0m\n'
update_env "$REPO_MAIN"
[ "$RUN_DIR" != "$REPO_MAIN" ] && update_env "$REPO_WT"
printf '\n'

# ── Élő füst-teszt ──────────────────────────────────────────────────────
printf '\033[1mÉles teszt indul…\033[0m (ez egy valódi, fizetős hívás, pár forint)\n\n'
cd "$RUN_DIR" || exit 1

# A kimenetet fájlba is tesszük, hogy meg tudd mutatni — kulcs nincs benne.
node scripts/smoke-openai.mjs 2>&1 | tee "$REPORT"
STATUS=${PIPESTATUS[0]}

printf '\n'
if [ "$STATUS" -eq 0 ]; then
  printf '\033[32m════ KÉSZ ════\033[0m\n'
  printf 'A riport itt van: %s\n' "$REPORT"
  printf 'Írd vissza Claude-nak, hogy "kész" — onnan viszi tovább.\n'
else
  printf '\033[31m════ HIBA ════\033[0m\n'
  printf 'A riport itt van: %s\n' "$REPORT"
  printf 'A .env-ről készült biztonsági másolat (.env.bak.*), ha vissza kell állni.\n'
fi
exit "$STATUS"
