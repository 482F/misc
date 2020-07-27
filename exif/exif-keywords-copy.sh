#!/bin/bash
#required https://github.com/exiftool/exiftool
#
#Usage:
#./exif_keywords_copy.sh CSV.csv
#
#cat CSV.csv
#src1.jpg,dst1.jpg
#src2.jpg,dst2.jpg
#
#copy exif tag "Keywords" ("tag" in explorer property) srcn.jpg to dstn.jpg

set -ue -o pipefail

CSV="${1}"
CSV_DIR="$(dirname "${CSV}")"

cd "${CSV_DIR}"

function copy_exif(){
    local src="${1}"
    local dst="${2}"
    exiftool -tagsFromFile "${src}" -Keywords -XPKeywords -Subject -LastKeywordXMP "${dst}"
}

while read line; do
    SRC="$(echo ${line} | cut -d , -f 1 | sed -e "s@[\r\n]@@g")"
    DST="$(echo ${line} | cut -d , -f 2 | sed -e "s@[\r\n]@@g")"
    copy_exif "${SRC}" "${DST}"
done < "${CSV}"
