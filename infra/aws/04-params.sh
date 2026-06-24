#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
SRC="${1:?usage: 04-params.sh <env-file>}"
EXCLUDE='^(NEXT_PUBLIC_|SIGLENS_GITHUB_TOKEN)'
n=0
while IFS= read -r line; do
  # Skip blank lines and comments.
  [[ "$line" =~ ^[[:space:]]*# || -z "${line// }" ]] && continue
  # Match KEY = VALUE, tolerating spaces around '='.
  [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]] || continue
  key="${BASH_REMATCH[1]}"
  val="${BASH_REMATCH[2]}"
  [[ "$key" =~ $EXCLUDE ]] && continue
  # Strip surrounding double or single quotes from the value.
  val="${val%\"}" ; val="${val#\"}"
  val="${val%\'}" ; val="${val#\'}"
  aws ssm put-parameter --name "/siglens/$key" --type SecureString --value "$val" --overwrite >/dev/null
  n=$((n+1))
done < "$SRC"
log "loaded $n params into /siglens/*"
