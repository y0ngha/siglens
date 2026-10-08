#!/usr/bin/env bash
#
# infra/aws/17-email-report-cron.sh — 회원 정기 메일 리포트 매시 스케줄 (멱등)
#
# `PATCH /api/cron/email-report`를 EventBridge classic Rule → API Destination으로
# 매시 정각에 호출한다. 14-kr-tickers-cron.sh와 같은 배선이다. 라우트는 회원마다 로컬
# 요일·시를 계산해 이번 시각이 발송 슬롯인 회원에게만 보내므로, 스케줄은 "매시"
# 하나면 된다(타임존별 Rule을 따로 두지 않는다).
#
# 락이 없다: 중복 발송은 DB의 `(user_id, local_date)` 선점 행이 막는다(라우트 JSDoc).
#
# 앱 쪽 전제: SSM `/siglens/EMAIL_REPORT_SIGNING_SECRET`(32자 이상)와 RESEND_API_KEY.
# 서명 비밀값이 없으면 라우트는 202를 돌려주고 아무것도 보내지 않는다
# (`[email-report] EMAIL_REPORT_SIGNING_SECRET missing` 로그).
#
# ⚠️ 이 스크립트는 수동 실행이다. deploy 파이프라인 어디서도 자동 호출하지 않는다.
#    생성 직후 수동 invoke로 202가 실제로 오는지 확인할 것.
#
# 사용법:
#     bash infra/aws/17-email-report-cron.sh
#
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/lib-cron.sh"
source "$(dirname "$0")/.env"

REGION="${AWS_REGION:-ap-northeast-2}"

ROLE_NAME=siglens-email-report-eventbridge
DESTINATION_NAME=siglens-email-report
RULE_NAME=siglens-email-report-hourly
ENDPOINT="https://siglens.io/api/cron/email-report"
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
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name siglens-email-report-invoke \
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

### 4) Rule + target — 매시 정각 ###
aws events put-rule --name "$RULE_NAME" \
  --schedule-expression "cron(0 * * * ? *)" \
  --state ENABLED --region "$REGION" >/dev/null
log "rule $RULE_NAME ready (every hour at :00 UTC)"

aws events put-targets --rule "$RULE_NAME" --region "$REGION" \
  --targets "[{\"Id\":\"email-report\",\"Arn\":\"$DEST_ARN\",\"RoleArn\":\"$ROLE_ARN\",\"HttpParameters\":{\"HeaderParameters\":{},\"QueryStringParameters\":{},\"PathParameterValues\":[]}}]" \
  >/dev/null
log "target wired: $RULE_NAME -> $DESTINATION_NAME"

### 5) 로그 메트릭 필터 (알람은 07-alarms.sh의 `siglens-p2` 점수 알람이 합산 평가) ###
# 배치 전체 실패와 비밀값 누락은 즉시 볼 일이라 가중치 100, 회원 한 명의 발송 실패는
# 일시적일 수 있어 10으로 둔다. ASCII 접두만 필터에 쓴다(14-kr-tickers-cron.sh와 같은 근거).
put_filter() {
  aws logs put-metric-filter --log-group-name "$LOG_GROUP" \
    --filter-name "$1" --filter-pattern "$2" \
    --metric-transformations "metricName=P2Score,metricNamespace=Siglens/Alerts,metricValue=$3" \
    --region "$REGION" >/dev/null 2>&1 || log "WARNING: put-metric-filter $1 failed (log group $LOG_GROUP missing?) — re-run after 10-logs.sh"
}
put_filter siglens-email-report-run-failed '"[email-report] run failed"' 100
put_filter siglens-email-report-secret-missing '"[email-report] EMAIL_REPORT_SIGNING_SECRET missing"' 100
put_filter siglens-email-report-delivery-failed '"[email-report] delivery failed"' 10
log "metric filters ready (P2Score; alarm is siglens-p2 in 07-alarms.sh)"

log "email-report cron ready — verify with a manual invoke before trusting the schedule:"
log "  curl -i -X PATCH https://siglens.io/api/cron/email-report -H \"Authorization: Bearer \$CRON_SECRET\"  # expect 202"
