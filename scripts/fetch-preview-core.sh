#!/usr/bin/env bash
set -euo pipefail

if (( $# != 2 )) || [[ ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo '::error::Expected a full Preview Core commit SHA and destination' >&2
  exit 1
fi
origin="${XOS_PREVIEW_CORE_TOKEN_ORIGIN:-https://xlate.ai}"
if [[ ! "$origin" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]]; then
  echo '::error::XOS Cloud origin must be an HTTPS origin without a path' >&2
  exit 1
fi
if [[ -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" || -z "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]]; then
  echo '::error::GitHub Actions OIDC is unavailable for the pinned Preview Core fetch' >&2
  exit 1
fi

endpoint="${origin%/}/api/xos/preview-core-token"
curl_options=(--fail --silent --show-error --retry 3 --retry-delay 2
  --retry-max-time 30 --connect-timeout 10 --max-time 30)
oidc_response="$(curl "${curl_options[@]}" --get \
  --header "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
  --data-urlencode "audience=${endpoint}" \
  "$ACTIONS_ID_TOKEN_REQUEST_URL")"
oidc="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["value"])' <<< "$oidc_response")"
unset oidc_response
core_response="$(curl "${curl_options[@]}" --request POST \
  --header "Authorization: Bearer ${oidc}" \
  "$endpoint")"
unset oidc
core_token="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])' <<< "$core_response")"
unset core_response
if [[ -z "$core_token" ]]; then
  echo '::error::Xlate did not issue a Preview Core source token' >&2
  exit 1
fi
echo "::add-mask::${core_token}"

authorization="$(printf 'x-access-token:%s' "$core_token" | base64 | tr -d '\r\n')"
unset core_token
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0='http.https://github.com/xlateai/devlate.git.extraheader'
export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${authorization}"
export GIT_CONFIG_KEY_1='http.https://github.com/xlateai/xos.git.extraheader'
export GIT_CONFIG_VALUE_1="AUTHORIZATION: basic ${authorization}"
export GIT_TERMINAL_PROMPT=0
export CARGO_NET_GIT_FETCH_WITH_CLI=true
revision="$1"
destination="$2"
git clone --quiet --filter=blob:none https://github.com/xlateai/devlate.git "$destination"
git -C "$destination" fetch --quiet origin "$revision"
git -C "$destination" checkout --quiet --detach "$revision"
test "$(git -C "$destination" rev-parse HEAD)" = "$revision"
cargo fetch --locked --manifest-path "$destination/crates/xlate-preview-cli/Cargo.toml"
