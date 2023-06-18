#!/usr/bin/env bash
set -ue -o pipefail

main() {
  local cargs=()
  local isWin=false
  for arg in "${@}"; do
    if echo "${arg}" | grep -Pq "^-"; then
      cargs+=("${arg}")
      continue
    fi

    local dir="$(readlink -f "${arg}" 2>/dev/null || exit 0; pwd)"
    if [ "${dir}" = "" ]; then
      cargs+=("${arg}")
      continue
    fi

    if echo "${dir}" | grep -Pq "^\/mnt\/\w"; then
      local winpath="$(wslpath -w "${arg}")"
      cargs+=("${winpath}")
      isWin=true
    else
      cargs+=("${arg}")
    fi
  done

  if [ "${isWin}" = "true" ]; then
    powershell.exe code "${cargs[@]}" >/dev/null 2>&1
  else
    code "${cargs[@]}"
  fi
}

main "${@}"