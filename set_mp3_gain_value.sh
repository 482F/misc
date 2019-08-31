#!/bin/bash

set -fue -o pipefail
export LC_ALL=C

VALUE="${1}"
DIFF=$((${VALUE}-89))

shift 1

for file in "${@}"; do
    aacgain -r -c -p -d "${DIFF}" "${file}"
done
