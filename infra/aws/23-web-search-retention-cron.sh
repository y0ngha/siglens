#!/usr/bin/env bash
#
# infra/aws/23-web-search-retention-cron.sh — 웹 검색 결과 보존 기간(7일) 정리 스케줄 (멱등)
#
# `PATCH /api/cron/web-search-retention`을 EventBridge classic Rule → API Destination으로 매일 18:10 UTC(03:10 KST)에
# 호출한다. 21번과 같은 배선이다. 라우트는 멤버 대화에 저장된 `web_search` 도구 결과 중 저장된 지 7일이 지난 것을
# 제목·URL만 남기도록 다시 쓴다(멱등 — 락 없음, 한 번에 최대 100행 × 100배치, 못 끝낸 몫은 다음 실행이 잇는다).
#
# ⚠️ 첫 운영 실행은 기존 `chat_messages` 행을 바꾼다. 코드 배포 **뒤에**, 사용자 확인을 받고 아래 수동 invoke를 한 번
#    돌려 로그(`[web-search-retention] run done: {...}`)의 `rewritten`을 확인한 다음에 이 스크립트로 스케줄을 만든다.
# ⚠️ 이 스크립트는 수동 실행이다. deploy 파이프라인 어디서도 자동 호출하지 않는다.
#
# 사용법:
#     bash infra/aws/23-web-search-retention-cron.sh
#
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/lib-cron.sh"
source "$(dirname "$0")/.env"

REGION="${AWS_REGION:-ap-northeast-2}"

ROLE_NAME=siglens-web-search-retention-eventbridge
DESTINATION_NAME=siglens-web-search-retention
RULE_NAME=siglens-web-search-retention-daily
ENDPOINT="https://siglens.io/api/cron/web-search-retention"
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
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name siglens-web-search-retention-invoke \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{\"Effect\":\"Allow\",
      \"Action\":\"events:InvokeApiDestination\",
      \"Resource\":\"arn:aws:events:$REGION:$ACCOUNT_ID:api-destination/$DESTINATION_NAME/*\"}]
  }"
ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
log "role $ROLE_NAME ready ($ROLE_ARN)"

### 3) Connection(공유) + API Destination ###
ensure_cron_connection "$REGION" "$CRON_SECRET"
ensure_api_destination "$REGION" "$DESTINATION_NAME" "$ENDPOINT" "$CONNECTION_ARN"

### 4) Rule + target — 매일 18:10 UTC ###
aws events put-rule --name "$RULE_NAME" \
  --schedule-expression "cron(10 18 * * ? *)" \
  --state ENABLED --region "$REGION" >/dev/null
log "rule $RULE_NAME ready (daily at 18:10 UTC)"

aws events put-targets --rule "$RULE_NAME" --region "$REGION" \
  --targets "[{\"Id\":\"web-search-retention\",\"Arn\":\"$DEST_ARN\",\"RoleArn\":\"$ROLE_ARN\",\"HttpParameters\":{\"HeaderParameters\":{},\"QueryStringParameters\":{},\"PathParameterValues\":[]}}]" \
  >/dev/null
log "target wired: $RULE_NAME -> $DESTINATION_NAME"

### 5) 로그 메트릭 필터 (알람은 07-alarms.sh의 `siglens-p2` 점수 알람이 합산 평가) ###
# 정리가 안 도는 동안은 처리방침의 7일 약속과 검색 제공자 약관을 어기는 상태가 이어지므로 가중치 100. ASCII 접두만
# 필터에 쓴다(21번과 같은 근거). 두 접두 모두 라우트·작업 코드가 남긴다.
put_filter() {
  aws logs put-metric-filter --log-group-name "$LOG_GROUP" \
    --filter-name "$1" --filter-pattern "$2" \
    --metric-transformations "metricName=P2Score,metricNamespace=Siglens/Alerts,metricValue=$3" \
    --region "$REGION" >/dev/null 2>&1 || log "WARNING: put-metric-filter $1 failed (log group $LOG_GROUP missing?) — re-run after 10-logs.sh"
}
put_filter siglens-web-search-retention-run-failed '"[web-search-retention] run failed"' 100
put_filter siglens-web-search-retention-batch-failed '"[web-search-retention] batch failed"' 100
log "metric filters ready (P2Score; alarm is siglens-p2 in 07-alarms.sh)"

log "web-search-retention cron ready — verify with a manual invoke before trusting the schedule:"
log "  curl -i -X PATCH https://siglens.io/api/cron/web-search-retention -H \"Authorization: Bearer \$CRON_SECRET\"  # expect 202"
