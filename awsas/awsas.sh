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


  export AWS_ACCESS_KEY_ID="$(echo $json | jq -r '.Credentials.AccessKeyId')"
  export AWS_SECRET_ACCESS_KEY="$(echo $json | jq -r '.Credentials.SecretAccessKey')"
  export AWS_SESSION_TOKEN="$(echo $json | jq -r '.Credentials.SessionToken')"

  aws "$@"
}

main "$@"
