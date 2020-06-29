#!/bin/bash

set -fue -o pipefail
export LC_ALL=C

VALUE="${1}"
DIFF=$((${VALUE}-89))
ind=1
echo

shift 1
function expand-files(){
    for file in "${@}"; do
        if [ -d "${file}" ]; then
            find "${file}" | grep -E *\.mp3$
        elif [ -f "${file}" ]; then
            echo "${file}"
        else
            echo "\"${file}\" is not found"
            exit 1
        fi
    done
}
function aacgain-func(){
    echo -e "\e[1F${ind}/${NoF}"
    ind=$((ind+1))
    res="$(aacgain -r -c -p -d "${1}" "${2}" || true)"
    if ! echo "${res}" | grep -Eq "No changes to"; then
        echo -e "${res}\n"
    fi
}

EXPANDED_FILES="$(expand-files "${@}")"
NoF="$(echo "${EXPANDED_FILES}" | wc -l)"

echo "${EXPANDED_FILES}" | while read file; do
    aacgain-func "${DIFF}" "${file}"
done
echo
