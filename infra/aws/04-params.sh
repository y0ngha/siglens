#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
SRC="${1:?usage: 04-params.sh <env-file>}"
EXCLUDE='^(NEXT_PUBLIC_|SIGLENS_GITHUB_TOKEN)'
n=0
while IFS='=' read -r key val; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  [[ "$key" =~ $EXCLUDE ]] && continue
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  aws ssm put-parameter --name "/siglens/$key" --type SecureString --value "$val" --overwrite >/dev/null
  n=$((n+1))
done < <(grep -E '^[A-Z]' "$SRC")
log "loaded $n params into /siglens/*"
