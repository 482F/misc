#!/bin/bash

set -ue -o pipefail
export LC_ALL=C

SCRIPT_DIR=$(cd $(dirname $0); pwd)

main(){
    local NAME_TXT="${SCRIPT_DIR}/name.txt"
    if [ ! -f "${NAME_TXT}" ]; then
        echo "${NAME_TXT} is not found"
        exit 1
    fi
    IFS=$'\n'
    for line in $(cat "${NAME_TXT}"); do
        if echo "${line}" | grep -qE "^#"; then
            continue
        fi
        num="${line%%,*}"
        val1="${line#*,}"
        val2="${val1#*,}"
        val1="${val1%%,*}"
        target=$(ls -1 | grep -E "^${num}")
        ext="${target##*.}"
        if [ ! -f "${target}" ]; then
            continue
        fi
        new_name="${num}_${val1}_${val2}.${ext}"
        if [ "${new_name}" == "${target}" ]; then
            continue
        fi
        mv "${target}" "${new_name}"
    done
}

main
