#!/usr/bin/env bash
#
# infra/aws/21-feedback-digest-cron.sh — AI 응답 피드백 일일 요약·파기 스케줄 (멱등)
#
# `PATCH /api/cron/feedback-digest`를 EventBridge classic Rule → API Destination으로
# 매일 00:05 UTC(09:05 KST)에 호출한다. 17-email-report-cron.sh와 같은 배선이다.
# 라우트는 지난 24시간 👍/👎를 운영자 메일로 요약(0건이면 생략)한 뒤, 보관 기간
# (365일)이 지난 `feedback` 행을 삭제한다.
#
# 락이 없다: 요약은 읽기, 파기는 조건 삭제라 겹쳐 돌아도 결과가 같다(라우트 JSDoc).
#
# 앱 쪽 전제: SSM `/siglens/OPERATOR_EMAIL`(선택)과 RESEND_API_KEY. OPERATOR_EMAIL이
# 없으면 메일은 건너뛰고 파기만 돈다. 마이그레이션 `feedback` 테이블이 적용된 뒤에
# 실행할 것.
#
# ⚠️ 이 스크립트는 수동 실행이다. deploy 파이프라인 어디서도 자동 호출하지 않는다.
#    생성 직후 수동 invoke로 202가 실제로 오는지 확인할 것.
#
# 사용법:
#     bash infra/aws/21-feedback-digest-cron.sh
#
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/lib-cron.sh"
source "$(dirname "$0")/.env"

REGION="${AWS_REGION:-ap-northeast-2}"

ROLE_NAME=siglens-feedback-digest-eventbridge
DESTINATION_NAME=siglens-feedback-digest
RULE_NAME=siglens-feedback-digest-daily
ENDPOINT="https://siglens.io/api/cron/feedback-digest"
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
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name siglens-feedback-digest-invoke \
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

### 4) Rule + target — 매일 00:05 UTC ###
aws events put-rule --name "$RULE_NAME" \
  --schedule-expression "cron(5 0 * * ? *)" \
  --state ENABLED --region "$REGION" >/dev/null
log "rule $RULE_NAME ready (daily at 00:05 UTC)"

aws events put-targets --rule "$RULE_NAME" --region "$REGION" \
  --targets "[{\"Id\":\"feedback-digest\",\"Arn\":\"$DEST_ARN\",\"RoleArn\":\"$ROLE_ARN\",\"HttpParameters\":{\"HeaderParameters\":{},\"QueryStringParameters\":{},\"PathParameterValues\":[]}}]" \
  >/dev/null
log "target wired: $RULE_NAME -> $DESTINATION_NAME"

### 5) 로그 메트릭 필터 (알람은 07-alarms.sh의 `siglens-p2` 점수 알람이 합산 평가) ###
# 요약·파기 단계 실패는 하루 한 번이라 즉시 볼 일은 아니지만, 파기 실패는 처리방침의
# 보관 기간 약속을 어기는 일이라 가중치 100으로 둔다. ASCII 접두만 필터에 쓴다
# (14-kr-tickers-cron.sh와 같은 근거).
put_filter() {
  aws logs put-metric-filter --log-group-name "$LOG_GROUP" \
    --filter-name "$1" --filter-pattern "$2" \
    --metric-transformations "metricName=P2Score,metricNamespace=Siglens/Alerts,metricValue=$3" \
    --region "$REGION" >/dev/null 2>&1 || log "WARNING: put-metric-filter $1 failed (log group $LOG_GROUP missing?) — re-run after 10-logs.sh"
}
put_filter siglens-feedback-digest-run-failed '"[feedback-digest] run failed"' 100
put_filter siglens-feedback-digest-purge-failed '"[feedback-digest] purge failed"' 100
put_filter siglens-feedback-digest-digest-failed '"[feedback-digest] digest failed"' 10
log "metric filters ready (P2Score; alarm is siglens-p2 in 07-alarms.sh)"

log "feedback-digest cron ready — verify with a manual invoke before trusting the schedule:"
log "  curl -i -X PATCH https://siglens.io/api/cron/feedback-digest -H \"Authorization: Bearer \$CRON_SECRET\"  # expect 202"
