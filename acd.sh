# gitbash や wsl 等 bash 環境で動くスクリプト
# ~/.bashrc で
# alias acd="source /usr/local/bin/acd.sh"
# 等 source で呼び出す必要あり
#
# usage:
# acd -a alias path
#   path を alias で登録する
#   既に alias が存在する場合は上書きされる
# acd alias
#   alias に紐づいているパスに cd する
# acd -d alias
#   alias の登録を削除する

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
  local path="$(readlink -f ${2:-.})"
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
