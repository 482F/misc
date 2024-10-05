#!/usr/bin/env bash

set -ue -o pipefail

function main() {
  local decorators="\e[32m"
  local label=""
  local commands=()
  while [[ -v 1 ]]; do
    case "$1" in
      -d | --decorators)
        shift 1
        decorators="$1"
        ;;
      *)
        if [[ -z "${label}" ]]; then
          label="$1"
        else
          commands+=("$1")
        fi
        ;;
    esac
    shift 1
  done
  PS1="$decorators$label\e[m $(bash -i -c 'echo "$PS1"')" "${commands[@]}"
}

main "$@"
