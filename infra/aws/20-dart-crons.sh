#!/usr/bin/env bash
#
# infra/aws/20-dart-crons.sh — 한국 DART 지분공시 cron 2종 스케줄 (멱등)
#
# `PATCH /api/cron/{dart-corp-code,dart-filings}`를 EventBridge classic Rule → API Destination으로 호출한다.
# 18·19번과 같은 배선(공유 Connection `siglens-cron`, lib-cron.sh의 ensure_investor_flows_cron)이다.
#
#   cron              스케줄(UTC)                    역할
#   dart-corp-code    cron(0 20 ? * SUN *)           매주 월 05:00 KST — corpCode.xml(zip) 한 건으로 종목코드 → 고유번호 맵 갱신
#   dart-filings      cron(30 0,9 * * ? *)           매일 09:30·18:30 KST — 공시검색(D001·D002·D005) → 새 공시 회사만 대량보유·소유보고
#                                                    재조회 + 거래계획보고서 저장, 남는 호출로 최초 백필(실행당 ≤1,500건)
#
# 두 cron은 **공유 락**(`investor-flows:cron-lock:dart`)을 잡는다 — 한 번에 한 DART cron만 돈다. 시각이 겹치지 않게 잡았고, 겹치면
# 뒤 cron이 204로 건너뛴다. `dart-filings`는 `dart_corp_code`가 비어 있으면 `corp_codes_missing`으로 끝나므로(코드가 순서를 지킨다)
# Rule 생성 직후 `dart-corp-code`를 수동 invoke로 한 번 돌린다.
#
# DART 할당량: 하루 ≈2만 건(`020`). 백필 ≈5,400건(≈2,700사 × 2)은 ≈2일, 이후 하루 수백 건. 일일 호출 수는 Redis 카운터
# (`dart:calls:v1:<KST 날짜>`)가 세고, `020`을 받으면 다음 KST 자정까지 회로 차단(`dart:quota-blocked:v1`)이 선다.
#
# ⚠️ `DART_API_KEY`(SSM `/siglens/DART_API_KEY`)가 없으면 두 cron 모두 요청 0건으로 `disabled`다 — Rule을 먼저 만들어 둬도 해롭지 않다.
#    키 발급 시 **IP 제한을 두지 말 것**(`012` 접근할 수 없는 IP — ASG 인스턴스 IP가 바뀐다).
# ⚠️ 이 스크립트는 수동 실행이다. deploy 파이프라인 어디서도 자동 호출하지 않는다. 마이그레이션 0049와 이 코드의 배포 **뒤에** 돌릴 것.
#
# 사용법:
#     bash infra/aws/20-dart-crons.sh
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

### 3) Rule 2종 — 며칠 밀려도 치명적이지 않아 실패 가중치 50(19번과 같다) ###
ensure_investor_flows_cron dart-corp-code "cron(0 20 ? * SUN *)"   50
ensure_investor_flows_cron dart-filings   "cron(30 0,9 * * ? *)"   50

### 4) 운영 신호 — 클라이언트·수집기가 남기는 ASCII 접두 로그를 건수로 센다(P2Score, `siglens-p2`가 합산) ###
#   [dart] quota_exhausted         DART가 020을 줬다 — 그날 남은 호출이 막혔다(30)
#   [dart] ip_not_allowed          012 — 키에 IP 제한이 걸렸다. OpenDART 인증키 관리에서 해제(50)
#   [dart] quota warning           일일 호출이 한도의 80%에 닿았다 — 백필이 아니면 원인 확인(20)
#   [dart-filings] auth_failed     키가 등록되지 않았거나 사용 중지·만료(010·011·901)(50)
#   [dart-corp-code] rejected      corpCode.xml 상장사 행이 너무 적어 반영하지 않았다 — 형식 변경(30)
put_signal_filter dart-filings "quota-exhausted" '"[dart] quota_exhausted"' 30
put_signal_filter dart-filings "ip-not-allowed" '"[dart] ip_not_allowed"' 50
put_signal_filter dart-filings "quota-warning" '"[dart] quota warning"' 20
put_signal_filter dart-filings "auth-failed" '"[dart-filings] auth_failed"' 50
put_signal_filter dart-corp-code "rejected" '"[dart-corp-code] rejected"' 30

if [ "$CRON_CONNECTION_AUTHORIZED" != true ]; then
  log "WARNING: cron connection not AUTHORIZED yet — $CRON_RERUN_HINT"
fi

log "DART crons ready — run dart-corp-code once, then verify each with a manual invoke:"
log "  curl -i -X PATCH https://siglens.io/api/cron/dart-corp-code -H \"Authorization: Bearer \$CRON_SECRET\"  # expect 202 (204 = DART lease held)"
log "  curl -i -X PATCH https://siglens.io/api/cron/dart-filings -H \"Authorization: Bearer \$CRON_SECRET\"    # expect 202"
