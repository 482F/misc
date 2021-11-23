#!/usr/bin/env bash

set -ue -o pipefail

TAG="${1}"
TAR_NAME="${2}"
TARGET_DIR="${3}"

CURRENT_DIR="$(pwd)"

cd "${TARGET_DIR}"

tar -cf "${TAR_NAME}" *
gh release create "${TAG}" "${TAR_NAME}"
rm "${TAR_NAME}"
