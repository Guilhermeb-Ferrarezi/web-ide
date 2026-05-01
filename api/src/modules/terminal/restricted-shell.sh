#!/usr/bin/env bash

set -u

export PATH="/usr/bin:/bin"
export HISTFILE=/dev/null

readonly TERMINAL_ALLOWED_COMMANDS="pwd cd ls eza tree cat less more head tail grep rg find fd stat file du df echo printf clear mkdir rmdir touch cp mv rm sed awk cut sort uniq wc xargs git bun bunx npm npx pnpm yarn"

terminal_is_allowed() {
  local raw="$1"
  local base="${raw%%[[:space:]]*}"
  base="${base##*/}"

  if [[ -z "$base" ]]; then
    return 0
  fi

  case " ${TERMINAL_ALLOWED_COMMANDS} " in
    *" ${base} "*) return 0 ;;
    *) return 1 ;;
  esac
}

terminal_has_forbidden_syntax() {
  [[ "$1" =~ [\;\|\&\<\>\`\$\(\)\{\}] ]]
}

terminal_prompt() {
  local current="${PWD#$HOME}"
  if [[ "$current" == "$PWD" ]]; then
    printf 'web-ide:%s$ ' "$PWD"
    return
  fi

  if [[ -z "$current" ]]; then
    printf 'web-ide:~$ '
    return
  fi

  printf 'web-ide:~%s$ ' "$current"
}

cd "${HOME:-$PWD}" || exit 1

while true; do
  terminal_prompt

  IFS= read -r line || exit 0

  if [[ -z "${line// }" ]]; then
    continue
  fi

  if terminal_has_forbidden_syntax "$line"; then
    printf '[terminal] blocked syntax: shell composition is disabled\n'
    continue
  fi

  if [[ "$line" == "cd" || "$line" == cd\ * ]]; then
    target="${line#cd }"
    if [[ "$line" == "cd" ]]; then
      target="${HOME:-$PWD}"
    fi
    cd "$target" 2>/dev/null || printf 'cd: no such file or directory: %s\n' "$target"
    continue
  fi

  if ! terminal_is_allowed "$line"; then
    printf '[terminal] blocked command: %s\n' "${line%%[[:space:]]*}"
    continue
  fi

  /bin/bash --noprofile --norc -c "$line"
done
