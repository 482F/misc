remove(){
  local key="${1:-}"
  if [ "${key}" = "" ] ; then
    return 1
  fi
  local removed="$(grep -P "^${key}," "${DOT_ACD}")"
  if [ "${removed}" != "" ]; then
    echo "removed: ${removed}"
  fi
  local new_aliases="$(grep -Pv "^${key}," "${DOT_ACD}" | grep -Pv "^\s*$" | sort)"
  echo "${new_aliases}" > "${DOT_ACD}"
}

add(){
  local key="${1:-}"
  local path="$(readlink -f ${2:-})"
  if [ "${key}" = "" ] || [ "${path}" = "" ]; then
    return 1
  fi
  remove "${key}"
  echo "${key},${path}" >> "${DOT_ACD}"
}

alias-cd(){
  local key="${1:-}"
  local line="$(grep -P "^${key}," "${DOT_ACD}")"
  if [ "${key}" = "" ] || [ "${line}" = "" ]; then
    return 1
  elif [ "$(echo "${line}" | grep -c ".*")" != 1 ]; then
    echo "$(echo "${line}" | nl)"
    read -p "input line number: " number
    local line="$(echo "${line}" | sed -n "${number}p")"
  fi
  cd "${line#*,}"
}

main(){
  local DOT_ACD=~/.acd
  if [ "${1:-}" = "" ]; then
    cat "${DOT_ACD}"
  elif [ "${1:-}" = "-a" ] || [ "${1:-}" = "add" ]; then
    shift
    add "${@}"
  elif [ "${1:-}" = "-d" ] || [ "${1:-}" = "delete" ] || [ "${1:-}" = "remove" ]; then
    shift
    remove "${@}"
  else
    alias-cd "${@}"
  fi
}

main "${@}"
