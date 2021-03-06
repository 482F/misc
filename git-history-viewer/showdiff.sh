#/bin/bash

set -ue -o pipefail

function main(){
    local filepath="${1}"

    if [ ! -f ${filepath} ]; then
        echo "the file \"${filepath}\" is not exist"
        exit 1
    fi

    if ! echo "${filepath}" | grep -qE "^\/"; then
        filepath="./${filepath}"
    fi

    local num="${2}"
    local NoC="$(number_of_commits)"
    local num_a="$((${NoC}-${num}))"
    local num_b=$((num_a+1))
    if [ ${num_a} -lt 0 ] || [ ${NoC} -lt ${num_b} ]; then
        echo "there is no commit number \"${num}\". please set valid number: 1-$((${NoC}))" 1>&2
        exit 1
    fi
    local content_a=$(n-th_content "${filepath}" "${num_a}" "${num}")
    local content_b=$(n-th_content "${filepath}" "${num_b}" "${num}")
    local d=$(diff <(echo ${content_a}) <(echo ${content_b}))
    if [ "${d}" == "" ]; then
        echo "there is no difference"
        echo ""
        n-th_log "${num_a}"
        exit 0
    fi
    local log=$(n-th_log "${num_a}")
    local CNTA="/tmp/showdiff_content_a"
    local CNTB="/tmp/showdiff_content_b"
    local CMTL="/tmp/showdiff_commitlog"
    echo "${content_a}" > "${CNTA}"
    echo "${content_b}" > "${CNTB}"
    echo "${log}" > "${CMTL}"
    vim -c "e /tmp/showdiff_commitlog | tabe | e /tmp/showdiff_content_a | vnew | e /tmp/showdiff_content_b | diffthis | normal " -c "diffthis" -c "set wrap | normal " -c "set wrap"
    rm "${CNTA}" "${CNTB}" "${CMTL}"
}

function n-th_log(){
    local num="${1}"
    git log --skip ${num} -n 1
}

function n-th_content(){
    local filepath="${1}"
    local n="${2}"
    local on="${3}"
    local hash=$(n-th_hash "${n}" "${on}")
    if [ "${hash}" == "" ]; then
        exit 1
    fi
    git show "${hash}":"${filepath}" 2>/dev/null
}

function n-th_hash(){
    local n="${1}"
    local on="${2}"
    local hash=$(git log -1 --format='%h' --skip "${n}")
    echo "${hash}"
}

function number_of_commits(){
    git log --format="%h" | wc -l
}

main "${@}"
