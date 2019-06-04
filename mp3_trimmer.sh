#/bin/bash

set -ue -o pipefail

function main(){
    local FILEPATH="${1}"
    local DURATION=$(calc_duration ${FILEPATH})

    shift 1

    if [ "${DURATION}" == "" ]; then
        echo "target file is not valid mp3 file"
        exit 1
    fi

    if [ -f "${1}" ]; then
        local -a ARGS=()
        local INFOFILE="${1}"

        while read line; do
            ARGS+=( "${line%%,*}" )
            ARGS+=( "${line#*,}" )
        done < "${INFOFILE}"
        main "${FILEPATH}" "${ARGS[@]}"
        exit 0
    fi

    local -a TIME=()
    local -a OUTNAME=("")
    local etime
    local oname


    local index=1
    while [ "${1:-}" != "" ]; do
        if ! is_time "${1}"; then
            echo "invalid time format: ${1}"
            exit 1
        fi
        etime="${1}"
        shift 1

        if ! is_time "${1:-0}"; then
            oname="${1}"
            shift 1
        else
            oname=$(name_outfile "${FILEPATH}" "${index}")
        fi

        TIME+=( $(time_to_sec "${etime}") )
        OUTNAME+=( "${oname}" )
        let index++
    done
    TIME+=( "${DURATION}" )

    etime="${TIME[0]}"
    for ((i = 1; i < ${#TIME[@]}; i++)); do
        stime="${etime}"
        etime="${TIME[${i}]}"
        oname="${OUTNAME[${i}]}"
        trim_mp3 "${FILEPATH}" "${oname}" "${stime}" "${etime}"
    done
}

function is_time(){
    if echo $1 | grep -qE "^((([0-9]{1,}:)?[0-5]?[0-9]:)?[0-5]?[0-9]|[0-9]+)(\.[0-9]+)?$"; then
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

main "$@"
