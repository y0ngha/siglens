#!/usr/bin/env bash
#
# infra/aws/22-analysis-outcomes-cron.sh — 분석 사후 결과 라벨러 스케줄 (멱등)
#
# `PATCH /api/cron/analysis-outcomes`를 EventBridge classic Rule → API Destination으로
# 매일 06:10~09:40 UTC(15:10~18:40 KST) 30분마다(10분·40분, 하루 8번) 호출한다.
# 21-feedback-digest-cron.sh와 같은 배선이다.
#
# 라우트는 네 단계를 상한을 두고 돈다: 분석이 말한 것(subject) 캡처, 20봉이 쌓인 분석의
# 사후 라벨(봉 로드는 실행당 최대 120그룹, 동시 2), 정의가 바뀐 라벨의 재계산(공급자 호출
# 없음), 730일이 지난 행 삭제. LLM 호출이 없어서 DeepSeek 피크 시간대와 무관하다.
#
# 시각을 고른 이유: seo-prewarm의 세 창(20:30~00:55, 04:05~05:55, 10:05~12:55 UTC) 밖이고
# 미국 장 마감 후 밤이다. 한국 일봉은 KRX 마감(06:30 UTC) + EOD 버퍼 4시간 뒤에 닫히므로
# 하루 늦게 성숙한다(받아들인 지연). 대역폭 상한: 120그룹 × 8번 × 약 41KB ≈ 39MB/일(전부
# 캐시 미스일 때). 분석된 종목은 보통 캐시에 있다.
#
# 락: 라우트가 Redis 락(`investor-flows:cron-lock:analysis-outcomes`, TTL 12분)을 잡는다.
# 이전 실행이 남아 있으면 204로 건너뛴다. 모든 쓰기가 멱등이라 겹쳐도 수렴한다.
#
# 앱 쪽 전제: 마이그레이션 `0062_analysis_outcomes`(`analysis_outcomes` 테이블)가 적용된 뒤에,
# 그 마이그레이션이 들어간 앱 버전이 배포된 뒤에 실행할 것. 테이블이 없으면 매 실행이 step failed로
# 끝난다.
#
# ⚠️ 이 스크립트는 수동 실행이다. deploy 파이프라인 어디서도 자동 호출하지 않는다.
#    생성 직후 수동 invoke로 202가 실제로 오는지 확인할 것.
#
# 사용법:
#     bash infra/aws/22-analysis-outcomes-cron.sh
#
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/lib-cron.sh"
source "$(dirname "$0")/.env"

REGION="${AWS_REGION:-ap-northeast-2}"

ROLE_NAME=siglens-analysis-outcomes-eventbridge
DESTINATION_NAME=siglens-analysis-outcomes
RULE_NAME=siglens-analysis-outcomes
ENDPOINT="https://siglens.io/api/cron/analysis-outcomes"
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
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name siglens-analysis-outcomes-invoke \
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

### 4) Rule + target — 매일 06:10~09:40 UTC, 30분마다 ###
aws events put-rule --name "$RULE_NAME" \
  --schedule-expression "cron(10/30 6-9 * * ? *)" \
  --state ENABLED --region "$REGION" >/dev/null
log "rule $RULE_NAME ready (06:10-09:40 UTC every 30 minutes, 8 ticks a day)"

aws events put-targets --rule "$RULE_NAME" --region "$REGION" \
  --targets "[{\"Id\":\"analysis-outcomes\",\"Arn\":\"$DEST_ARN\",\"RoleArn\":\"$ROLE_ARN\",\"HttpParameters\":{\"HeaderParameters\":{},\"QueryStringParameters\":{},\"PathParameterValues\":[]}}]" \
  >/dev/null
log "target wired: $RULE_NAME -> $DESTINATION_NAME"

### 5) 로그 메트릭 필터 (알람은 07-alarms.sh의 `siglens-p2` 점수 알람이 합산 평가) ###
# run failed는 실행 자체가 던진 것(DB 클라이언트 없음 등), step failed는 한 단계가 통째로 던진 것이다
# (나머지 단계는 돌았다). 둘 다 측정이 멈추는 일이지 사용자 영향은 없어 P2다. ASCII 접두만 필터에 쓴다
# (14-kr-tickers-cron.sh와 같은 근거). capture backlog는 못 가져간 분석이 6일 창 밖으로 밀려 나가기 직전(5일 넘게
# 묵음)이라는 신호다 — 밀려 나간 분석은 다시 가져올 수 없어 점수는 낮지만 반드시 남긴다. 그룹 실패(`group failed`)는 종목 하나의 일시 장애가 흔해 필터를 걸지 않는다.
put_filter() {
  aws logs put-metric-filter --log-group-name "$LOG_GROUP" \
    --filter-name "$1" --filter-pattern "$2" \
    --metric-transformations "metricName=P2Score,metricNamespace=Siglens/Alerts,metricValue=$3" \
    --region "$REGION" >/dev/null 2>&1 || log "WARNING: put-metric-filter $1 failed (log group $LOG_GROUP missing?) — re-run after 10-logs.sh"
}
put_filter siglens-analysis-outcomes-run-failed '"[analysis-outcomes] run failed"' 100
put_filter siglens-analysis-outcomes-step-failed '"[analysis-outcomes] step failed"' 50
put_filter siglens-analysis-outcomes-capture-backlog '"[analysis-outcomes] capture backlog"' 20
log "metric filters ready (P2Score; alarm is siglens-p2 in 07-alarms.sh)"

log "analysis-outcomes cron ready — verify with a manual invoke before trusting the schedule:"
log "  curl -i -X PATCH https://siglens.io/api/cron/analysis-outcomes -H \"Authorization: Bearer \$CRON_SECRET\"  # expect 202, then look for '[analysis-outcomes] run done:' in /siglens/app"
