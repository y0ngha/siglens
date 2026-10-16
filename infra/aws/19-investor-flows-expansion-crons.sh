#!/usr/bin/env bash
#
# infra/aws/19-investor-flows-expansion-crons.sh — 수급 확장 cron 2종 스케줄 (멱등)
#
# `PATCH /api/cron/{sec-ftd,reg-sho-threshold}`를 EventBridge classic Rule → API Destination으로 호출한다.
# 18-investor-flows-crons.sh와 같은 배선(공유 Connection `siglens-cron`, lib-cron.sh의 ensure_investor_flows_cron)이다.
#
#   cron                스케줄(UTC)                    역할
#   sec-ftd             cron(50 13 * * ? *)            매일 13:50 — SEC fails-to-deliver 반월 파일(실행당 ≤4개, 처음엔 1년치 24개)
#   reg-sho-threshold   cron(0 5 ? * MON-FRI *)        평일 05:00 — Reg SHO 과열 목록 5종(Nasdaq·NYSE·NYSE American·NYSE Arca·Cboe BZX)
#
# Form 144·증자 공시는 별도 cron이 없다 — 기존 `sec-13f`(18번) 실행 안에서 13F 다음에 남은 시간으로 돈다. 그리고 SEC CIK 맵
# (`company_tickers.json`)은 기존 `cusip-map`(18번)이 주 1회 갱신한다. 그래서 이 스크립트를 돌리지 않아도 그 둘은 배포만으로 켜진다.
#
# SEC 요청 예산: `sec-ftd`는 `sec-13f`와 **공유 락**(`investor-flows:cron-lock:sec`)을 잡는다 — 동시에 한 SEC cron만 돈다.
# 13:50은 `sec-13f`(매 짝수시 15분, 18번) 실행이 보통 끝난 틈이다. 겹치면 락을 못 잡아 204로 건너뛰고 다음 날 다시 돈다(`[sec-ftd]
# lease held`가 며칠 이어지면 13F 실행이 길어졌다는 뜻이다).
# `reg-sho-threshold`는 거래소 서버라 SEC 예산과 무관하고 이름별 락이다. 05:00 UTC는 전 거래일 목록이 모두 게시된 뒤다(Nasdaq ~23:00·
# NYSE ~22:00 ET, Cboe 다음 날 새벽 — 2026-10-15 파일 푸터 실측).
#
# ⚠️ Reg SHO 과열 목록은 거래소 데이터 비상업 전용이다(이슈 #1042). `REG_SHO_THRESHOLD_DATA_ENABLED=false`면 Rule이 있어도 cron이
#    요청 0건으로 끝난다 — 상업화 체크리스트는 `src/shared/api/exchange/regShoThresholdDataEnabled.ts`.
#
# 순서는 코드가 지킨다 — 두 cron 모두 cusip-map 전수 한 바퀴 표식(`cusip_map_full_pass_done`) 전에는 `universe_incomplete`로 끝난다.
#
# ⚠️ 이 스크립트는 수동 실행이다. deploy 파이프라인 어디서도 자동 호출하지 않는다. 마이그레이션 0049(investor_flows_expansion) 적용과
#    그 코드의 배포 **뒤에** 돌릴 것(라우트가 없으면 404가 실패 메트릭으로 쌓인다). 생성 직후 수동 invoke로 202가 오는지 확인한다.
#
# 사용법:
#     bash infra/aws/19-investor-flows-expansion-crons.sh
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

### 3) Rule 2종 — 둘 다 며칠 밀려도 치명적이지 않아 실패 가중치 50(18번의 finra-short·cusip-map과 같다) ###
ensure_investor_flows_cron sec-ftd           "cron(50 13 * * ? *)"      50
ensure_investor_flows_cron reg-sho-threshold "cron(0 5 ? * MON-FRI *)"  50

### 4) 운영 신호 — 라우트·수집기가 남기는 ASCII 접두 로그를 건수로 센다(P2Score, `siglens-p2`가 합산) ###
#   [sec-ftd] sec_blocked          SEC 거절(403·429) — 반복되면 IP가 막혔다(50)
#   [sec-ftd] trailer mismatch     파일 trailer(행 수·합계)가 안 맞아 저장하지 않았다 — 형식 변경을 가리킨다(30)
#   [sec-filings] sec_blocked      sec-13f 안의 Form 144·증자 공시 단계가 SEC 거절로 멈췄다(50)
#   [sec-filings] backlog          시도를 소진한 Form 144·424B5 문서가 50건 이상 — 파싱 결함을 가리킨다(30)
#   [sec-filings] cik_map_empty    CIK 맵이 비어 공시 단계가 매번 건너뛰었다 — cusip-map의 주간 갱신을 확인(20)
put_signal_filter sec-ftd "sec-blocked" '"[sec-ftd] sec_blocked"' 50
put_signal_filter sec-ftd "trailer-mismatch" '"[sec-ftd] trailer mismatch"' 30
put_signal_filter sec-13f "filings-sec-blocked" '"[sec-filings] sec_blocked"' 50
put_signal_filter sec-13f "filings-backlog" '"[sec-filings] backlog"' 30
put_signal_filter sec-13f "filings-cik-map-empty" '"[sec-filings] cik_map_empty"' 20

if [ "$CRON_CONNECTION_AUTHORIZED" != true ]; then
  log "WARNING: cron connection not AUTHORIZED yet — $CRON_RERUN_HINT"
fi

log "investor-flows expansion crons ready — verify each with a manual invoke before trusting the schedule:"
log "  curl -i -X PATCH https://siglens.io/api/cron/sec-ftd -H \"Authorization: Bearer \$CRON_SECRET\"            # expect 202 (204 = SEC lease held)"
log "  curl -i -X PATCH https://siglens.io/api/cron/reg-sho-threshold -H \"Authorization: Bearer \$CRON_SECRET\"  # expect 202"
