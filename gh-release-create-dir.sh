#!/usr/bin/env bash

set -ue -o pipefail

TAG="${1}" # 1.0.0
TAR_NAME="${2}" # project-name.tar
TARGET_DIR="${3}" # ./dist

CURRENT_DIR="$(pwd)"

cd "${TARGET_DIR}"

tar -cf "${TAR_NAME}" *
gh release create "${TAG}" "${TAR_NAME}"
rm "${TAR_NAME}"
