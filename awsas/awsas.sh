#!/usr/bin/env bash

set -ue -o pipefail

function get_aws_config() {
  local profile="$1"
  shift 1
  local key="$1"

  aws configure get --profile "$profile" "$key"
}

function main() {
  local profile="$1"
  shift 1

  local token_code="$(totp aws)"
  local role_arn="$(get_aws_config $profile role_arn)"
  local mfa_serial="$(get_aws_config $profile mfa_serial)"
  local json="$(aws sts assume-role --role-arn "${role_arn}" --serial-number "${mfa_serial}" --role-session-name ar --token-code "${token_code}")"

  if [[ "$1" == "json" ]]; then
    echo $json
    exit 0
  fi

  export AWS_ACCESS_KEY_ID="$(echo $json | jq -r '.Credentials.AccessKeyId')"
  export AWS_SECRET_ACCESS_KEY="$(echo $json | jq -r '.Credentials.SecretAccessKey')"
  export AWS_SESSION_TOKEN="$(echo $json | jq -r '.Credentials.SessionToken')"

  if [[ "$1" == "cmd" ]]; then
    "$@"
    exit 0
  fi

  if [[ "$1" == "echo" ]]; then
    echo "aws_access_key_id = ${AWS_ACCESS_KEY_ID}"
    echo "aws_secret_access_key = ${AWS_SECRET_ACCESS_KEY}"
    echo "aws_session_token = ${AWS_SESSION_TOKEN}"
    exit 0
  fi

  if [[ "$1" == "export" ]]; then
    echo "
      export AWS_ACCESS_KEY_ID='${AWS_ACCESS_KEY_ID}'
      export AWS_SECRET_ACCESS_KEY='${AWS_SECRET_ACCESS_KEY}'
      export AWS_SESSION_TOKEN='${AWS_SESSION_TOKEN}'
    "
    exit 0
  fi

  aws "$@"
}

main "$@"
