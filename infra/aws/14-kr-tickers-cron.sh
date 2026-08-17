#!/usr/bin/env bash
#
# infra/aws/14-kr-tickers-cron.sh — 한국 종목 마스터 일 1회 동기화 스케줄 (멱등)
#
# `PATCH /api/cron/kr-tickers`를 EventBridge classic Rule → API Destination으로
# 하루 한 번 호출한다. 13-seo-prewarm.sh와 같은 배선이지만 **의도적으로 훨씬 작다**:
# 그쪽은 5분 간격 10분짜리 LLM 배치라 Redis 루트 락·wall-clock 데드라인·알람 8종이
# 필요했고, 이쪽은 하루 한 번 도는 10초짜리 멱등 작업이다. 겹쳐 돌아도 upsert와
# 상폐 표시가 모두 멱등이라 락이 막아 줄 것이 없다.
#
# 스케줄: 05:00 UTC = 14:00 KST. 공공데이터포털 KRX상장종목정보는 기준일 다음
# 영업일 13시 이후에 갱신되므로, 그보다 한 시간 뒤에 읽는다. Rule이 하나뿐인 것도
# 13-seo-prewarm.sh와 다른 점이다 — 그쪽이 3개로 쪼개진 건 UTC 창이 자정을 가로질렀기
# 때문이고, 하루 한 틱은 그 제약을 받지 않는다.
#
# ⚠️ 이 스크립트는 수동 실행이다. deploy 파이프라인 어디서도 자동 호출하지 않는다.
#    생성 직후 수동 invoke로 202가 실제로 오는지 확인할 것(docs/reference/CRON.md).
#
# 사용법:
#     bash infra/aws/14-kr-tickers-cron.sh
#
# 전제: --profile siglens (또는 AWS_PROFILE)로 events:*, iam:CreateRole/GetRole/
#       PutRolePolicy, logs:PutMetricFilter, cloudwatch:PutMetricAlarm, sns:CreateTopic,
#       secretsmanager:* 권한. CRON_SECRET은 04-params.sh가 SSM에 게시했어야 하고,
#       DATA_GO_KR_SERVICE_KEY도 SSM에 있어야 한다(없으면 라우트가 sync failed를 남긴다).
#
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/.env"

REGION="${AWS_REGION:-ap-northeast-2}"

ROLE_NAME=siglens-kr-tickers-eventbridge
CONNECTION_NAME=siglens-kr-tickers
DESTINATION_NAME=siglens-kr-tickers
RULE_NAME=siglens-kr-tickers-daily
ENDPOINT="https://siglens.io/api/cron/kr-tickers"
LOG_GROUP=/siglens/app

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

### 1) CRON_SECRET — 04-params.sh가 이미 게시한 값을 읽기만 한다 ###
CRON_SECRET="$(aws ssm get-parameter --name /siglens/CRON_SECRET --with-decryption \
  --query 'Parameter.Value' --output text --region "$REGION")"
[ -n "$CRON_SECRET" ] || { log "ERROR: /siglens/CRON_SECRET is empty — run 04-params.sh first"; exit 1; }

### 2) IAM 역할 ###
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  log "role $ROLE_NAME exists"
else
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document '{
       "Version":"2012-10-17",
       "Statement":[{"Effect":"Allow","Principal":{"Service":"events.amazonaws.com"},"Action":"sts:AssumeRole"}]
     }' >/dev/null
  log "role $ROLE_NAME created"
fi
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name siglens-kr-tickers-invoke \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{\"Effect\":\"Allow\",
      \"Action\":\"events:InvokeApiDestination\",
      \"Resource\":\"arn:aws:events:$REGION:$ACCOUNT_ID:api-destination/$DESTINATION_NAME/*\"}]
  }"
ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
log "role $ROLE_NAME ready ($ROLE_ARN)"

### 3) Connection — Authorization: Bearer <CRON_SECRET> 주입 ###
if aws events describe-connection --name "$CONNECTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws events update-connection --name "$CONNECTION_NAME" --authorization-type API_KEY \
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=Authorization,ApiKeyValue=Bearer ${CRON_SECRET}}" \
    --region "$REGION" >/dev/null
  log "connection $CONNECTION_NAME updated (secret refreshed)"
else
  aws events create-connection --name "$CONNECTION_NAME" --authorization-type API_KEY \
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=Authorization,ApiKeyValue=Bearer ${CRON_SECRET}}" \
    --region "$REGION" >/dev/null
  log "connection $CONNECTION_NAME created"
fi
CONNECTION_ARN="$(aws events describe-connection --name "$CONNECTION_NAME" \
  --query ConnectionArn --output text --region "$REGION")"

# Connection은 비동기로 AUTHORIZED에 도달한다(관리형 시크릿 생성 포함). 그 전에
# 스케줄이 돌면 초기 호출이 조용히 인증 실패한다 — 짧게 폴링해 눈으로 확인하고,
# 도달하지 못해도 스크립트는 죽이지 않는다(나머지 리소스는 여전히 유용하다).
CONN_POLL_ATTEMPTS=12
CONN_POLL_INTERVAL_SECONDS=5
conn_authorized=false
for ((i = 1; i <= CONN_POLL_ATTEMPTS; i++)); do
  CONN_STATE="$(aws events describe-connection --name "$CONNECTION_NAME" \
    --query ConnectionState --output text --region "$REGION" 2>/dev/null || echo "UNKNOWN")"
  if [ "$CONN_STATE" = "AUTHORIZED" ]; then
    conn_authorized=true
    log "connection $CONNECTION_NAME is AUTHORIZED (attempt $i/$CONN_POLL_ATTEMPTS)"
    break
  fi
  log "connection $CONNECTION_NAME state=$CONN_STATE, waiting... (attempt $i/$CONN_POLL_ATTEMPTS)"
  sleep "$CONN_POLL_INTERVAL_SECONDS"
done
if [ "$conn_authorized" != true ]; then
  log "WARNING: connection $CONNECTION_NAME did not reach AUTHORIZED within $((CONN_POLL_ATTEMPTS * CONN_POLL_INTERVAL_SECONDS))s (state=$CONN_STATE) — verify manually before trusting the schedule"
fi

### 4) API Destination ###
if ! aws events describe-api-destination --name "$DESTINATION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws events create-api-destination --name "$DESTINATION_NAME" \
    --connection-arn "$CONNECTION_ARN" \
    --invocation-endpoint "$ENDPOINT" \
    --http-method PATCH \
    --invocation-rate-limit-per-second 1 \
    --region "$REGION" >/dev/null
  log "api destination $DESTINATION_NAME created"
else
  log "api destination $DESTINATION_NAME exists"
fi
DEST_ARN="$(aws events describe-api-destination --name "$DESTINATION_NAME" \
  --query ApiDestinationArn --output text --region "$REGION")"

### 5) Rule + target — 하루 한 번 05:00 UTC(14:00 KST) ###
aws events put-rule --name "$RULE_NAME" \
  --schedule-expression "cron(0 5 * * ? *)" \
  --state ENABLED --region "$REGION" >/dev/null
log "rule $RULE_NAME ready (05:00 UTC = 14:00 KST, daily)"

aws events put-targets --rule "$RULE_NAME" --region "$REGION" \
  --targets "[{\"Id\":\"kr-tickers\",\"Arn\":\"$DEST_ARN\",\"RoleArn\":\"$ROLE_ARN\",\"HttpParameters\":{\"HeaderParameters\":{},\"QueryStringParameters\":{},\"PathParameterValues\":[]}}]" \
  >/dev/null
log "target wired: $RULE_NAME -> $DESTINATION_NAME"

### 6) 알람 두 개 ###
# 알람을 둘로 한정한 이유: 이 작업의 실패 모드는 두 가지뿐이다 — 호출이 아예 안
# 갔거나(FailedInvocations), 갔는데 안에서 터졌거나(sync failed 로그). 유닛 단위
# 부분 실패도, 데드라인도, 예산도 없어서 seo-prewarm의 나머지 알람이 대응할 대상이 없다.
ALARM_SNS="${ALARM_SNS:-$(aws sns create-topic --name siglens-alerts --query TopicArn --output text --region "$REGION")}"
[[ -n "${ALARM_EMAIL:-}" ]] && aws sns subscribe --topic-arn "$ALARM_SNS" --protocol email \
  --notification-endpoint "$ALARM_EMAIL" --region "$REGION" >/dev/null 2>&1 || true
ACTIONS="--alarm-actions $ALARM_SNS --ok-actions $ALARM_SNS"

# (a) 딜리버리 부재 — EventBridge가 타겟 호출 자체에 실패하면 앱 로그에 흔적이 없다.
# shellcheck disable=SC2086
aws cloudwatch put-metric-alarm --alarm-name "siglens-kr-tickers-delivery-failed" \
  --namespace AWS/Events --metric-name FailedInvocations \
  --dimensions Name=RuleName,Value="$RULE_NAME" \
  --statistic Sum --period 300 --evaluation-periods 1 --threshold 0 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching \
  $ACTIONS --region "$REGION"
log "alarm siglens-kr-tickers-delivery-failed ready"

# (b) 동기화 실패 — 라우트 안에서 던진 경우. ASCII 접두만 필터에 쓴다(13-seo-prewarm.sh
# FIX F와 같은 근거: 따옴표 안 non-ASCII 토큰 매칭이 검증되지 않았다).
# 로그 그룹이 아직 없으면 put-metric-filter가 실패하지만 `|| true`로 넘어가므로,
# 첫 배포에서는 10-logs.sh(또는 첫 인스턴스 부팅) 뒤에 이 스크립트를 **재실행**할 것.
aws logs put-metric-filter --log-group-name "$LOG_GROUP" \
  --filter-name siglens-kr-tickers-sync-failed \
  --filter-pattern '"[kr-tickers] sync failed"' \
  --metric-transformations "metricName=SiglensKrTickersSyncFailed,metricNamespace=Siglens,metricValue=1,defaultValue=0" \
  --region "$REGION" >/dev/null 2>&1 || log "WARNING: put-metric-filter failed (log group $LOG_GROUP missing?) — re-run this script after 10-logs.sh"

# shellcheck disable=SC2086
aws cloudwatch put-metric-alarm --alarm-name "siglens-kr-tickers-sync-failed" \
  --namespace Siglens --metric-name SiglensKrTickersSyncFailed \
  --statistic Sum --period 86400 --evaluation-periods 1 --threshold 0 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching \
  $ACTIONS --region "$REGION"
log "alarm siglens-kr-tickers-sync-failed ready"

log "kr-tickers cron ready — verify with a manual invoke before trusting the schedule:"
log "  curl -i -X PATCH https://siglens.io/api/cron/kr-tickers -H \"Authorization: Bearer \$CRON_SECRET\"  # expect 202"
