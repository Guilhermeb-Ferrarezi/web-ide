#!/usr/bin/env bash

set -u

export PATH="/usr/local/bin:/usr/bin:/bin"
export HISTFILE=/dev/null

readonly TERMINAL_ALLOWED_COMMANDS="pwd cd ls eza tree cat less more head tail grep rg find fd stat file du df echo printf clear mkdir rmdir touch cp mv rm sed awk cut sort uniq wc xargs git bun bunx npm npx pnpm yarn"
readonly TERMINAL_ALLOWED_GIT_SUBCOMMANDS="status diff log show branch switch checkout restore add reset commit stash grep blame rev-parse rev-list ls-files"

terminal_extract_base() {
  local raw="$1"
  local base="${raw%%[[:space:]]*}"
  printf '%s' "${base##*/}"
}

terminal_is_allowed() {
  local base
  base="$(terminal_extract_base "$1")"

  if [[ -z "$base" ]]; then
    return 0
  fi

  case " ${TERMINAL_ALLOWED_COMMANDS} " in
    *" ${base} "*) return 0 ;;
    *) return 1 ;;
  esac
}

terminal_extract_git_subcommand() {
  local raw="$1"
  local rest="${raw#git }"
  local token

  read -r -a parts <<< "$rest"

  for ((i = 0; i < ${#parts[@]}; i++)); do
    token="${parts[$i]}"
    case "$token" in
      -c|--git-dir|--work-tree|--namespace|--exec-path|--super-prefix|--config-env)
        ((i++))
        continue
        ;;
      --paginate|--no-pager|--no-replace-objects|--bare)
        continue
        ;;
      -*)
        continue
        ;;
      *)
        printf '%s' "$token"
        return 0
        ;;
    esac
  done

  return 1
}

terminal_git_subcommand_allowed() {
  local subcommand
  subcommand="$(terminal_extract_git_subcommand "$1")" || return 0

  case " ${TERMINAL_ALLOWED_GIT_SUBCOMMANDS} " in
    *" ${subcommand} "*) return 0 ;;
    *) return 1 ;;
  esac
}

terminal_has_forbidden_syntax() {
  [[ "$1" =~ [\;\|\&\<\>\`\$\(\)\{\}] ]]
}

terminal_print_shortcuts() {
  printf '%s\n' \
    'Atalhos do terminal:' \
    '  Seta para cima  último comando' \
    '  Ctrl+Shift+C  copiar seleção' \
    '  Ctrl+Shift+V  colar' \
    '  Ctrl+L        limpar terminal' \
    '  Ctrl+C        interromper processo atual'
}

terminal_prompt() {
  local workspace_root="${TERMINAL_WORKSPACE_ROOT:-$PWD}"
  local current="${PWD#$workspace_root}"
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

terminal_cd_target_allowed() {
  local target="$1"
  local workspace_root
  local resolved_target

  workspace_root="$(cd "${TERMINAL_WORKSPACE_ROOT:-$PWD}" && pwd -P)" || return 1
  resolved_target="$(cd "$target" 2>/dev/null && pwd -P)" || return 1

  [[ "$resolved_target" == "$workspace_root" || "$resolved_target" == "$workspace_root"/* ]]
}

workspace_root="${TERMINAL_WORKSPACE_ROOT:-$PWD}"
if ! cd "$workspace_root" 2>/dev/null; then
  printf '[terminal] workspace root unavailable: %s\n' "$workspace_root"
  cd "${HOME:-$PWD}" 2>/dev/null || exit 1
fi

while true; do
  terminal_prompt

  IFS= read -r line || exit 0

  if [[ -z "${line// }" ]]; then
    continue
  fi

  history -s "$line"

  if terminal_has_forbidden_syntax "$line"; then
    printf '[terminal] blocked syntax: shell composition is disabled\n'
    continue
  fi

  if [[ "$line" == "cd" || "$line" == cd\ * ]]; then
    target="${line#cd }"
    if [[ "$line" == "cd" ]]; then
      target="${TERMINAL_WORKSPACE_ROOT:-$PWD}"
    fi
    if ! terminal_cd_target_allowed "$target"; then
      printf '[terminal] blocked path outside workspace: %s\n' "$target"
      continue
    fi
    cd "$target" 2>/dev/null || printf 'cd: no such file or directory: %s\n' "$target"
    continue
  fi

  if [[ "$line" == "shortcuts" ]]; then
    terminal_print_shortcuts
    continue
  fi

  if ! terminal_is_allowed "$line"; then
    printf '[terminal] blocked command: %s\n' "${line%%[[:space:]]*}"
    continue
  fi

  if [[ "$(terminal_extract_base "$line")" == "git" ]] && ! terminal_git_subcommand_allowed "$line"; then
    printf '[terminal] blocked git subcommand: %s\n' "$(terminal_extract_git_subcommand "$line")"
    continue
  fi

  /bin/bash --noprofile --norc -c "$line"
done
