#!/usr/bin/env bash
set -ue -o pipefail

function main() {
  local filepath="${1:-}"

  if [[ "${filepath}" == "" ]]; then
    exit 1
  fi

  local shebang="$()"

  local shebang_exe="$(head -n 1 "${filepath}" | grep -Po "(?<=^#\!).+" || true)"
  if [[ "${shebang_exe}" == "" ]]; then
    "$(realpath "${filepath}")" "${@:2}"
  else
    ${shebang_exe} "${@}"
  fi

  exit 0
}

main "${@}"
