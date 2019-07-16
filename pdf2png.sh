#!/bin/bash

set -ue -o pipefail

TARGET="${1}"
OUTPUT="${TARGET%.*}.png"

if [ ! -f "${TARGET}" ]; then
    echo "${TARGET} is not found"
    exit 1
fi

convert -density 500 "${TARGET}" -quality 200 -sharpen 0x1.0 "${OUTPUT}"
