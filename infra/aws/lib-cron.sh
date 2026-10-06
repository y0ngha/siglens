#!/usr/bin/env bash
#
# infra/aws/lib-cron.sh — EventBridge cron 공용 Connection/API Destination 헬퍼
#
# 13-seo-prewarm.sh와 14-kr-tickers-cron.sh가 source한다(lib.sh를 먼저 source할 것).
#
# 왜 Connection을 하나로 합쳤나(2026-10 인프라 정리):
#   EventBridge Connection은 하나당 Secrets Manager 관리형 시크릿을 하나씩 만든다
#   (`events!connection/<name>/...`, 월 $0.40). 예전엔 두 cron이 각자
#   `siglens-seo-prewarm`, `siglens-kr-tickers` Connection을 만들었지만 둘의 인증은
#   **완전히 같다** — API_KEY 방식으로 `Authorization: Bearer <CRON_SECRET>`를 주입하고,
#   CRON_SECRET은 SSM `/siglens/CRON_SECRET` 하나다. Connection은 엔드포인트를 모르고
#   (엔드포인트는 API Destination 소관) 헤더만 들고 있으므로, 같은 헤더라면 공유해도
#   권한 범위가 넓어지지 않는다. 그래서 `siglens-cron` 하나를 두 API Destination이 함께 쓴다.
#
#   ⚠️ 어느 cron이 **다른** 비밀/헤더를 쓰게 되면 그 cron만 별도 Connection으로 다시
#   분리할 것. 공유 Connection의 자격증명을 바꾸면 두 cron이 동시에 바뀐다.
#
# 이관: 예전 Connection은 ensure_api_destination이 공유 Connection으로 갈아 끼운 **뒤에**
#   delete_legacy_connection이 지운다(각 스크립트가 자기 옛 Connection만). 두 스크립트를
#   한 번씩 다시 돌리면 시크릿 2개 → 1개가 된다.

CRON_CONNECTION_NAME="${CRON_CONNECTION_NAME:-siglens-cron}"

# ensure_cron_connection이 공유 Connection의 AUTHORIZED를 확인했는지. false인 동안
# ensure_api_destination은 **기존** Destination을 갈아 끼우지 않고(새 Destination 생성만 허용),
# delete_legacy_connection은 아무것도 지우지 않는다 — 인증 안 된 Connection으로 옮긴 뒤 아직
# 동작하는 옛 Connection까지 지우면 두 cron이 함께 죽는다.
CRON_CONNECTION_AUTHORIZED=false

CRON_RERUN_HINT="공유 Connection이 AUTHORIZED가 된 뒤(aws events describe-connection --name siglens-cron --query ConnectionState) bash infra/aws/13-seo-prewarm.sh 와 bash infra/aws/14-kr-tickers-cron.sh 를 다시 돌려 이관을 마칠 것"

# ensure_cron_connection <region> <cron-secret>
#   공유 Connection을 만들거나(없을 때) 자격증명을 갱신하고, AUTHORIZED까지 짧게 폴링한다.
#   결과 ARN을 전역 CONNECTION_ARN에, 확인 결과를 전역 CRON_CONNECTION_AUTHORIZED에 둔다.
#   AUTHORIZED에 못 미쳐도 실패로 끝내지 않는다(스크립트의 나머지 리소스는 여전히 유효하다)
#   — 대신 플래그가 이관 단계를 막는다.
ensure_cron_connection() {
  CRON_CONNECTION_AUTHORIZED=false
  local region="$1" secret="$2"
  local auth="ApiKeyAuthParameters={ApiKeyName=Authorization,ApiKeyValue=Bearer ${secret}}"
  if aws events describe-connection --name "$CRON_CONNECTION_NAME" --region "$region" >/dev/null 2>&1; then
    aws events update-connection --name "$CRON_CONNECTION_NAME" --authorization-type API_KEY \
      --auth-parameters "$auth" --region "$region" >/dev/null
    log "connection $CRON_CONNECTION_NAME updated (secret refreshed)"
  else
    aws events create-connection --name "$CRON_CONNECTION_NAME" --authorization-type API_KEY \
      --description "siglens EventBridge crons (Authorization: Bearer CRON_SECRET) — shared by 13/14" \
      --auth-parameters "$auth" --region "$region" >/dev/null
    log "connection $CRON_CONNECTION_NAME created"
  fi
  CONNECTION_ARN="$(aws events describe-connection --name "$CRON_CONNECTION_NAME" \
    --query ConnectionArn --output text --region "$region")"

  # Connection은 비동기로 AUTHORIZED에 도달한다(관리형 시크릿 생성 포함). 그 전에
  # 스케줄이 돌면 초기 호출이 조용히 인증 실패한다 — 짧게 폴링해 확인한다.
  local attempts=12 interval=5 state="UNKNOWN" i
  for ((i = 1; i <= attempts; i++)); do
    state="$(aws events describe-connection --name "$CRON_CONNECTION_NAME" \
      --query ConnectionState --output text --region "$region" 2>/dev/null || echo "UNKNOWN")"
    if [ "$state" = "AUTHORIZED" ]; then
      log "connection $CRON_CONNECTION_NAME is AUTHORIZED (attempt $i/$attempts)"
      CRON_CONNECTION_AUTHORIZED=true
      return 0
    fi
    log "connection $CRON_CONNECTION_NAME state=$state, waiting... (attempt $i/$attempts)"
    sleep "$interval"
  done
  log "WARNING: connection $CRON_CONNECTION_NAME did not reach AUTHORIZED within $((attempts * interval))s (state=$state)"
  log "WARNING: 기존 API Destination 이관과 옛 Connection 삭제를 건너뛴다 — $CRON_RERUN_HINT"
}

# ensure_api_destination <region> <name> <endpoint> <connection-arn>
#   API Destination을 만들거나, 이미 있으면 Connection을 공유 Connection으로 갈아 끼운다
#   (옛 전용 Connection에서 이관하는 경로). 결과 ARN을 전역 DEST_ARN에 둔다.
#   공유 Connection이 AUTHORIZED가 아니면(CRON_CONNECTION_AUTHORIZED=false) 기존
#   Destination은 지금 Connection(동작 중인 옛 것)에 그대로 둔다.
ensure_api_destination() {
  local region="$1" name="$2" endpoint="$3" conn_arn="$4" current
  if ! aws events describe-api-destination --name "$name" --region "$region" >/dev/null 2>&1; then
    aws events create-api-destination --name "$name" \
      --connection-arn "$conn_arn" \
      --invocation-endpoint "$endpoint" \
      --http-method PATCH \
      --invocation-rate-limit-per-second 1 \
      --region "$region" >/dev/null
    log "api destination $name created"
  else
    current="$(aws events describe-api-destination --name "$name" \
      --query ConnectionArn --output text --region "$region")"
    if [ "$current" != "$conn_arn" ] && [ "$CRON_CONNECTION_AUTHORIZED" != true ]; then
      log "WARNING: api destination $name left on $current (shared connection not AUTHORIZED) — $CRON_RERUN_HINT"
    elif [ "$current" != "$conn_arn" ]; then
      aws events update-api-destination --name "$name" \
        --connection-arn "$conn_arn" \
        --invocation-endpoint "$endpoint" \
        --http-method PATCH \
        --invocation-rate-limit-per-second 1 \
        --region "$region" >/dev/null
      log "api destination $name repointed: $current -> $conn_arn"
    else
      log "api destination $name exists (connection $CRON_CONNECTION_NAME)"
    fi
  fi
  DEST_ARN="$(aws events describe-api-destination --name "$name" \
    --query ApiDestinationArn --output text --region "$region")"
}

# delete_legacy_connection <region> <legacy-name>
#   공유 이전의 전용 Connection(과 그 관리형 시크릿)을 지운다. 아직 그것을 가리키는
#   API Destination이 있으면 지우지 않는다 — 지우면 그 cron이 인증 없이 호출된다.
delete_legacy_connection() {
  local region="$1" legacy="$2" legacy_arn users
  [ "$legacy" != "$CRON_CONNECTION_NAME" ] || return 0
  if [ "$CRON_CONNECTION_AUTHORIZED" != true ]; then
    log "WARNING: legacy connection $legacy kept (shared connection not AUTHORIZED) — $CRON_RERUN_HINT"
    return 0
  fi
  legacy_arn="$(aws events describe-connection --name "$legacy" \
    --query ConnectionArn --output text --region "$region" 2>/dev/null)" || return 0
  [ -n "$legacy_arn" ] && [ "$legacy_arn" != "None" ] || return 0
  users="$(aws events list-api-destinations --connection-arn "$legacy_arn" \
    --query 'ApiDestinations[].Name' --output text --region "$region")"
  if [ -n "$users" ] && [ "$users" != "None" ]; then
    log "WARNING: legacy connection $legacy still used by api destination(s): $users — not deleting (re-run the owning script)"
    return 0
  fi
  aws events delete-connection --name "$legacy" --region "$region" >/dev/null
  log "legacy connection $legacy deleted (its managed Secrets Manager secret goes with it)"
}
