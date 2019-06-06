#/bin/bash

set -ue -o pipefail

function main(){
    FILEPATH="${1}"
    DURATION=$(ffmpeg -i ${FILEPATH} 2>&1 | grep "Duration" | cut -d ' ' -f 4 | sed s/,// | awk '{ split($1, A, ":"); split(A[3], B, "."); print 3600*A[1] + 60*A[2] + A[3]}' || true)

    if [ "${DURATION}" == "" ]; then
        echo "target file is not valid mp3 file"
        exit 1
    fi

    stime="0"
    index=1

    for etime in ${@:2}; do
        trim_mp3 "${FILEPATH}" "$(name_outfile ${FILEPATH} ${index})" "${stime}" "${etime}"
        stime="${etime}"
        let index++
    done
    trim_mp3 "${FILEPATH}" "$(name_outfile ${FILEPATH} ${index})" "${stime}" "${DURATION}"
}

function name_outfile(){
    FILEPATH="${1}"
    INDEX="${2}"
    FILENAME="${FILEPATH%.*}"
    FILEEXT="${FILEPATH##*.}"
    echo "${FILENAME}_${INDEX}.${FILEEXT}"
}

function trim_mp3(){
    TARGETFILEPATH="${1}"
    OUTPUTFILEPATH="${2}"
    START_TIME="${3}"
    END_TIME="${4}"
    TIME_DIFF=$(echo "scale=2; ${END_TIME} - ${START_TIME}" | bc)
    ffmpeg -i "${TARGETFILEPATH}" -ss "${START_TIME}" -t "${TIME_DIFF}" "${OUTPUTFILEPATH}"
}

main $@
