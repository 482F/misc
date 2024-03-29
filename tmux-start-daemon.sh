#!/usr/bin/env bash

set -ue -o pipefail

MODE="${1:-}"
RAW_SESSION_NAME="$(pwd)"
SESSION_NAME="${RAW_SESSION_NAME//./_}"

shift 1 || true

COMMANDS="${@}"


function start() {
    if ! tmux ls 2>&1 | grep -q "${SESSION_NAME}:"; then
        tmux -2 new-session -s "${SESSION_NAME}" -d "${COMMANDS}; read -p 'press Enter...'"
    fi
}

function stop() {
    tmux kill-session -t "${SESSION_NAME}"
}

function reload() {
    stop || true; start
}

function attach() {
    TMUX="" tmux a -t "${SESSION_NAME}"
}

function stach() {
    start && attach
}

if [ "${MODE}" = "start" ]; then
    start
elif [ "${MODE}" = "stop" ]; then
    stop
elif [ "${MODE}" = "reload" ]; then
    reload
elif [ "${MODE}" = "attach" -o "${MODE}" = "" ]; then
    attach
elif [ "${MODE}" = "stach" ]; then
    stach
fi
