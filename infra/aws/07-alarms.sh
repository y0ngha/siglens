#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
# SNS 알림 토픽(idempotent: 이미 있으면 기존 ARN 반환).
# 2026-06-28 인시던트: 알람들이 ALARM_SNS 미설정으로 AlarmActions=[] 상태였고, 디스크
# 100% 도달이 아무 알림 없이 조용히 진행됐다. 토픽 생성을 스크립트에 내장해 "액션 없는
# 알람"을 구조적으로 차단한다. 외부에서 ALARM_SNS를 주입하면 그것을 우선 사용한다.
ALARM_SNS="${ALARM_SNS:-$(aws sns create-topic --name siglens-alerts --query TopicArn --output text)}"
# 이메일 구독(idempotent). ALARM_EMAIL(.env)이 있으면 구독 — confirm 메일 클릭 후 활성화된다.
[[ -n "${ALARM_EMAIL:-}" ]] && aws sns subscribe --topic-arn "$ALARM_SNS" --protocol email \
  --notification-endpoint "$ALARM_EMAIL" >/dev/null 2>&1 || true
# 저순위 알림 토픽. P1과 분리해 **구독을 따로 걸 수 있게** 한다.
#
# ⚠️ 기본 구독 대상은 `ALARM_EMAIL`이다. 처음엔 `ALARM_EMAIL_LOW`만 봤는데, 그 키는
# `.env.example`에도 README에도 없어서 실제로는 아무도 설정하지 않았고 — P2 알람
# 20여 개가 **구독자 0명인 토픽으로** 발동하고 있었다. 2026-06-28 디스크 인시던트
# (AlarmActions=[]로 조용히 진행)와 구조적으로 같은 실패다. 다른 주소로 받고 싶을
# 때만 `ALARM_EMAIL_LOW`로 덮어쓴다.
ALARM_SNS_LOW="${ALARM_SNS_LOW:-$(aws sns create-topic --name siglens-alerts-low --query TopicArn --output text)}"
LOW_EMAIL="${ALARM_EMAIL_LOW:-${ALARM_EMAIL:-}}"
[[ -n "$LOW_EMAIL" ]] && aws sns subscribe --topic-arn "$ALARM_SNS_LOW" --protocol email \
  --notification-endpoint "$LOW_EMAIL" >/dev/null 2>&1 || true

# ── 알람 2단 체계 + 점수 합산 (CloudWatch 무료 티어 맞춤) ─────────────────────
#
# 2026-08 정리: 알람 30개가 전부 한 토픽으로, 전부 `--ok-actions`까지 달려 있었다.
# 발동 1회당 메일 2통이고, `siglens-cpu-credits-low` 하나가 14일간 14회(=28통) —
# **배포할 때마다** 울렸다. 새 t4g 인스턴스는 크레딧 0에서 시작하므로 구조적으로
# 피할 수 없는 오탐이었고, 그 노이즈가 진짜 알람을 묻었다.
#
#   P1  지금 당장 봐야 하는 것. 사이트가 죽었거나 죽기 직전. ALARM + OK 양방향.
#   P2  degrade. 오늘 중 보면 되는 것. **ALARM만** — 복구 알림은 보내지 않는다.
#
# 판정 기준: "이 알람을 받고 지금 하던 일을 멈출 것인가?" 아니면 P2다.
P1="--alarm-actions $ALARM_SNS --ok-actions $ALARM_SNS"
P2="--alarm-actions $ALARM_SNS_LOW"

# 2026-10 무료 티어 통합: 알람 40개·커스텀 메트릭 20여 개가 무료 티어(알람 지표 10개,
# 커스텀 메트릭 10개)를 크게 넘어 유료였다. 원인별 알람 30개를 **점수 알람 2개**로 합쳤다.
#
#   원인별 로그 메트릭 필터 → 같은 메트릭 `Siglens/Alerts P1Score` / `P2Score`로 발행,
#   metricValue = 원인별 가중치. 알람은 그 합계가 100 이상일 때 발화한다.
#     - 단독으로 사이트를 죽이는 원인 = 100 → 1건이면 즉시 발화.
#     - 단발 blip이면 안 되는 원인 = 100 미만 → 같은 창에서 누적돼야 발화
#       (예: analysis-stream 34점 = 5분에 3건, agent-stream 25점 = 5분에 4건).
#     - 가중치는 "그 원인이 한 창에 실제로 낼 수 있는 최대 건수"로 검산한다. 예: prewarm은 5분
#       tick이라 15분 창에 최대 3회 → 3회로 100에 닿으려면 34점 이상이어야 한다.
#   여러 필터가 같은 메트릭에 쓰는 건 허용된다(값이 합산된다).
#   원인 분리는 알람이 아니라 Logs Insights로 한다(아래 쿼리 — DEPLOY_RUNBOOK §3에도 동일).
#
# ⚠️ 예전 임계(`15분 2건 연속 2주기` 같은 시간축 조건)는 점수 합계 한 개로 환원되며 일부
#    의미가 달라졌다 — 개별 임계를 되살리려면 알람을 늘리지 말고 가중치를 조정할 것.
#
# ── P1 가중치 ────────────────────────────────────────────────────────────────
#   [cloudflared-down]=100  [selfcheck]=100  JavaScript heap out of memory=100
#   trader `[cron:` … `failed`=100 (siglens-trader provision.sh, 로그 그룹 /siglens-trader/app)
#   [analysis-stream] failed=34  [agent] quota store unavailable=50  [agent-stream] failed=25
# ── P2 가중치 ────────────────────────────────────────────────────────────────
#   config-signal=100  kr-tickers sync failed=100  agent busy=100  agent web-search budget=100
#   seed-bars=20  ISR S3 failures=20  ISR tag failures=20  redis cache failures=10
#   market-data-loader=25  prewarm batch failed=34  prewarm deadline=34  prewarm unit-error/timeout=5
#
# ── 원인 조회 Logs Insights 쿼리 (런북에 복사해 쓴다) ─────────────────────────
# P1 (로그 그룹 /siglens/app 과 /siglens-trader/app 을 함께 선택):
#   fields @timestamp, @message
#   | filter @message like /failed|cloudflared-down|selfcheck|heap out of memory|quota store unavailable/
#   | parse @message /(?<cause>\[cloudflared-down\]|\[selfcheck\]|JavaScript heap out of memory|\[cron:[^\]]*\]|\[analysis-stream\] failed|\[agent-stream\] failed|\[agent\] quota store unavailable)/
#   | filter ispresent(cause)
#   | stats count() as n by cause
#   | sort n desc
# P2 (로그 그룹 /siglens/app):
#   fields @timestamp, @message
#   | parse @message /(?<cause>getSeedBarsStatic failed|\[isr-cache\] s3 get failed|\[isr-cache\] s3 set failed|\[isr-cache\] tag sync failed|\[isr-cache\] tag publish failed|\[isr-cache\] tag prune failed|\[getOrSetCache\] get failed|\[getOrSetCache\] set failed|getMarketFearGreedStatic failed|getMarketFearGreedKrStatic failed|getMarketFearGreedCryptoStatic failed|\[MarketContent:kr\]|\[seo-prewarm\] unit-error|\[seo-prewarm\] unit-timeout|\[seo-prewarm\] batch failed|\[seo-prewarm\] batch deadline reached|NAVER_CLIENT_ID\/SECRET|non-OK response|\[KR_EQUITY_SESSION\]|\[seo-prewarm\] redis unavailable|\[kr-tickers\] sync failed|\[agent\] busy|\[agent\] web search budget exhausted)/
#   | filter ispresent(cause)
#   | stats count() as n by cause
#   | sort n desc
#
# ── 메트릭 결측과 FILL ───────────────────────────────────────────────────────
# 로그 메트릭 필터는 매칭되는 줄이 있을 때만 값을 발행한다. 그래서 장애가 **끝나면**
# 로그가 멎고 데이터포인트가 사라지는데, 그러면 알람이 마지막 평가(ALARM)에 고착된다.
# `--treat-missing-data notBreaching`도 이걸 못 푼다 — 이미 ALARM인 알람을 OK로
# 되돌리려면 새 데이터포인트가 있어야 하기 때문이다.
#
# 2026-08-20 실측: DeepSeek 402가 08:51에 멎은 뒤 `siglens-seo-prewarm-unit-error`가
# 9시간 45분 전 데이터포인트를 계속 인용하며 ALARM에 머물렀다. 수동으로 OK를 넣어도
# CloudWatch가 재평가하며 같은 옛 데이터로 다시 ALARM을 만들었다.
#
# 그 대응으로 모든 필터에 `defaultValue=0`을 붙였는데, 이게 **과금 원인**이었다:
# defaultValue=0은 매칭이 없는 구간에도 매 시간 0을 발행하므로 필터마다 커스텀 메트릭
# 1개가 한 달 내내 청구됐다(20개). 이제 필터에서 `defaultValue`를 **빼고**(매칭이 있을
# 때만 발행), 결측 처리는 알람 쪽에서
# 메트릭 수식 `FILL(m1, 0)`으로 한다. FILL은 결측 구간을 0으로 채워 평가하므로
# 장애 종료와 함께 알람이 스스로 OK로 돌아온다(defaultValue와 같은 효과, 발행 없음).
# 알람은 수식에 들어간 **메트릭 개수**로 과금된다(m1 하나 = 1) — 수식 자체는 세지 않는다.
# 합성(composite) 알람은 별도 요금이라 쓰지 않는다.

# put_alert_filter <필터명> <패턴> <P1|P2> <가중치> — /siglens/app 로그 필터를 점수 메트릭에 연결.
# 메트릭 이름은 P1Score / P2Score 고정. defaultValue는 의도적으로 넣지 않는다(위 설명).
put_alert_filter() {
  aws logs put-metric-filter --log-group-name /siglens/app \
    --filter-name "$1" --filter-pattern "$2" \
    --metric-transformations "metricName=${3}Score,metricNamespace=Siglens/Alerts,metricValue=$4"
}

# put_fill_alarm <알람명> <네임스페이스> <메트릭> <period초> <평가횟수> <임계> <비교연산자> <설명> [알림 옵션...]
# 단일 로그 메트릭을 Sum으로 집계하고 FILL(m1, 0)으로 결측을 0으로 채워 평가한다.
put_fill_alarm() {
  local name="$1" ns="$2" metric="$3" period="$4" evals="$5" threshold="$6" op="$7" desc="$8"
  shift 8
  local metrics
  metrics=$(jq -cn --arg ns "$ns" --arg metric "$metric" --argjson period "$period" '[
    {Id:"m1", MetricStat:{Metric:{Namespace:$ns, MetricName:$metric}, Period:$period, Stat:"Sum"}, ReturnData:false},
    {Id:"e1", Expression:"FILL(m1, 0)", Label:$metric, ReturnData:true}
  ]')
  aws cloudwatch put-metric-alarm --alarm-name "$name" --alarm-description "$desc" \
    --metrics "$metrics" --evaluation-periods "$evals" --threshold "$threshold" \
    --comparison-operator "$op" --treat-missing-data notBreaching "$@"
}

# ── P1 점수 필터 ─────────────────────────────────────────────────────────────

# 터널이 죽으면 사이트 전체가 죽는다 — 대체 인그레스가 없다.
#
# 2026-08 ALB 제거로 `siglens-alb-5xx`·`siglens-unhealthy-targets`가 사라졌다. 그 자리를
# 온박스 신호가 메운다: `user-data.sh`의 `siglens-selfcheck.timer`가 60초마다 터널과 앱을
# 확인해 `/var/log/siglens-ops.log`에 찍고, CloudWatch 에이전트가 그 파일을 이 로그
# 그룹으로 보낸다(스트림 `<instance-id>-ops`).
#
# ⚠️ 이 스크립트는 더 이상 `.ids`의 `ALB_ARN`/`TG_ARN`을 읽지 않는다. lib.sh가
#    `set -u`라 없는 변수를 참조하면 **첫 알람을 만들기도 전에** 스크립트가 죽는다.
put_alert_filter siglens-tunnel-down '"[cloudflared-down]"' P1 100

# selfcheck가 인스턴스를 Unhealthy로 표시했다 = ASG가 교체를 시작했다. 한 번은 정상
# 복구 절차지만 반복되면 크래시 루프다.
put_alert_filter siglens-app-unhealthy '"[selfcheck]"' P1 100

# Node 힙 고갈 — worker 제거 이후 새로 생긴 실패 모드.
#
# LLM 호출이 앱 프로세스 안에서 돌면서 요청당 bars+지표+프롬프트를 들고 있게 됐다.
# `user-data.sh`가 Node 힙을 컨테이너 리밋보다 낮게 잡아 뒀으므로, 한계에 닿으면
# 커널 OOM killer가 조용히 죽이는 대신 Node가 이 문자열을 stderr에 남기고 종료한다
# (awslogs 드라이버가 CloudWatch로 보낸다). systemd가 재시작하지만 진행 중이던
# 분석은 전멸하므로, 한 번이라도 뜨면 신호다. 정상 운영에선 절대 안 나온다.
put_alert_filter siglens-node-heap-oom '"JavaScript heap out of memory"' P1 100

# 분석 스트림 실패 — heartbeatStream.ts reject 핸들러가 '[analysis-stream] failed:'를
# 남긴다. SSE는 항상 HTTP 200을 반환하므로 5xx로는 분석 전면 장애를 포착할 수 없다 —
# 이 로그가 유일한 서버사이드 신호다. 게이트 거부(BYOK/tier)는 `gate-denied`로 분리
# 로깅해 이 지표에 안 섞인다. 34점 = 5분에 3건 이상이면 발화(단발 실패는 걸러진다).
# 필터 패턴은 ASCII만 쓴다(CloudWatch Logs 필터는 non-ASCII 리터럴을 못 맞춘다 —
# 13-seo-prewarm.sh §FIX F 참조).
put_alert_filter siglens-analysis-stream-failed '"[analysis-stream] failed"' P1 34

# SiglensAI 에이전트 턴 실패. 마커는 stream/route.ts의 '[agent-stream] failed:'
# (catch-all: 락 획득 후의 모든 미처리 예외가 여기로 떨어진다). 25점 = 5분에 4건.
# 평소 트래픽은 5분에 몇 턴 수준이라(agent-spend 기준선 ~200턴/일) 10건 같은 임계는
# 전면 장애에서도 닿지 않는다.
put_alert_filter siglens-agent-stream-failed '"[agent-stream] failed"' P1 25

# 에이전트 한도 스토어(Redis) 불가 — turnLock.ts가 카운터 스토어 접근 실패 시 찍는
# 마커. fail-closed라 사용자에겐 server_busy(409)로만 보인다 — 이 로그가 유일한 신호.
# 50점 = 5분에 2건. fail-closed라 장애 중엔 모든 턴이 실패하지만 평소 턴 수가 5분에 몇 건이라
# 그 이상을 요구하면 실제 장애에서도 울리지 않는다.
put_alert_filter siglens-agent-quota-store-unavailable '"[agent] quota store unavailable"' P1 50

# (trader) `[cron:*] failed` = 100 은 siglens-trader 레포 infra/aws/provision.sh가
# /siglens-trader/app 로그 그룹에 같은 메트릭(Siglens/Alerts P1Score)으로 건다.

# ── P2 점수 필터 ─────────────────────────────────────────────────────────────

# ISR 캐시 fail-open 가시성: s3Store의 '[isr-cache] s3 get/set failed' 로그를 메트릭으로.
# fail-open이라 S3 perms/버킷/IMDS가 깨져도 캐시가 조용히 죽을 뿐 알람이 없다 — 이를 잡는다.
# '?"a" ?"b"' 는 CloudWatch Logs 필터 OR 문법: a 또는 b를 포함하는 줄만 카운트.
# 실패 로그(get/set failed)만 대상 — 정상 [isr-cache] 로그(hit/miss 등)는 제외.
# ISR 외부화(S3) 이후 디스크가 다시 오르면 캐시 외부화가 조용히 실패한 것이기도 하다.
put_alert_filter siglens-isr-cache-failures '?"[isr-cache] s3 get failed" ?"[isr-cache] s3 set failed"' P2 20

# 태그 스토어(tagStore.mjs) fail-open 가시성 — 위 s3 필터와 리터럴이 다르다:
# 로그는 '[isr-cache] tag sync|publish|prune failed'라 위 필터에 안 걸린다.
# 태그 동기화가 죽으면 다른 인스턴스의 무효화를 놓쳐 stale HTML을 revalidate TTL(6~24h)
# 동안 서빙한다. 조용히 degrade하므로 알람이 유일한 신호다. tagStore는 스코프당 60초
# 스로틀이라 완전 장애여도 줄 수가 적다 — 같은 20점이어도 누적 속도가 느리다는 점을 감안.
put_alert_filter siglens-isr-tag-failures '?"[isr-cache] tag sync failed" ?"[isr-cache] tag publish failed" ?"[isr-cache] tag prune failed"' P2 20

# RSC seed 헬퍼(getSeedBarsStatic) 실패 가시성.
#
# `/[symbol]` 전 라우트의 bars/지표 seed를 이 헬퍼가 만든다. 실패하면 `.catch(→null)`로
# fail-open해서 **HTTP 200에 로그 한 줄만** 남는다 — 차트·팩트레이어가 조용히 비어도
# 어떤 알람도 울리지 않는다. 세 호출부가 같은 문자열을 남긴다(접두사만 다르므로
# 부분 문자열로 매칭한다):
#   [SymbolLayout] getSeedBarsStatic failed:
#   [SymbolPage] getSeedBarsStatic failed:
#   [FearGreedPage] getSeedBarsStatic failed:
put_alert_filter siglens-seed-bars-failed '"getSeedBarsStatic failed"' P2 20

# Redis(Upstash) read-through 캐시 실패 가시성.
#
# FETCH 엔트리가 S3에서 빠지면서 **Redis가 인스턴스 간 유일한 FMP 방어선**이 됐다.
# memStore는 프로세스 로컬이라 컨테이너 재시작마다 비어 있다. 따라서 Upstash 장애
# (플랜 한도, 토큰 회전, 스로틀)는 곧바로 FMP 쿼터 소진과 429로 이어지고, 지금은
# 청구서를 보기 전까지 아무도 모른다. getOrSetCache는 키마다 로그를 남기므로(스로틀
# 없음) 가중치를 낮게(10) 잡았다.
put_alert_filter siglens-redis-cache-failures '?"[getOrSetCache] get failed" ?"[getOrSetCache] set failed"' P2 10

# 에이전트 용량 초과(busy) — 인스턴스 하나가 새 분석 동시 실행 상한(10) 또는 에이전트 턴
# 동시 상한(4)·분석 스트림 슬롯에 걸려 요청을 거절했다. 마커는 `[agent] busy`
# (tools/runFreshAnalysis.ts의 AGENT_BUSY_LOG, stream/route.ts 용량 게이트). 사용자에겐
# "지금 혼잡"으로만 보이므로 1건이라도 나면 알린다. 사용자별 턴 락(409)은 한 사람의
# 중복 전송이라 마커를 찍지 않는다. P2: 사이트 다운이 아니라 증설 신호.
put_alert_filter siglens-agent-busy '"[agent] busy"' P2 100

# 공용 웹 검색 예산 소진 — core runAgentTurn이 AGENT_GLOBAL_LIMITS(Brave 무료 요금제:
# 하루 33회·월 1,000회)에 막히면 `[agent] web search budget exhausted`({scope})를 찍는다.
# 그 뒤로 그날/그달은 모든 사용자의 웹 검색이 거절된다. 운영자가 Brave 유료 전환을
# 판단하는 신호라 1건이라도 나면 알린다. P2: 답변은 계속 나간다.
put_alert_filter siglens-agent-web-search-budget '"[agent] web search budget exhausted"' P2 100

# 시장 데이터 로더 실패 (US/KR/crypto fear-greed + KR 대시보드 통합).
#
# 넷 다 fail-open 설계라 알람 없이는 아무 신호가 없다. OR 패턴으로 네 로그 접두 중
# 하나라도 매치하면 카운트한다:
#   - `[FearGreedRoute] getMarketFearGreedStatic failed` — `/fear-greed`. 로더
#     예외를 삼키고 200 + "표본이 부족합니다"를 렌더한다(0바이트 ISR 캐시 동결
#     방지). FMP 402/403처럼 재시도 대상이 아닌 오류면 매시 재생성이 똑같이
#     실패해 **영구히 빈 페이지**가 된다 — 5xx도, 헬스체크 실패도 안 뜬다.
#     실패 1회당 로그 2줄(`generateMetadata` + 본문이 각각 catch).
#   - `[FearGreedKrRoute] getMarketFearGreedKrStatic failed` — `/fear-greed/kr`.
#     yahoo가 무인증이라 429가 주 원인, KRX ETF 상장폐지도 같은 증상.
#   - `[FearGreedCryptoRoute] getMarketFearGreedCryptoStatic failed` —
#     `/fear-greed/crypto`. US와 같은 FMP fail-open 구조(21개 심볼, 실패당 로그 2줄).
#   - `[MarketContent:kr]` — `/market/kr`. 지수 3 + ETF 6 + 종목 20을 무인증
#     yahoo로 긁고(리필당 49회), 실패하면 빈 배열로 fail-open해서 canonical
#     null + noindex가 ISR에 굳는다.
# 25점: US·crypto는 실패 1회가 로그 2줄이라 50점 → 15분 안에 두 라우트(또는 같은 라우트 2회)가
# 실패하면 발화한다. 네 페이지는 약 1시간마다 재생성되므로 한 15분 창에 나올 수 있는 실패는
# 많아야 4회다 — 그 이상을 요구하는 가중치는 전부 실패해도 울리지 않는다.
put_alert_filter siglens-market-data-loader-failed '?"[FearGreedRoute] getMarketFearGreedStatic failed" ?"[FearGreedKrRoute] getMarketFearGreedKrStatic failed" ?"[FearGreedCryptoRoute] getMarketFearGreedCryptoStatic failed" ?"[MarketContent:kr]"' P2 25

# 설정/자격증명 신호 (네이버 뉴스 + KR 캘린더 지평선 + prewarm redis 통합).
# "발생 자체가 이상 신호"라 1건=100점.
#
# **필터 패턴은 ASCII만 쓴다.** CloudWatch metric filter는 non-ASCII 리터럴을
# 매칭하지 못한다(FIX F — `infra/aws/13-seo-prewarm.sh`, `docs/reference/CRON.md`).
#   - `NAVER_CLIENT_ID/SECRET` / `non-OK response` — `/news/kr`의 유일한 소스인
#     네이버 뉴스 API. 키가 비거나 구독이 만료되면 빈 피드 + noindex가 굳는다.
#   - `[KR_EQUITY_SESSION]` — `KR_CALENDAR_HORIZON`(현재 2026-12-31) 만료.
#     넘으면 모든 날을 정상 개장으로 보고 `console.warn`만 남긴다. 그 값이
#     대시보드 캐시 TTL과 `/fear-greed/kr` 사이트맵 lastmod를 끌고 간다.
#   - `[seo-prewarm] redis unavailable` — 야간 prewarm 락 획득 실패(미구성 또는
#     Upstash 장애/타임아웃). route.ts가 2xx를 반환해 EventBridge
#     FailedInvocations도 batch-failed 로그도 안 남는 사각지대라 이 필터가
#     유일한 신호다.
put_alert_filter siglens-config-signal '?"NAVER_CLIENT_ID/SECRET" ?"non-OK response" ?"[KR_EQUITY_SESSION]" ?"[seo-prewarm] redis unavailable"' P2 100

# (seo-prewarm 3개 · kr-tickers 1개 필터는 각각 13-seo-prewarm.sh / 14-kr-tickers-cron.sh가
#  같은 Siglens/Alerts P2Score로 건다: batch failed=34, deadline=34, unit-error/timeout=5,
#  kr-tickers sync failed=100.)
#
# ⚠️ 실행 순서: 07 → 13 → 14 → (trader) provision.sh. 07이 옛 알람을 지우므로 13·14·trader가
#    필터를 P1/P2Score로 옮기기 전까지는 그 원인들이 어떤 알람에도 안 걸린다. 반대로 trader
#    provision.sh를 먼저 돌리면 siglens-p1이 생기기 전까지 trader cron 실패가 무알람이다.
#
# ⚠️ 점수 알람은 원인별로 따로 울리지 않는다. P2가 ALARM인 동안 다른 원인이 더해져도 새 메일이
#    없고, 한 창이 조용히 지나 OK로 돌아간 뒤에야 다시 알린다. 메일 한 통을 "원인 하나"로
#    읽지 말고 Logs Insights로 그 시간대 원인을 모두 확인할 것.

# ── 점수 알람 2개 ────────────────────────────────────────────────────────────
P1_DESC='P1 점수 합계(5분) 100 이상. 원인별 가중치: tunnel-down([cloudflared-down])=100, app-unhealthy([selfcheck])=100, node-heap-oom=100, trader cron 실패([cron:*] failed)=100, agent-quota-store-unavailable=50, analysis-stream failed=34, agent-stream failed=25. 약한 원인은 같은 5분에 누적돼 100을 넘을 때만 발화. 원인은 Logs Insights로: /siglens/app(trader는 /siglens-trader/app)에서 위 마커를 parse해 cause별 stats count; 상세 쿼리는 DEPLOY_RUNBOOK §3'
put_fill_alarm siglens-p1 Siglens/Alerts P1Score 300 1 100 GreaterThanOrEqualToThreshold "$P1_DESC" $P1

P2_DESC='P2 점수 합계(15분) 100 이상. 원인별 가중치: config-signal(naver/kr-calendar/prewarm-redis)=100, kr-tickers sync failed=100, agent busy=100, agent web-search budget=100, seo-prewarm batch failed=34, seo-prewarm deadline=34, market-data-loader(fear-greed us/kr/crypto+market-kr)=25, seed-bars=20, ISR S3 실패=20, ISR tag 실패=20, redis cache 실패=10, seo-prewarm unit-error/timeout=5. 원인은 Logs Insights로: /siglens/app에서 위 마커를 parse해 cause별 stats count; 상세 쿼리는 DEPLOY_RUNBOOK §3'
put_fill_alarm siglens-p2 Siglens/Alerts P2Score 900 1 100 GreaterThanOrEqualToThreshold "$P2_DESC" $P2

# ── 인프라 지표 알람 ─────────────────────────────────────────────────────────

# 증설 필요 신호 (오토스케일을 놓치지 않기 위한 알람).
#
# 2026-10 target-tracking 정책(`siglens-tt-cpu`)을 폐기했다(08-scaling.sh 참조). 지금 ASG는
# 로드밸런싱이 아니라 배포 교체 장치로만 쓰인다. 용량 부족은 이 알람이 P1로 알리고,
# 운영자가 `set-desired-capacity`로 직접 늘린다.
#
# t4g.medium baseline이 20%이므로 25%를 15분 지속하면 (a) baseline 초과로 크레딧을
# 태우고 있고 (b) 관측된 최대치보다 확실히 높다 = 용량이 부족하다는 뜻이다.
# 임계 근거(2026-08-19 재측정, ASG 차원 5분 평균 4일치 1,152포인트):
#   p50 6.0 / p90 9.2 / p95 10.4 / p99 13.6 / max 22.6
#   25% 초과 0회, 25% 연속 초과 최대 0분.
# 즉 3주기(15분) 연속 25% 초과는 배포·SSM 작업 같은 단발 스파이크로는 도달할 수 없다.
aws cloudwatch put-metric-alarm --alarm-name siglens-capacity-needed --namespace AWS/EC2 \
  --alarm-description 'EC2(ASG) CPU 평균 25% 초과가 15분(5분x3) 지속 = t4g.medium baseline(20%) 초과로 크레딧을 태우는 용량 부족 신호. 원인 후보: 부하 증가, 크래시 루프 후 재시도 폭주. 조치: 먼저 SSM으로 프로세스 확인, 정말 부하면 aws autoscaling set-desired-capacity로 수동 증설(target-tracking 정책은 폐기됨, 08-scaling.sh).' \
  --metric-name CPUUtilization --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 25 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1

# 디스크: 로그로테이션/캐시 증가 고려, 가득참 전 여유.
# ISR 외부화(S3) 이후 디스크가 다시 오르면 캐시 외부화가 조용히 실패한 것 — 회귀 카나리 역할.
# ASG 집계 시리즈({AutoScalingGroupName})만 본다. CWAgent는 원본 시리즈
# ({path,device,fstype,...})도 함께 발행하는데, 부팅 설정(user-data.sh)을 건드리는 위험에 비해
# 절감이 커스텀 메트릭 1개라 그대로 둔다(무료 티어 안이다).
aws cloudwatch put-metric-alarm --alarm-name siglens-disk-high --namespace CWAgent \
  --alarm-description '루트 디스크 사용률 85% 초과 2주기(10분). 원인 후보: ISR 캐시 외부화(S3) 조용한 실패 후 로컬 누적, docker 이미지/로그 누적. 확인: SSM 접속 후 df -h, docker system df, [isr-cache] 로그(P2 점수 필터 참고).' \
  --metric-name disk_used_percent --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Maximum --period 300 --evaluation-periods 2 --threshold 85 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1

# 메모리. 옛 `siglens-mem-high`(90%, P2)와 `siglens-capacity-needed-mem`(60%, P1)을 80% 하나로
# 합쳤다(커스텀 메트릭이 아니라 알람 지표 1개 절감). 실측 max 40.1%(p99 33.7%)라 80%는
# 평소에 닿을 수 없고 OOM 전 여유가 있으며, 60% 증설 신호의 역할도 흡수한다.
aws cloudwatch put-metric-alarm --alarm-name siglens-mem-high --namespace CWAgent \
  --alarm-description '메모리 사용률 80% 초과 3주기(15분). 구 mem-high(90)와 capacity-needed-mem(60) 병합. 원인 후보: 요청당 bars+지표+프롬프트 적재로 힙 증가, 메모리 누수, 동시 분석 폭주(OOM 직전). 조치: 힙 OOM 로그([node-heap-oom] P1 점수) 확인, 필요하면 set-desired-capacity로 증설.' \
  --metric-name mem_used_percent --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 80 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1

# 에이전트 출력 토큰 일 1M 초과(기본 모델 200턴의 ~5배). `[Usage]`가 순수 JSON
# ({"tag":"[Usage]","jobId":"agent",...})이라 JSON 필터가 매치한다 — core의 분석 경로
# `[Usage]` 라인은 `console.info('[Usage]', json)` 2-인자 포맷(줄 앞에 순수 텍스트가
# 붙어 JSON 파싱 대상이 아님)이라 이 필터엔 안 걸린다. 의도된 동작: 이 알람은 에이전트만 센다.
#
# 이 지표는 `jobId: 'agent'`를 실제로 찍는 단일 호출부(현재
# `src/entities/llm-provider/api/agent/deepseek.ts`)에만 의존한다.
# fallback 프로바이더를 추가할 때(스펙 §13) 그 어댑터가 `logUsage`에
# `jobId: 'agent'`를 넘기지 않으면, 이 필터는 에러 없이 그냥 매치가 줄어들 뿐이고
# FILL(0) + `notBreaching` 조합상 "지출이 0으로 줄었다"가 아니라 "지표 자체가 죽었다"로
# 조용히 읽힌다 — 새/fallback 어댑터는 반드시 `jobId: 'agent'`로 `[Usage]`를 남기게 하라.
#
# 주의: period가 86400(1일)이라 이 알람은 지출이 발생한 시점으로부터 최대 ~24시간 뒤에야
# 발화할 수 있다 — 즉각 반응하는 알람이 아니다. 급한 대응이 필요하면 이 알람을 기다리지
# 말고 킬 스위치(`AGENT_CHAT_DISABLED=1`, DEPLOY_RUNBOOK.md §3.5)를 먼저 쓴다.
#
# 이 필터는 점수 필터가 아니라 **JSON 값 추출**($.outputTokens)이라 가중치 대신 실제 토큰 수를
# 발행한다. defaultValue는 위 FILL 설명대로 뺐다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-agent-output-tokens \
  --filter-pattern '{ $.tag = "[Usage]" && $.jobId = "agent" }' \
  --metric-transformations metricName=AgentOutputTokens,metricNamespace=Siglens/Agent,metricValue='$.outputTokens'
AGENT_SPEND_DESC='에이전트(SiglensAI) 일일 출력 토큰 합계 1,000,000 초과(기본 모델 200턴의 약 5배, DeepSeek 비용 폭주 신호). period 1일이라 최대 24시간 지연 발화. 원인 조회: Logs Insights에서 filter tag = "[Usage]" and jobId = "agent" | stats sum(outputTokens) by bin(1h). 급하면 킬 스위치 AGENT_CHAT_DISABLED=1 (DEPLOY_RUNBOOK §3.5).'
put_fill_alarm siglens-agent-spend Siglens/Agent AgentOutputTokens 86400 1 1000000 GreaterThanThreshold "$AGENT_SPEND_DESC" $P1

# ── RDS (15-rds.sh) ──────────────────────────────────────────────────────────
#
# 운영 DB가 Neon에서 RDS(db.t4g.small, Single-AZ)로 옮겨 왔다. Neon은 컴퓨트·스토리지를
# 알아서 늘렸지만 RDS는 **우리가 지켜봐야 한다**. 지표는 전부 AWS/RDS 네임스페이스의 무료
# 기본 지표라 추가 커스텀 메트릭 비용이 없다. 인스턴스가 아직 없어도 알람은 만들어진다
# (데이터가 없는 동안 INSUFFICIENT_DATA).
#
# 2026-10 통합: 4개 알람(free-storage / connections / freeable-memory / cpu-credits-low)을
# 메트릭 수식 알람 1개로 합쳤다. 세 조건 중 하나라도 걸리면 1, 아니면 0을 더해 >=1이면
# 발화한다(알람 지표 3개 과금). `rds-cpu-credits-low`는 Unlimited 모드라 느려지지 않고
# 초과분 과금만 되며, 복제 구간에는 확정적으로 울리는 알람이라 폐기했다.
#
# 누락 데이터 정책 `notBreaching`: 인스턴스가 삭제·정지돼 지표가 끊겼을 때 알람이
# 허위로 울리지 않게 한다. DB가 죽은 경우는 `/api/ready`와 앱 에러 로그가 따로 잡는다.
# 수식에서 지표 하나만 결측이면 식 전체가 결측이 된다(RDS 지표는 한꺼번에 발행된다).
RDS_ID="${RDS_DB_ID:-siglens-db}"

# 여유 스토리지: 남은 공간이 4GB 미만. 스토리지 자동확장(상한 50GB)은 여유가 할당량의
# 10% 이하일 때에야 발동하고 한 번 늘리면 6시간 쿨다운이 있어서, 그 전에 사람이 먼저
# 알아야 한다. "사용률"이 아니라 "남은 절대량"을 본다 — 자동확장으로 할당량이 늘면 같은
# 4GB가 더 낮은 사용률을 뜻한다. 단위는 바이트(4GB = 4294967296).
RDS_FREE_STORAGE_ALARM_BYTES=4294967296
# 연결 수: max_connections 기본값(메모리 비례, t4g.small ≈ 180~225)의 약 70%.
# 이 값은 15-rds.sh의 max_connections 주석이 참조한다 — 바꾸면 그쪽 문구도 같이 고친다.
# 인스턴스마다 커넥션 풀이 있어 ASG가 늘어나면 연결도 선형으로 는다 — 풀 누수나
# 스케일아웃 폭주를 한계(too many clients)에 닿기 전에 잡는다.
RDS_CONNECTIONS_ALARM_THRESHOLD=150
# 여유 메모리: 2GiB 인스턴스에서 FreeableMemory가 200MB 밑이면 shared_buffers·워크메모리·
# OS 캐시가 서로 밀어내는 구간이고, 더 내려가면 스왑·OOM으로 이어진다. 단위는 바이트
# (200MB = 209715200). ⚠️ Postgres는 남는 메모리를 OS 페이지 캐시로 쓰므로 소형
# 인스턴스에서는 정상 운영에서도 낮게 형성될 수 있다 — 실측 기준선이 아직 없으니 이전 후
# 첫날의 실제 최저값을 보고 임계를 다시 잡을 것(너무 자주 울리면 100MB로 낮춘다).
RDS_FREEABLE_MEMORY_ALARM_BYTES=209715200

RDS_METRICS=$(jq -cn --arg id "$RDS_ID" \
  --arg expr "IF(m1<${RDS_FREE_STORAGE_ALARM_BYTES},1,0)+IF(m2>${RDS_CONNECTIONS_ALARM_THRESHOLD},1,0)+IF(m3<${RDS_FREEABLE_MEMORY_ALARM_BYTES},1,0)" '
  def rds($i; $m; $s): {Id:$i, MetricStat:{Metric:{Namespace:"AWS/RDS", MetricName:$m,
    Dimensions:[{Name:"DBInstanceIdentifier", Value:$id}]}, Period:300, Stat:$s}, ReturnData:false};
  [ rds("m1"; "FreeStorageSpace"; "Minimum"),
    rds("m2"; "DatabaseConnections"; "Maximum"),
    rds("m3"; "FreeableMemory"; "Minimum"),
    {Id:"e1", Expression:$expr, Label:"RdsConditionsBreached", ReturnData:true} ]')
RDS_DESC="RDS(${RDS_ID}) 위험 조건 합계 1 이상이 3주기(15분) 지속. 포괄 조건: FreeStorageSpace < 4GB, DatabaseConnections > ${RDS_CONNECTIONS_ALARM_THRESHOLD}, FreeableMemory < 200MB. 확인: RDS 콘솔 모니터링에서 어느 지표가 걸렸는지 보고, 연결은 pg_stat_activity, 스토리지는 자동확장 상태(상한 50GB) 확인. 임계 상수는 07-alarms.sh의 RDS_* 변수."
aws cloudwatch put-metric-alarm --alarm-name siglens-rds --alarm-description "$RDS_DESC" \
  --metrics "$RDS_METRICS" --evaluation-periods 3 --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching $P1

# (siglens-trader-instance-down 은 siglens-trader 레포 infra/aws/provision.sh 소관 — 그대로 유지.)

# ── 알람 지표 예산: 무료 티어 10개를 정확히 다 쓴다(여유 0) ─────────────────────────
# p1·p2·capacity-needed·disk-high·mem-high·agent-spend = 6, rds = 3(수식 안의 지표마다 과금),
# trader instance-down = 1. 알람을 하나라도 더하면 유료가 된다 — 11-readiness-canary.sh의
# 카나리 알람(SuccessPercent)은 현재 운영에 배포돼 있지 않으며, 그 스크립트를 돌리면 예산을
# 넘는다. 새 신호는 알람을 늘리지 말고 P1/P2 점수 필터로 더한다.
log "alarms: siglens-p1(점수≥100/5분), siglens-p2(점수≥100/15분), disk-high, mem-high, capacity-needed, agent-spend, rds(수식) — 알람 지표 10개(trader instance-down 포함, 무료 티어)"

# ── 클라이언트 예외 (메트릭·알람 없음 — Logs Insights로만 기준선 관찰) ────────
#
# `src/instrumentation-client.ts` + 9개 error boundary가 `/api/client-error`로 비콘을
# 보내고, 그 라우트가 `[client-error]`를 로그에 찍는다.
#
# **커스텀 메트릭을 2026-09-14 비용 정리에서 제거했다.** 다른 모든 알람과 달리
# 클라이언트 예외는 건강한 상태에서도 0이 아니고(브라우저 확장, 봇, 중단된
# 내비게이션), `threshold 0`을 걸면 첫날부터 울린다. 기준선은 로그를 직접 스캔한
# 만큼만 과금되는 Logs Insights로 본다(같은 데이터):
#
#   fields @timestamp, @message | filter @message like /\[client-error\]/
#   | stats count() by bin(1d)

# FETCH 메모리 캐시(memStore.mjs) 통계(`event":"fetch-mem"`)도 메트릭·알람 없이 Logs Insights로만 본다:
#   fields @timestamp, size, bytes, hit, miss, evicted
#   | filter event = "fetch-mem"
#   | sort @timestamp desc

# ── 사후 점검: 폐기된 알람·필터 명시 삭제 ─────────────────────────────────────
# put-metric-alarm / put-metric-filter는 생성/갱신만 한다 — 이름이 바뀌거나 폐기된 리소스는
# 스스로 사라지지 않는다. 지우지 않으면 옛 알람이 (a) 무료 티어를 계속 갉아먹고 (b) 메트릭이
# 끊긴 채 INSUFFICIENT_DATA로 남는다. 한곳에 모아 감사 가능하게 둔다. 삭제는 idempotent —
# 없는 이름을 넘겨도 delete-alarms는 에러 없이 무시하고, delete-metric-filter는
# ResourceNotFound를 내므로 `|| true`로 삼킨다.
#
# ⚠️ 다음 이름은 **여기 넣지 않는다**(이 스크립트가 만드는 현행 리소스): siglens-p1, siglens-p2,
#    siglens-disk-high, siglens-mem-high, siglens-capacity-needed, siglens-agent-spend, siglens-rds.
#    TargetTracking-siglens-asg-* 알람도 직접 지우지 않는다 — 08-scaling.sh가 정책을 지우면
#    관리형 알람이 함께 사라진다.
OBSOLETE_ALARMS=(
  # 2026-10 점수 알람(siglens-p1/p2)으로 흡수된 원인별 알람
  siglens-tunnel-down siglens-app-unhealthy siglens-node-heap-oom
  siglens-analysis-stream-failed siglens-agent-stream-failed siglens-agent-quota-store-unavailable
  siglens-isr-cache-failures siglens-isr-tag-failures siglens-seed-bars-failed
  siglens-redis-cache-failures siglens-agent-busy siglens-agent-web-search-budget
  siglens-market-data-loader-failed siglens-config-signal
  siglens-seo-prewarm-batch-failed siglens-seo-prewarm-unit-error siglens-seo-prewarm-deadline-reached
  siglens-kr-tickers-sync-failed
  # 2026-10 siglens-agent-spend / siglens-mem-high / siglens-rds로 흡수·대체
  siglens-agent-output-tokens-daily siglens-capacity-needed-mem
  siglens-rds-cpu-credits-low siglens-rds-free-storage-low siglens-rds-connections-high siglens-rds-freeable-memory-low
  # 2026-10 비용 정리로 폐기: 배포마다 가끔 울리던 크레딧 알람(실제 초과 과금은 드묾)
  siglens-surplus-credits
  # EventBridge FailedInvocations 알람(13-seo-prewarm.sh 5개 + 14-kr-tickers-cron.sh 1개) 폐기
  siglens-seo-prewarm-evening-failed siglens-seo-prewarm-evening-late-failed
  siglens-seo-prewarm-early-failed siglens-seo-prewarm-early-late-failed
  siglens-seo-prewarm-kr-boundary-failed siglens-kr-tickers-delivery-failed
  # 2026-09-14 이전 폐기분(재실행해도 안전)
  siglens-cpu-credits-low siglens-alb-5xx siglens-unhealthy-targets
  siglens-fear-greed-loader-failed siglens-fear-greed-kr-loader-failed
  siglens-market-kr-loader-failed siglens-naver-news-failed
  siglens-kr-calendar-horizon-expired siglens-seo-prewarm-redis-unavailable
)
aws cloudwatch delete-alarms --alarm-names "${OBSOLETE_ALARMS[@]}" \
  || log "WARN: 폐기 알람 삭제 호출이 실패했다 — 권한(cloudwatch:DeleteAlarms)을 확인: ${OBSOLETE_ALARMS[*]}"

# 폐기된 메트릭 필터. 현행 필터는 이름을 그대로 두고 Siglens/Alerts로 재지정(in-place 갱신)했으므로
# 2026-10 통합으로 새로 폐기된 필터는 없다 — 아래는 이전 통합(2026-09-14)에서 지운 것들이다.
# 필터가 남아 있으면 매치가 없어도 계속 로그를 스캔한다.
OBSOLETE_FILTERS=(
  siglens-fear-greed-loader-failed siglens-fear-greed-kr-loader-failed
  siglens-market-kr-loader-failed siglens-naver-news-failed
  siglens-kr-calendar-horizon-expired siglens-seo-prewarm-redis-unavailable
  siglens-client-error
)
for f in "${OBSOLETE_FILTERS[@]}"; do
  aws logs delete-metric-filter --log-group-name /siglens/app --filter-name "$f" 2>/dev/null || true
done

# 구독자 없는 토픽은 "액션 없는 알람"과 같다 — 콘솔만 빨개지고 아무도 모른다.
# 확인 대기(PendingConfirmation)도 통지가 안 가므로 별도로 센다.
#
# ⚠️ 한글 바로 앞의 변수는 반드시 `${var}`로 감쌀 것. `$confirmed건`으로 쓰면 bash가
#    한글 바이트를 변수명 일부로 먹어 `confirmed건: unbound variable`로 죽는다
#    (`set -u` 아래). 실제로 그렇게 죽어서 이 블록이 통째로 실행되지 않았다.
for pair in "P1:$ALARM_SNS" "P2:$ALARM_SNS_LOW"; do
  tier="${pair%%:*}"; arn="${pair#*:}"
  confirmed=$(aws sns list-subscriptions-by-topic --topic-arn "$arn" \
    --query "length(Subscriptions[?SubscriptionArn!='PendingConfirmation'])" --output text 2>/dev/null || echo ERR)
  pending=$(aws sns list-subscriptions-by-topic --topic-arn "$arn" \
    --query "length(Subscriptions[?SubscriptionArn=='PendingConfirmation'])" --output text 2>/dev/null || echo ERR)
  if [ "$confirmed" = "ERR" ]; then
    # API 실패를 "구독 0"으로 렌더하면 이미 확인된 주소를 다시 구독하러 가게 만든다.
    log "WARN: $tier 토픽 구독 조회 실패 — 구독 유무를 확인하지 못했다: $arn"
  elif [ "$confirmed" = "0" ]; then
    log "WARN: $tier 토픽에 확인된 구독이 없다 (대기 ${pending}건) — 이 등급 알람은 아무에게도 안 간다: $arn"
  else
    log "$tier 구독 확인 ${confirmed}건 (대기 ${pending}건)"
  fi
done
