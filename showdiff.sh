#/bin/bash

set -ue -o pipefail

function main(){
    local filepath="${1}"
    local num_a="${2}"
    local num_b=$((num_a+1))
    local content_a=$(n-th_content "${filepath}" "${num_a}")
    local content_b=$(n-th_content "${filepath}" "${num_b}")
    echo "${content_a}" > /tmp/showdiff_content_a
    echo "${content_b}" > /tmp/showdiff_content_b
    vim -c "r! git log --skip ${num_a} -n 1" -c "w! /tmp/showdiff_commitlog | tabe | e /tmp/showdiff_content_a | vnew | e /tmp/showdiff_content_b | diffthis | normal " -c "diffthis" -c "set wrap | normal " -c "set wrap"
}

function n-th_content(){
    local filepath="${1}"
    local n="${2}"
    git show $(n-th_hash "${n}"):"${filepath}"
}

function n-th_hash(){
    local n="${1}"
    git log -1 --format='%h' --skip "${n}"
}

main "${@}"
