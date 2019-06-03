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

    local -a TIME=()

    for etime in ${@:2}; do
        if ! is_time "${etime}"; then
            echo "invalid format time: ${etime}"
            exit 1
        fi
        TIME+=( $(time_to_sec ${etime}) )
    done
    echo ${TIME[@]}

    for etime in ${TIME[@]}; do
        trim_mp3 "${FILEPATH}" "$(name_outfile ${FILEPATH} ${index})" "${stime}" "${etime}"
        stime="${etime}"
        let index++
    done
    trim_mp3 "${FILEPATH}" "$(name_outfile ${FILEPATH} ${index})" "${stime}" "${DURATION}"
}

function is_time(){
    if echo $1 | grep -qE "^((([0-9]{1,}:)?[0-5][0-9]:)?[0-5][0-9]|[0-9]+)(\.[0-9]+)?$"; then
        return 0
    else
        return 1
    fi
}

function time_to_sec(){
    local TIME="${1}"
    echo "${TIME}" | awk '{ split($1, A, ":"); C = ((A[3] != "") ? (A[1] * 3600 + A[2] * 60 + A[3]) : ((A[2] != "") ? (A[1] * 60 + A[2]) : $1)); print C }'
}

function calc_duration(){
    local DURATION=$(ffmpeg -i ${FILEPATH} 2>&1 | grep "Duration" | cut -d ' ' -f 4 | sed s/,// || true)
    time_to_sec "${DURATION}"
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
