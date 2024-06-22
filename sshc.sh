#!/usr/bin/env bash
while true; do
  ssh "${@}"
  sleep 1
done
