#!/usr/bin/env bash
#
# infra/aws/14-kr-tickers-cron.sh — 한국 종목 마스터 일 1회 동기화 스케줄 (멱등)
#
# `PATCH /api/cron/kr-tickers`를 EventBridge classic Rule → API Destination으로
# 하루 한 번 호출한다. 13-seo-prewarm.sh와 같은 배선이지만 **의도적으로 훨씬 작다**:
# 그쪽은 5분 간격 10분짜리 LLM 배치라 Redis 루트 락·wall-clock 데드라인·알람 8종(현재는 점수 알람 하나로 통합)이
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
#       PutRolePolicy, logs:PutMetricFilter, secretsmanager:* 권한(알람·SNS는 07-alarms.sh 소관). CRON_SECRET은 04-params.sh가 SSM에 게시했어야 하고,
#       DATA_GO_KR_SERVICE_KEY도 SSM에 있어야 한다(없으면 라우트가 sync failed를 남긴다).
#
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/lib-cron.sh"
source "$(dirname "$0")/.env"

REGION="${AWS_REGION:-ap-northeast-2}"

ROLE_NAME=siglens-kr-tickers-eventbridge
# 공유 Connection(`siglens-cron`)은 lib-cron.sh가 소유한다. 아래는 공유 이전의 전용
# Connection 이름으로, 이관 후 삭제 대상이다(lib-cron.sh 머리말).
LEGACY_CONNECTION_NAME=siglens-kr-tickers
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

### 3) Connection — Authorization: Bearer <CRON_SECRET> 주입 (13/14 공유, lib-cron.sh) ###
ensure_cron_connection "$REGION" "$CRON_SECRET"

### 4) API Destination — 이미 있으면 공유 Connection으로 갈아 끼운 뒤 옛 전용 Connection 삭제 ###
ensure_api_destination "$REGION" "$DESTINATION_NAME" "$ENDPOINT" "$CONNECTION_ARN"
delete_legacy_connection "$REGION" "$LEGACY_CONNECTION_NAME"
# 공유 Connection이 AUTHORIZED가 아니면 위 두 함수가 이관·삭제를 건너뛰었다(lib-cron.sh).
# 스케줄은 아래에서 그대로 갱신되고, 기존 Destination은 옛 Connection으로 계속 동작한다.
if [ "$CRON_CONNECTION_AUTHORIZED" != true ]; then
  log "WARNING: cron connection migration incomplete — $CRON_RERUN_HINT"
fi

### 5) Rule + target — 하루 한 번 05:00 UTC(14:00 KST) ###
aws events put-rule --name "$RULE_NAME" \
  --schedule-expression "cron(0 5 * * ? *)" \
  --state ENABLED --region "$REGION" >/dev/null
log "rule $RULE_NAME ready (05:00 UTC = 14:00 KST, daily)"

aws events put-targets --rule "$RULE_NAME" --region "$REGION" \
  --targets "[{\"Id\":\"kr-tickers\",\"Arn\":\"$DEST_ARN\",\"RoleArn\":\"$ROLE_ARN\",\"HttpParameters\":{\"HeaderParameters\":{},\"QueryStringParameters\":{},\"PathParameterValues\":[]}}]" \
  >/dev/null
log "target wired: $RULE_NAME -> $DESTINATION_NAME"

### 6) 로그 메트릭 필터 (알람은 07-alarms.sh의 `siglens-p2` 점수 알람 하나로 통합) ###
# 2026-10 CloudWatch 무료 티어 통합으로 이 스크립트의 알람 2개를 폐기했다.
#   - `siglens-kr-tickers-delivery-failed`(EventBridge FailedInvocations): 하루 한 번 도는
#     작업이라 딜리버리가 끊기면 sync 로그가 멎는다. 종목 마스터가 낡는 건 사용자에게
#     즉시 보이는 장애가 아니므로 알람 지표 10개(무료 티어)를 쓰지 않는다.
#   - `siglens-kr-tickers-sync-failed`: 필터는 유지하되 `Siglens/Alerts P2Score`에 가중치
#     100(1건=즉시 발화)으로 발행하고, 알람은 07-alarms.sh의 `siglens-p2`가 합산 평가한다.
# SNS 토픽·구독과 옛 알람 삭제(OBSOLETE_ALARMS)는 07-alarms.sh가 소유한다.
# 필터에는 `defaultValue`를 붙이지 않는다(매 시간 0을 발행해 커스텀 메트릭 과금 — 07-alarms.sh의
# FILL 설명 참조).

# 동기화 실패 — 라우트 안에서 던진 경우. ASCII 접두만 필터에 쓴다(13-seo-prewarm.sh
# FIX F와 같은 근거: 따옴표 안 non-ASCII 토큰 매칭이 검증되지 않았다).
# 로그 그룹이 아직 없으면 put-metric-filter가 실패하지만 `|| true`로 넘어가므로,
# 첫 배포에서는 10-logs.sh(또는 첫 인스턴스 부팅) 뒤에 이 스크립트를 **재실행**할 것.
aws logs put-metric-filter --log-group-name "$LOG_GROUP" \
  --filter-name siglens-kr-tickers-sync-failed \
  --filter-pattern '"[kr-tickers] sync failed"' \
  --metric-transformations "metricName=P2Score,metricNamespace=Siglens/Alerts,metricValue=100" \
  --region "$REGION" >/dev/null 2>&1 || log "WARNING: put-metric-filter failed (log group $LOG_GROUP missing?) — re-run this script after 10-logs.sh"
log "metric filter siglens-kr-tickers-sync-failed ready (P2Score=100; alarm is siglens-p2 in 07-alarms.sh)"

log "kr-tickers cron ready — verify with a manual invoke before trusting the schedule:"
log "  curl -i -X PATCH https://siglens.io/api/cron/kr-tickers -H \"Authorization: Bearer \$CRON_SECRET\"  # expect 202"
