#!/usr/bin/env bash
#
# infra/aws/18-investor-flows-crons.sh — 수급(investor flows) 데이터 cron 3종 스케줄 (멱등)
#
# `PATCH /api/cron/{sec-13f,finra-short,cusip-map}`를 EventBridge classic Rule → API Destination으로
# 호출한다. 14-kr-tickers-cron.sh와 같은 배선이고, 공유 Connection(`siglens-cron`)을 lib-cron.sh로 쓴다.
#
#   cron          스케줄(UTC)                    역할
#   sec-13f       cron(15 0/2 * * ? *)           2시간마다 — SEC 13F daily index 증분 + 최초 백필(~200일, 실행당 ≈940건 → 2시간 주기로 ≈1.5~2일; cusip-map 전수 한 바퀴 뒤에만 수집)
#   finra-short   cron(30 22 ? * MON-FRI *)      평일 22:30 — FINRA CNMS 일별 공매도 거래량 + 새 결제일 잔고
#   cusip-map     cron(0 3 * * ? *)              매일 03:00 — CUSIP↔심볼 맵 증분(다 차면 즉시 끝남)
#
# 세 라우트 모두 Redis 락 + 데드라인 + 202 패턴이라 겹쳐 호출돼도 안전하다(락을 못 잡으면 204).
# 락 TTL/마감은 각 route.ts 머리 주석이 정본이다.
#
# 순서는 코드가 지킨다 — 세 Rule을 한꺼번에 켜도 된다. cusip-map은 하루 1,500종목씩 채우므로 ~8천 종목에 며칠이 걸리는데,
# sec-13f는 cusip-map이 **전수 한 바퀴(후보 0건)**를 끝내 `investor_flows_state`에 표식(`cusip_map_full_pass_done`, 한 번 서면
# 지워지지 않는다)을 남기기 전까지는 아무것도 수집하지 않고 `[sec-13f] universe_incomplete`만 남기고 끝난다(결과 `stoppedBy:
# "universe_incomplete"`). 덜 찬 유니버스로 제출을 "처리됨" 처리하면 나중에 매핑된 CUSIP은 그 포지션을 영영 못 얻기 때문이다.
# 표식이 선 뒤에 생긴 늦은 매핑(신규 상장 등)의 복구는 `yarn investor-flows:reingest-13f`(docs/reference/CRON.md).
# 부트스트랩을 앞당기려면 cusip-map을 수동 invoke로 여러 번 부른다(락이 겹침을 막는다).
#
# ⚠️ 이 스크립트는 수동 실행이다. deploy 파이프라인 어디서도 자동 호출하지 않는다. 마이그레이션
#    0048(investor_flows_data) 적용과 SSM 키(필요 시 OPENFIGI_API_KEY) 확인 **뒤에** 돌릴 것.
#    생성 직후 수동 invoke로 202가 오는지 확인한다(docs/reference/CRON.md).
#
# 사용법:
#     bash infra/aws/18-investor-flows-crons.sh
#
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/lib-cron.sh"
source "$(dirname "$0")/.env"

REGION="${AWS_REGION:-ap-northeast-2}"
LOG_GROUP=/siglens/app
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

### 1) CRON_SECRET — 04-params.sh가 이미 게시한 값을 읽기만 한다 ###
CRON_SECRET="$(aws ssm get-parameter --name /siglens/CRON_SECRET --with-decryption \
  --query 'Parameter.Value' --output text --region "$REGION")"
[ -n "$CRON_SECRET" ] || { log "ERROR: /siglens/CRON_SECRET is empty — run 04-params.sh first"; exit 1; }

### 2) 공유 Connection(Authorization: Bearer <CRON_SECRET>) ###
ensure_cron_connection "$REGION" "$CRON_SECRET"

# ensure_investor_flows_cron <name> <schedule-expression> <metric-weight>
#   name 하나당 IAM 역할 + API Destination + Rule + target + 실패 로그 메트릭 필터를 만든다.
ensure_investor_flows_cron() {
  local name="$1" schedule="$2" weight="$3"
  local role_name="siglens-${name}-eventbridge"
  local destination_name="siglens-${name}"
  local rule_name="siglens-${name}-schedule"
  local endpoint="https://siglens.io/api/cron/${name}"

  if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
    log "role $role_name exists"
  else
    aws iam create-role --role-name "$role_name" --assume-role-policy-document '{
         "Version":"2012-10-17",
         "Statement":[{"Effect":"Allow","Principal":{"Service":"events.amazonaws.com"},"Action":"sts:AssumeRole"}]
       }' >/dev/null
    log "role $role_name created"
  fi
  aws iam put-role-policy --role-name "$role_name" --policy-name "siglens-${name}-invoke" \
    --policy-document "{
      \"Version\":\"2012-10-17\",
      \"Statement\":[{\"Effect\":\"Allow\",
        \"Action\":\"events:InvokeApiDestination\",
        \"Resource\":\"arn:aws:events:$REGION:$ACCOUNT_ID:api-destination/$destination_name/*\"}]
    }"
  local role_arn
  role_arn="$(aws iam get-role --role-name "$role_name" --query 'Role.Arn' --output text)"

  ensure_api_destination "$REGION" "$destination_name" "$endpoint" "$CONNECTION_ARN"

  aws events put-rule --name "$rule_name" --schedule-expression "$schedule" \
    --state ENABLED --region "$REGION" >/dev/null
  aws events put-targets --rule "$rule_name" --region "$REGION" \
    --targets "[{\"Id\":\"${name}\",\"Arn\":\"$DEST_ARN\",\"RoleArn\":\"$role_arn\",\"HttpParameters\":{\"HeaderParameters\":{},\"QueryStringParameters\":{},\"PathParameterValues\":[]}}]" \
    >/dev/null
  log "rule $rule_name -> $destination_name ready ($schedule)"

  # 실행 실패 — 라우트가 `[<name>] run failed:`를 남긴다. ASCII 접두만 필터에 쓴다(14-kr-tickers-cron.sh와
  # 같은 근거). 로그 그룹이 아직 없으면 `|| true`로 넘어가므로 10-logs.sh 뒤에 이 스크립트를 재실행할 것.
  aws logs put-metric-filter --log-group-name "$LOG_GROUP" \
    --filter-name "siglens-${name}-run-failed" \
    --filter-pattern "\"[${name}] run failed\"" \
    --metric-transformations "metricName=P2Score,metricNamespace=Siglens/Alerts,metricValue=${weight}" \
    --region "$REGION" >/dev/null 2>&1 || log "WARNING: put-metric-filter failed for $name (log group $LOG_GROUP missing?)"

  # 운영 신호 — 전부 라우트가 남기는 ASCII 접두 로그를 필터로 센다(JSON 숫자 추출 없이 건수만). 점수는
  # `siglens-p2` 알람이 합산 평가하므로 한 번은 약하고 **반복되면** 발화한다.
  #   lease held        이전 실행이 스케줄 주기를 넘겨 매달려 있다(락이 풀리지 않는다) — 204로 건너뜀
  #   redis unavailable 락을 못 잡아 실행 자체를 못 한다(fail-closed)
  put_signal_filter "$name" "lease-held" "\"[${name}] lease held\"" 20
  put_signal_filter "$name" "redis-unavailable" "\"[${name}] redis unavailable\"" 50
}

# put_signal_filter <cron> <suffix> <pattern> <weight> — P2Score 가중치로 발행하는 로그 메트릭 필터 하나.
put_signal_filter() {
  local name="$1" suffix="$2" pattern="$3" weight="$4"
  aws logs put-metric-filter --log-group-name "$LOG_GROUP" \
    --filter-name "siglens-${name}-${suffix}" \
    --filter-pattern "$pattern" \
    --metric-transformations "metricName=P2Score,metricNamespace=Siglens/Alerts,metricValue=${weight}" \
    --region "$REGION" >/dev/null 2>&1 || log "WARNING: put-metric-filter ${name}-${suffix} failed"
}

# sec-13f는 데이터 신선도의 핵심이라 가중치 100(1건=즉시 발화), 나머지는 며칠 밀려도 치명적이지 않아 50.
ensure_investor_flows_cron sec-13f     "cron(15 0/2 * * ? *)"      100
ensure_investor_flows_cron finra-short "cron(30 22 ? * MON-FRI *)"  50
ensure_investor_flows_cron cusip-map   "cron(0 3 * * ? *)"          50

# sec-13f 전용 신호: SEC 거절(`stoppedBy: sec_blocked`)이 반복되면 IP가 막혔다는 뜻이라 사람이 봐야 하고(50),
# 시도를 소진한 실패 accession backlog(≥ 50건)는 파싱 결함을 가리킨다(30). 둘 다 ingest13f.ts가 이 접두로 남긴다.
put_signal_filter sec-13f "sec-blocked" '"[sec-13f] sec_blocked"' 50
put_signal_filter sec-13f "failed-backlog" '"[sec-13f] backlog"' 30

# 게이트 정체 알람 — sec-13f는 cusip-map이 전수 한 바퀴를 끝내기 전까지 2시간마다 `[sec-13f] universe_incomplete`를 남긴다.
# 정상 부트스트랩(~5~6일)에는 찍히는 게 당연하므로 점수 필터(P2Score)로 만들지 않고 건수 메트릭 + **7일 연속** 알람으로만 본다
# (알람 평가 범위의 상한이 7일이라 Period 1일 × 7회가 가능한 최대다). 연속 실패하는 심볼이 있으면 부트스트랩이 7일을 넘길 수
# 있는데, 그때의 알람은 "cusip-map이 안 끝나고 있으니 확인하라"는 의도된 신호다(docs/reference/CRON.md).
# 07-alarms.sh와 같은 방식(FILL(m1, 0) 수식 + P2 토픽 siglens-alerts-low; create-topic은 멱등). 알람 지표 무료 10개는 이미 다 쓰고
# 있어 이 알람은 유료다(월 ~$0.1). 필터에는 defaultValue를 붙이지 않는다(07-alarms.sh와 같은 이유).
aws logs put-metric-filter --log-group-name "$LOG_GROUP" \
  --filter-name "siglens-sec-13f-universe-incomplete" \
  --filter-pattern '"[sec-13f] universe_incomplete"' \
  --metric-transformations "metricName=InvestorFlowsUniverseIncomplete,metricNamespace=Siglens/Alerts,metricValue=1" \
  --region "$REGION" >/dev/null 2>&1 || log "WARNING: put-metric-filter sec-13f-universe-incomplete failed"

ALARM_SNS_LOW="${ALARM_SNS_LOW:-$(aws sns create-topic --name siglens-alerts-low --query TopicArn --output text --region "$REGION")}"
UNIVERSE_STALL_METRICS=$(jq -cn '[
  {Id:"m1", MetricStat:{Metric:{Namespace:"Siglens/Alerts", MetricName:"InvestorFlowsUniverseIncomplete"}, Period:86400, Stat:"Sum"}, ReturnData:false},
  {Id:"e1", Expression:"FILL(m1, 0)", Label:"InvestorFlowsUniverseIncomplete", ReturnData:true}
]')
aws cloudwatch put-metric-alarm --alarm-name siglens-investor-flows-universe-stalled \
  --alarm-description 'sec-13f가 7일 연속 universe_incomplete — cusip-map이 전수 한 바퀴를 못 끝내고 있다(정상 부트스트랩은 ~5~6일). 확인: [cusip-map] run done 로그의 candidates/errors/failuresMarked, FMP·OpenFIGI 키·한도. 복구되면 sec-13f가 다음 실행부터 수집한다.' \
  --metrics "$UNIVERSE_STALL_METRICS" --evaluation-periods 7 --datapoints-to-alarm 7 --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching \
  --alarm-actions "$ALARM_SNS_LOW" --region "$REGION"
log "alarm siglens-investor-flows-universe-stalled ready (7 consecutive days of universe_incomplete -> $ALARM_SNS_LOW)"

if [ "$CRON_CONNECTION_AUTHORIZED" != true ]; then
  log "WARNING: cron connection not AUTHORIZED yet — $CRON_RERUN_HINT"
fi

log "investor-flows crons ready — verify each with a manual invoke before trusting the schedule:"
log "  curl -i -X PATCH https://siglens.io/api/cron/sec-13f -H \"Authorization: Bearer \$CRON_SECRET\"  # expect 202 (204 = lock held)"
