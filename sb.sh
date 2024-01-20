#!/usr/bin/env bash
set -ue -o pipefail

function main() {
  local opt=''
  if [[ "${1:-}" == "-"* ]]; then
    opt="${1}"
    shift 1
  else
    opt='--exec'
  fi

  local filepath="${1:-}"
  shift 1

  if [[ -z "${filepath}" ]]; then
    echo filepath is empty
    exit 1
  fi

  case "${opt}" in
    -x | --exec) sb_exec "${filepath}" "${@}";;
    -l | --link) sb_link "${filepath}" "${@}";;
  esac

  exit 0
}

function sb_exec() {
  local filepath="${1:-}"

  local shebang_exe="$(head -n 1 "${filepath}" | grep -Po "(?<=^#\!).+" || true)"
  if [[ "${shebang_exe}" == "" ]]; then
    "$(realpath "${filepath}")" "${@:2}"
  else
    ${shebang_exe} "${@}"
  fi
}

function sb_link() {
  local filepath="$(cd "$(dirname "${1:-}")"; pwd)/$(basename "${1:-}")"
  local name="${2:-}"

  if [[ -z "${name}" ]]; then
    echo name is empty
    exit 1
  fi

  local linkpath="/usr/local/bin/${name}"
  if [[ -e "${linkpath}" ]]; then
    echo "${linkpath} is already exists"
    exit 1
  fi

  cat << EOF | sudo tee "${linkpath}" >/dev/null
#!/usr/bin/env bash
sb "${filepath}" "\${@}"
EOF
  sudo chmod 755 "${linkpath}"
}


main "${@}"
