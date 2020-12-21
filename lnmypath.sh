#!/usr/bin/env bash

set -ue -o pipefail

main(){
    TARGET="${1:-}"
    if [ "${TARGET}" = "" ]; then
        help
        exit 1
    fi

    TARGET_NAME="${2:-}"

    if [ "${TARGET_NAME}" = "" ]; then
        TARGET_NAME="$(basename "${TARGET}")"
    fi

    ABS_TARGET_PATH="$(cd "$(dirname "${TARGET}")"; pwd)/$(basename "${TARGET}")"

    sudo ln -s "${ABS_TARGET_PATH}" "/usr/local/bin/${TARGET_NAME}"
}

help(){
    echo "lnmypath TARGET_PATH (TARGET_NAME)"
}

main "${@}"
