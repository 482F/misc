#!/usr/bin/env bash

set -ue -o pipefail

MODE="${1:-}"
SESSION_NAME="$(pwd)"

shift 1 || true

COMMANDS="${@}"


function start() {
    if tmux ls 2>&1 | grep "${SESSION_NAME}:"; then
        attach
    else
        tmux new-session -s "${SESSION_NAME}" -d "${COMMANDS}; read -p 'press Enter...'"
    fi
}

function stop() {
    tmux kill-session -t "${SESSION_NAME}"
}

function attach() {
    TMUX="" tmux a -t "${SESSION_NAME}"
}


if [ "${MODE}" = "start" ]; then
    start
elif [ "${MODE}" = "stop" ]; then
    stop
elif [ "${MODE}" = "attach" -o "${MODE}" = "" ]; then
    attach
elif [ "${MODE}" = "stach" ]; then
    start && attach
fi

