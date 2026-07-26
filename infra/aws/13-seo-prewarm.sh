#!/usr/bin/env bash
#
# infra/aws/13-seo-prewarm.sh — SEO pre-warm cron EventBridge 스케줄 프로비저닝 (멱등)
#
# `PATCH /api/cron/seo-prewarm`(Task 8)를 AWS EventBridge → API Destination으로
# 주기 호출하기 위한 IAM 역할·Connection·API Destination·Rule 3개·타겟 wiring을
# 생성한다. 이 저장소에서 EventBridge를 사용하는 **첫 사례**다 — Vercel Cron/GitHub
# Actions cron과 달리 classic Rules + API Destinations는 UTC 스케줄만 지원한다
# (라우트가 ET 마감 기준 신선도로 자체 게이팅하므로 UTC로도 문제없다, spec §6/§11).
#
# 스케줄: 20:30–03:59 UTC, 5분 간격(EST/EDT 양쪽에서 16:00 ET 마감을 커버).
# UTC 자정 + AWS cron의 "시간별로 다른 분(minute) 표현" 제약 때문에 규칙을
# 3개로 쪼갠다(20:30-55시, 21-23시, 0-3시).
#
# ⚠️ FIX Z(감사) — 20:00이 아니라 20:30 시작이다: technical 캐시(anonymous/free
# 기준)는 KST 05:00 = UTC 20:00에 만료된다(infrastructure/cache/config.js).
# 원래 스케줄의 첫 tick이 정확히 UTC 20:00이라, 가장 많이 크롤되는 [symbol]
# 루트 라우트가 cron 실행 시점에 거의 항상 MISS였다. 30분 지연 + 이미 존재하는
# 30분 정착 버퍼(SETTLE_BUFFER_MS, freshness.ts)를 합쳐 시작 시점을 캐시
# 만료·정착 버퍼 둘 다보다 뒤로 민다.
#
# ⚠️ 부트스트랩 순서(중요): 이 스크립트는 첫 태그 배포 전에 1회 수동 실행해야
#    한다. deploy 어디서도 자동 호출하지 않는다. 또한 이 저장소 최초의
#    EventBridge 사용이므로, 생성 직후 **소규모 딜리버리 스파이크(수동 invoke
#    또는 실제 스케줄 1회 대기)로 202가 실제로 오는지 검증**하기 전까지는
#    스케줄을 신뢰하지 말 것(spec §11). 검증 없이 방치하면 cron이 조용히
#    죽어있어도 아무도 모른다.
#
# 사용법:
#     bash infra/aws/13-seo-prewarm.sh
#
# 전제: --profile siglens (또는 AWS_PROFILE) 로 다음 권한이 필요하다:
#       events:*, iam:CreateRole/GetRole/PutRolePolicy, logs:PutMetricFilter,
#       cloudwatch:PutMetricAlarm, sns:CreateTopic, secretsmanager:* (create-connection이
#       API_KEY 인증 정보를 담는 관리형 시크릿을 내부적으로 생성한다 — 투명하지만 권한은
#       명시적으로 필요). CRON_SECRET은 04-params.sh가 이미 SSM /siglens/CRON_SECRET에
#       게시했어야 한다.
#
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/.env"

REGION="${AWS_REGION:-ap-northeast-2}"

ROLE_NAME=siglens-seo-prewarm-eventbridge
CONNECTION_NAME=siglens-seo-prewarm
DESTINATION_NAME=siglens-seo-prewarm
RULE_EVENING=siglens-seo-prewarm-evening
RULE_EVENING_LATE=siglens-seo-prewarm-evening-late
RULE_EARLY=siglens-seo-prewarm-early
ENDPOINT="https://siglens.io/api/cron/seo-prewarm"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

# 1) CRON_SECRET 조회 — 04-params.sh가 이미 SSM에 게시해둔 값을 읽기만 한다.
CRON_SECRET="$(aws ssm get-parameter --name /siglens/CRON_SECRET --with-decryption \
  --query 'Parameter.Value' --output text --region "$REGION")"
[ -n "$CRON_SECRET" ] || { log "ERROR: /siglens/CRON_SECRET is empty — run 04-params.sh first"; exit 1; }

### 2) IAM 역할 — EventBridge가 API Destination을 호출할 때 assume ###
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  log "role $ROLE_NAME exists"
else
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document '{
       "Version":"2012-10-17",
       "Statement":[{"Effect":"Allow","Principal":{"Service":"events.amazonaws.com"},"Action":"sts:AssumeRole"}]
     }' >/dev/null
  log "role $ROLE_NAME created"
fi
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name siglens-seo-prewarm-invoke \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{\"Effect\":\"Allow\",
      \"Action\":\"events:InvokeApiDestination\",
      \"Resource\":\"arn:aws:events:$REGION:$ACCOUNT_ID:api-destination/$DESTINATION_NAME/*\"}]
  }"
ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
log "role $ROLE_NAME ready ($ROLE_ARN)"

### 3) Connection — API_KEY 인증으로 Authorization 헤더를 주입 ###
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

# Connection 생성/갱신은 비동기로 AUTHORIZED 상태에 도달한다(관리형 시크릿 생성 포함).
# API Destination이 이 Connection을 인증에 쓰므로, AUTHORIZED 전에 스케줄이 돌면
# 초기 호출들이 조용히 인증 실패할 수 있다 — 짧게 폴링해 상태를 눈으로 확인한다.
# 실패해도 스크립트 전체를 죽이지 않는다(나머지 리소스는 여전히 유용하고, 딜리버리
# 스파이크 검증 단계에서 어차피 재확인한다).
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
  log "WARNING: connection $CONNECTION_NAME did not reach AUTHORIZED within $((CONN_POLL_ATTEMPTS * CONN_POLL_INTERVAL_SECONDS))s (state=$CONN_STATE) — continuing script, but verify manually before trusting the schedule (aws events describe-connection --name $CONNECTION_NAME)"
fi

### 4) API Destination — PATCH https://siglens.io/api/cron/seo-prewarm ###
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

### 5) Rule 3개 (UTC) — EventBridge cron은 UTC 고정이라 20:30–03:59 창을 자정
###    경계로 쪼개고, 20시대는 AWS cron이 "시간별로 다른 분(minute) 필터"를
###    표현할 수 없어 21-23시(매시 0/5)와 별도 규칙으로 나눈다. 전부 5분 간격.
###
### ⚠️ **5분 간격은 앱 코드와 묶인 계약이다 — 임의로 늘리지 말 것.**
### `runPrewarmBatch.ts`의 배치 선정은 회전 창(window)을 쓰는데, invocation당
### 전진 폭이 `SYMBOLS_PER_TICK × (스케줄주기 / TICK_ROTATION_MS)`이고 이 값이
### 창 폭(`SYMBOLS_PER_TICK × CANDIDATE_WINDOW_MULTIPLIER` = 18)을 넘으면 창 사이에
### 영영 후보가 되지 않는 구멍이 생겨 일부 심볼이 영구히 pre-warm되지 않는다.
### 불변식: **BATCH_DEADLINE_MS + 스케줄주기 ≤ 15분**. 락이 중첩을 막으므로 실제
### 회전 폭을 정하는 건 "배치가 시작되는 간격"이고, 앞 배치가 데드라인까지 쓰면
### 그만큼 뒤로 밀린다. 현재 600s + 300s = 900s = 15분으로 **경계에 정확히 걸쳐
### 있어 여유가 없다**. 스케줄이나 BATCH_DEADLINE_MS를 늘리려면
### `CANDIDATE_WINDOW_MULTIPLIER`를 함께 올릴 것.
# FIX Z(감사) — 20,25분 두 슬롯을 빼고 30분부터 시작(cron(0/5 20-23 ...)이면
# 20:00/20:05/...도 포함되므로, 30분부터 도는 조밀한 표현이 없어 명시 리스트로 튼다).
aws events put-rule --name "$RULE_EVENING" \
  --schedule-expression "cron(30,35,40,45,50,55 20 * * ? *)" \
  --state ENABLED --region "$REGION" >/dev/null
log "rule $RULE_EVENING ready (20:30-20:55 UTC, every 5m)"

# 21-23시는 매시 5분 간격 그대로.
aws events put-rule --name "$RULE_EVENING_LATE" \
  --schedule-expression "cron(0/5 21-23 * * ? *)" \
  --state ENABLED --region "$REGION" >/dev/null
log "rule $RULE_EVENING_LATE ready (21:00-23:59 UTC, every 5m)"

aws events put-rule --name "$RULE_EARLY" \
  --schedule-expression "cron(0/5 0-3 * * ? *)" \
  --state ENABLED --region "$REGION" >/dev/null
log "rule $RULE_EARLY ready (00:00-03:59 UTC, every 5m)"

# 타겟 wiring: 각 rule → API Destination(+ 호출용 IAM role). 본문 없음(빈 body) —
# 라우트는 PATCH + Authorization 헤더(Connection이 주입)만으로 충분하다.
# ⚠️ put-targets의 HttpParameters 문법은 이 레포 최초 EventBridge 사용이라
#    실전 검증이 안 된 상태다 — 배포 시 딜리버리 스파이크로 반드시 확인할 것.
for RULE in "$RULE_EVENING" "$RULE_EVENING_LATE" "$RULE_EARLY"; do
  aws events put-targets --rule "$RULE" --region "$REGION" \
    --targets "[{\"Id\":\"seo-prewarm\",\"Arn\":\"$DEST_ARN\",\"RoleArn\":\"$ROLE_ARN\",\"HttpParameters\":{\"HeaderParameters\":{},\"QueryStringParameters\":{},\"PathParameterValues\":[]}}]" \
    >/dev/null
  log "target wired: $RULE -> $DESTINATION_NAME"
done

log "seo-prewarm eventbridge schedule ready — RUN A DELIVERY SPIKE before trusting the schedule (manual invoke or watch first scheduled 202, see docs/reference/CRON.md)"

### 6) 알람 — batch-failure + delivery-absence(OPS-1) + (best-effort) FMP 429 버스트 ###
# 07-alarms.sh와 동일 패턴: SNS 토픽 idempotent 생성, alarm+ok 양방향 통지.
ALARM_SNS="${ALARM_SNS:-$(aws sns create-topic --name siglens-alerts --query TopicArn --output text --region "$REGION")}"
# FIX E(감사) — 07-alarms.sh:9-11과 동일한 idempotent 이메일 구독 블록. 이 스크립트가
# siglens-alerts 토픽을 처음 만드는 실행 경로(07-alarms.sh를 아직 안 돌렸거나 순서가
# 바뀐 경우)라면 구독자가 하나도 없는 채로 알람 5개가 매달릴 수 있다 — 2026-06-28
# 디스크풀 인시던트(AlarmActions=[]로 조용히 진행)와 같은 종류의 "액션 없는 알람" 사각지대.
[[ -n "${ALARM_EMAIL:-}" ]] && aws sns subscribe --topic-arn "$ALARM_SNS" --protocol email \
  --notification-endpoint "$ALARM_EMAIL" --region "$REGION" >/dev/null 2>&1 || true
ACTIONS="--alarm-actions $ALARM_SNS --ok-actions $ALARM_SNS"

# 딜리버리 부재 알람(OPS-1): 배치 내부 실패는 batch-failed가 잡지만, EventBridge가
# 애초에 타겟 호출 자체를 실패하면(Connection 미인증, API Destination 오류, IAM 등)
# 우리 앱 로그에는 아무 흔적도 안 남는다 — AWS/Events FailedInvocations로 그 공백을 잡는다.
for RULE in "$RULE_EVENING" "$RULE_EVENING_LATE" "$RULE_EARLY"; do
  case "$RULE" in
    "$RULE_EVENING") ALARM_SUFFIX="evening" ;;
    "$RULE_EVENING_LATE") ALARM_SUFFIX="evening-late" ;;
    *) ALARM_SUFFIX="early" ;;
  esac
  aws cloudwatch put-metric-alarm --alarm-name "siglens-seo-prewarm-${ALARM_SUFFIX}-failed" \
    --namespace AWS/Events --metric-name FailedInvocations \
    --dimensions Name=RuleName,Value="$RULE" \
    --statistic Sum --period 300 --evaluation-periods 1 --threshold 0 \
    --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching \
    --region "$REGION" $ACTIONS
  log "alarm siglens-seo-prewarm-${ALARM_SUFFIX}-failed ready (AWS/Events FailedInvocations, RuleName=$RULE)"
done

# ⚠️ 로그 그룹 순서 주의: 아래 put-metric-filter 호출들은 로그 그룹 /siglens/app이
# 이미 존재한다는 전제다(10-logs.sh 또는 첫 인스턴스 부팅이 생성). 그룹이 아직 없으면
# put-metric-filter는 에러를 던지지만 `|| true`로 조용히 무시되므로 필터가 안 걸린 채로
# 스크립트가 "성공"한 것처럼 보인다 — 10-logs.sh(또는 최초 배포)가 먼저 돈 뒤 반드시
# 이 스크립트를 재실행할 것.
#
# 배치 실패: route.ts의 after() catch가 '[seo-prewarm] batch failed:'를 남긴다
# (runPrewarmBatch 전체가 던진 경우만 — 심볼/탭 단위 실패는 fail-open으로 격리되어
# 여기 안 잡힌다. 배치 자체가 깨지는 구조적 문제만 신호).
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-seo-prewarm-batch-failed \
  --filter-pattern '"[seo-prewarm] batch failed"' \
  --metric-transformations metricName=SeoPrewarmBatchFailed,metricNamespace=Siglens/SeoPrewarm,metricValue=1 \
  --region "$REGION" || true
# 1시간에 3회 초과 = 산발적 hiccup이 아니라 지속 실패.
aws cloudwatch put-metric-alarm --alarm-name siglens-seo-prewarm-batch-failed \
  --namespace Siglens/SeoPrewarm --metric-name SeoPrewarmBatchFailed \
  --statistic Sum --period 3600 --evaluation-periods 1 --threshold 3 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching \
  --region "$REGION" $ACTIONS

# redis 불가용: lock.ts의 acquirePrewarmLock이 redis 미구성 시 fail-closed로 null을
# 반환하고 '[seo-prewarm] redis unavailable — cannot run'을 남긴다. route.ts(FIX H,
# 감사)는 acquirePrewarmLock 자체가 던지는 경우(Upstash 장애/타임아웃)도 같은
# '[seo-prewarm] redis unavailable' 접두로 '... — lock acquire threw:'를 남기고 204를
# 반환한다 — 두 경로 다 route가 2xx를 반환하므로 EventBridge FailedInvocations도,
# batch-failed 로그도 안 남는다(cron이 조용히 죽어있어도 알람이 없는 사각지대). 이
# 필터+알람으로 두 경로를 한 번에 잡는다.
#
# FIX F(감사) — 필터 패턴은 로그 문자열 전체가 아니라 ASCII만 남긴 접두
# '[seo-prewarm] redis unavailable'로 자른다. 원문 로그의 em-dash(—)는 CloudWatch
# Logs 필터 패턴의 따옴표 안 non-ASCII 토큰 매칭이 검증되지 않은 동작이라 신뢰하지
# 않는다. 이 접두는 grep 기준 이 저장소에서 두 로그 라인(lock.ts/route.ts)에만
# 등장하므로 여전히 유일하다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-seo-prewarm-redis-unavailable \
  --filter-pattern '"[seo-prewarm] redis unavailable"' \
  --metric-transformations metricName=SeoPrewarmRedisUnavailable,metricNamespace=Siglens/SeoPrewarm,metricValue=1 \
  --region "$REGION" || true
# 1시간에 1회라도 발생하면 신호(락 자체를 못 잡는 상태라 배치가 전혀 안 돈다).
aws cloudwatch put-metric-alarm --alarm-name siglens-seo-prewarm-redis-unavailable \
  --namespace Siglens/SeoPrewarm --metric-name SeoPrewarmRedisUnavailable \
  --statistic Sum --period 3600 --evaluation-periods 1 --threshold 0 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching \
  --region "$REGION" $ACTIONS

# FMP 429 버스트: best-effort/placeholder. fmpRetry.ts(isFmpTransientError)가 429를
# 자동 재시도(10s/15s/20s)하지만, withRetry.ts는 재시도 시도 자체를 로그로 남기지
# 않는다 — 즉 429는 조용히 흡수되고 이 저장소 어디에도 안정적인 "429" 로그 문자열이
# 없다(402만 '[seo-prewarm] fmp-402 ...'로 명시 로깅됨, 정책상 402는 심볼 단위 이슈라
# 알람 대상에서 제외 — per-symbol issue, no alarm). 따라서 429 전용 알람은 지금
# 만들지 않는다: 없는 로그 문자열에 필터를 걸면 항상 0건인 죽은 알람만 생긴다.
# 429가 배치에 영향을 줄 정도로 누적되면 unit-error 경로('[seo-prewarm] unit-error ...')
# 로 흘러들 가능성이 있으나 이는 429 전용 신호가 아니라 범용 실패 신호라 오탐이 크다.
# TODO: fmpRetry.ts / withRetry.ts에 429 전용 로그 라인이 추가되면 이 알람을 채운다.
log "skipped fmp-429 alarm: no stable log marker exists yet (see comment above) — batch-failed alarm covers structural failure in the meantime"

log "seo-prewarm alarms ready (batch-failed, redis-unavailable; fmp-429 skipped, see log above)"
