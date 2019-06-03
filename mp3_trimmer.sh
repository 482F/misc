#/bin/bash

set -ue -o pipefail

function main(){
    local FILEPATH="${1}"
    local DURATION=$(calc_duration ${FILEPATH})

    if [ "${DURATION}" == "" ]; then
        echo "target file is not valid mp3 file"
        exit 1
    fi

    local stime="0"
    local index=1

    for etime in ${@:2}; do
        trim_mp3 "${FILEPATH}" "$(name_outfile ${FILEPATH} ${index})" "${stime}" "${etime}"
        stime="${etime}"
        let index++
    done
    trim_mp3 "${FILEPATH}" "$(name_outfile ${FILEPATH} ${index})" "${stime}" "${DURATION}"
}

function time_to_sec(){
    local TIME="${1}"
}

function calc_duration(){
    ffmpeg -i ${FILEPATH} 2>&1 | grep "Duration" | cut -d ' ' -f 4 | sed s/,// | awk '{ split($1, A, ":"); split(A[3], B, "."); print 3600*A[1] + 60*A[2] + A[3]}' || true
}

function name_outfile(){
    local FILEPATH="${1}"
    local INDEX="${2}"
    local FILENAME="${FILEPATH%.*}"
    local FILEEXT="${FILEPATH##*.}"
    echo "${FILENAME}_${INDEX}.${FILEEXT}"
}

function trim_mp3(){
    local TARGETFILEPATH="${1}"
    local OUTPUTFILEPATH="${2}"
    local START_TIME="${3}"
    local END_TIME="${4}"
    local TIME_DIFF=$(echo "scale=2; ${END_TIME} - ${START_TIME}" | bc)
    ffmpeg -i "${TARGETFILEPATH}" -ss "${START_TIME}" -t "${TIME_DIFF}" "${OUTPUTFILEPATH}"
}

main $@
