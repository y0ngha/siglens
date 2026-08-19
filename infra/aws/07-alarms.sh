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

# ── 알람 2단 체계 ────────────────────────────────────────────────────────────
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
# ── 인그레스·앱 생존 (P1) ────────────────────────────────────────────────────
#
# 2026-08 ALB 제거로 `siglens-alb-5xx`(60일간 2회, 둘 다 5분 자가복구라 런북이 이미
# 노이즈로 분류)와 `siglens-unhealthy-targets`(0회)가 사라졌다. 그 자리를 온박스
# 신호가 메운다: `user-data.sh`의 `siglens-selfcheck.timer`가 60초마다 터널과 앱을
# 확인해 `/var/log/siglens-ops.log`에 찍고, CloudWatch 에이전트가 그 파일을 이 로그
# 그룹으로 보낸다(스트림 `<instance-id>-ops`).
#
# ⚠️ 이 스크립트는 더 이상 `.ids`의 `ALB_ARN`/`TG_ARN`을 읽지 않는다. lib.sh가
#    `set -u`라 없는 변수를 참조하면 **첫 알람을 만들기도 전에** 스크립트가 죽고,
#    디스크·메모리·OOM 알람과 로그 메트릭 필터 10여 개가 통째로 안 만들어진다.
#    ALB 제거 후 `02-network.sh`가 `.ids`를 VPC_ID/EC2_SG만으로 다시 쓰므로
#    그 참조는 반드시 사라져야 한다.
#
# 터널이 죽으면 사이트 전체가 죽는다 — 대체 인그레스가 없다. threshold 0.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-tunnel-down \
  --filter-pattern '"[cloudflared-down]"' \
  --metric-transformations metricName=TunnelDown,metricNamespace=Siglens/Ingress,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-tunnel-down --namespace Siglens/Ingress \
  --metric-name TunnelDown --statistic Sum --period 300 --evaluation-periods 1 --threshold 0 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1

# selfcheck가 인스턴스를 Unhealthy로 표시했다 = ASG가 교체를 시작했다. 한 번은 정상
# 복구 절차지만 반복되면 크래시 루프다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-app-unhealthy \
  --filter-pattern '"[selfcheck]"' \
  --metric-transformations metricName=AppUnhealthy,metricNamespace=Siglens/Ingress,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-app-unhealthy --namespace Siglens/Ingress \
  --metric-name AppUnhealthy --statistic Sum --period 300 --evaluation-periods 1 --threshold 0 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1

# CPU 크레딧: **잔량이 아니라 초과 과금**을 본다.
#
# 예전엔 `CPUCreditBalance < 30`이었는데, 새 인스턴스는 크레딧 0에서 시작하므로
# **배포마다 확정적으로 발동**했다(14일간 14회, 전부 오탐). 잔량은 선행지표일 뿐이고,
# 실제로 문제가 되는 순간은 baseline을 넘겨 **돈을 내기 시작할 때**다.
# `CPUSurplusCreditsCharged`는 7일 연속 0이었다 — 이 신호가 켜지면 진짜다.
aws cloudwatch put-metric-alarm --alarm-name siglens-surplus-credits --namespace AWS/EC2 \
  --metric-name CPUSurplusCreditsCharged --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Sum --period 3600 --evaluation-periods 2 --threshold 0 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2

# ── 증설 필요 신호 (오토스케일을 놓치지 않기 위한 알람) ──────────────────────
#
# ASG는 min1/max4에 target-tracking 정책이 붙어 있지만 **14일간 스케일아웃이 0회**다
# (AlarmHigh 전이 0회). 7월에 2대였던 구간은 부하가 아니라 마이그레이션 잔여였다.
# 즉 지금 ALB/ASG는 로드밸런싱이 아니라 배포 교체 장치로만 쓰이고 있다.
#
# 그래서 오토스케일이 **정말 필요해지는 순간을 놓치지 않는 것**이 중요하다.
# t4g.medium baseline이 20%이므로 25%를 15분 지속하면 (a) baseline 초과로 크레딧을
# 태우고 있고 (b) 관측된 최대치보다 확실히 높다 = 용량이 부족하다는 뜻이다.
# 25% 15분 연속 초과는 실측 기간에 **0회** — 오탐 여지가 없다.
# 임계 근거(2026-08-19 재측정, ASG 차원 5분 평균 4일치 1,152포인트):
#   p50 6.0 / p90 9.2 / p95 10.4 / p99 13.6 / max 22.6
#   25% 초과 0회, 25% 연속 초과 최대 0분.
# 즉 3주기(15분) 연속 25% 초과는 배포·SSM 작업 같은 단발 스파이크로는 도달할 수 없다.
aws cloudwatch put-metric-alarm --alarm-name siglens-capacity-needed --namespace AWS/EC2 \
  --metric-name CPUUtilization --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 25 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1

# 메모리 쪽 증설 신호. 실측 max 40.1%(p99 33.7%)라 60%면 여유가 크면서
# `siglens-mem-high`(90%, 이미 늦음)보다 훨씬 먼저 잡힌다.
aws cloudwatch put-metric-alarm --alarm-name siglens-capacity-needed-mem --namespace CWAgent \
  --metric-name mem_used_percent --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 60 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1
# 로그로테이션/캐시 증가 고려, 가득참 전 여유.
# ISR 외부화(S3) 이후 디스크가 다시 오르면 캐시 외부화가 조용히 실패한 것 — 회귀 카나리 역할.
aws cloudwatch put-metric-alarm --alarm-name siglens-disk-high --namespace CWAgent \
  --metric-name disk_used_percent --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Maximum --period 300 --evaluation-periods 2 --threshold 85 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1
# OOM 전 여유
aws cloudwatch put-metric-alarm --alarm-name siglens-mem-high --namespace CWAgent \
  --metric-name mem_used_percent --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 90 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2
# ISR 캐시 fail-open 가시성: s3Store의 '[isr-cache] s3 get/set failed' 로그를 메트릭으로.
# fail-open이라 S3 perms/버킷/IMDS가 깨져도 캐시가 조용히 죽을 뿐 알람이 없다 — 이를 잡는다.
# '?"a" ?"b"' 는 CloudWatch Logs 필터 OR 문법: a 또는 b를 포함하는 줄만 카운트.
# 실패 로그(get/set failed)만 대상 — 정상 [isr-cache] 로그(hit/miss 등)는 제외.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-isr-cache-failures \
  --filter-pattern '?"[isr-cache] s3 get failed" ?"[isr-cache] s3 set failed"' \
  --metric-transformations metricName=IsrCacheFailures,metricNamespace=Siglens/ISRCache,metricValue=1
# 5분간 5건 초과 = 산발적 S3 hiccup(정상 재생성)이 아니라 지속 실패 → 캐시 사실상 죽음.
aws cloudwatch put-metric-alarm --alarm-name siglens-isr-cache-failures --namespace Siglens/ISRCache \
  --metric-name IsrCacheFailures --statistic Sum --period 300 --evaluation-periods 1 --threshold 5 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2

# FETCH 메모리 캐시(memStore.mjs) 가시성 — **메트릭 필터를 만들지 않는다.**
#
# memStore는 5분마다 JSON 한 줄을 남긴다:
#   {"tag":"isr-cache","event":"fetch-mem","size":..,"bytes":..,"hit":..,"miss":..,"evicted":..}
#
# 메트릭으로 올리지 않는 이유 2가지:
#  1) CloudWatch `put-metric-filter`의 metricTransformations는 **필터당 정확히 1개**다
#     (botocore logs 모델: MetricTransformations `{"max":1,"min":1}`). 5개 값을 올리려면
#     같은 패턴에 필터를 5개 만들어야 한다.
#  2) 그러면 커스텀 메트릭 5개 = 월 $1.5인데, 알람을 걸 기준선이 아직 없어 그래프로만 쓴다.
#     비용 절감 PR에서 알람 없는 메트릭에 그 돈을 쓸 이유가 없다.
#
# 대신 Logs Insights로 본다(같은 데이터, 스캔한 만큼만 과금):
#   fields @timestamp, size, bytes, hit, miss, evicted
#   | filter event = "fetch-mem"
#   | sort @timestamp desc
#
# 기준선이 잡히고 알람을 걸 값이 정해지면 그때 그 **하나만** 필터로 승격한다
# (유력 후보: evicted — 지속 축출은 예산 부족 = 조용한 성능·비용 퇴행 신호).

# RSC seed 헬퍼(getSeedBarsStatic) 실패 가시성.
#
# `/[symbol]` 전 라우트의 bars/지표 seed를 이 헬퍼가 만든다. 실패하면 `.catch(→null)`로
# fail-open해서 **HTTP 200에 로그 한 줄만** 남는다 — 차트·팩트레이어가 조용히 비어도
# 어떤 알람도 울리지 않는다. 형제 로더들(`[FearGreedRoute]`, `[MarketContent:kr]`)은
# 이미 필터가 있는데 정작 종목 계열 전체를 떠받치는 이 헬퍼만 없었다.
#
# 세 호출부가 같은 문자열을 남긴다(접두사만 다르므로 부분 문자열로 매칭한다):
#   [SymbolLayout] getSeedBarsStatic failed:
#   [SymbolPage] getSeedBarsStatic failed:
#   [FearGreedPage] getSeedBarsStatic failed:
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-seed-bars-failed \
  --filter-pattern '"getSeedBarsStatic failed"' \
  --metric-transformations metricName=SeedBarsFailed,metricNamespace=Siglens/Bars,metricValue=1
# 5분간 5건 초과 = 산발적 FMP blip이 아니라 지속 실패 → 종목 페이지가 광범위하게 degrade.
aws cloudwatch put-metric-alarm --alarm-name siglens-seed-bars-failed --namespace Siglens/Bars \
  --metric-name SeedBarsFailed --statistic Sum --period 300 --evaluation-periods 1 --threshold 5 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2

# Redis(Upstash) read-through 캐시 실패 가시성.
#
# FETCH 엔트리가 S3에서 빠지면서 **Redis가 인스턴스 간 유일한 FMP 방어선**이 됐다.
# 그전에는 S3 fetch/ 계층이 Redis degrade를 일부 흡수했지만, memStore는 프로세스 로컬이라
# 컨테이너 재시작마다 비어 있다. 따라서 Upstash 장애(플랜 한도, 토큰 회전, 스로틀)는
# 곧바로 FMP 쿼터 소진과 429로 이어지고, 지금은 청구서를 보기 전까지 아무도 모른다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-redis-cache-failures \
  --filter-pattern '?"[getOrSetCache] get failed" ?"[getOrSetCache] set failed"' \
  --metric-transformations metricName=RedisCacheFailures,metricNamespace=Siglens/ISRCache,metricValue=1
# 5분간 10건 초과 = 산발적 네트워크 blip이 아니라 지속 실패. getOrSetCache는 키마다
# 로그를 남기므로(스로틀 없음) s3 필터의 5보다 임계값을 높게 잡는다.
aws cloudwatch put-metric-alarm --alarm-name siglens-redis-cache-failures --namespace Siglens/ISRCache \
  --metric-name RedisCacheFailures --statistic Sum --period 300 --evaluation-periods 1 --threshold 10 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2

# 태그 스토어(tagStore.mjs) fail-open 가시성 — 위 s3 필터와 별개의 알람이어야 한다.
#
# 1) 리터럴이 다르다: 로그는 '[isr-cache] tag sync|publish|prune failed'라 위 필터에 안 걸린다.
# 2) 임계값 계산이 다르다: tagStore는 스코프당 60초 스로틀이라 완전 장애여도 300초에
#    최대 5줄뿐 → 위 알람의 '5 초과' 조건에 영원히 도달하지 못한다.
#    그래서 period 900(최대 15줄/스코프) + threshold 5 이상 + 2주기로 잡는다.
#    지속 장애 → 약 30분 내 발화, 일시적 blip(≤2줄) → 무시.
#
# 태그 동기화가 죽으면 다른 인스턴스의 무효화를 놓쳐 stale HTML을 revalidate TTL(6~24h)
# 동안 서빙한다. 조용히 degrade하므로 알람이 유일한 신호다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-isr-tag-failures \
  --filter-pattern '?"[isr-cache] tag sync failed" ?"[isr-cache] tag publish failed" ?"[isr-cache] tag prune failed"' \
  --metric-transformations metricName=IsrTagFailures,metricNamespace=Siglens/ISRCache,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-isr-tag-failures --namespace Siglens/ISRCache \
  --metric-name IsrTagFailures --statistic Sum --period 900 --evaluation-periods 2 --threshold 5 \
  --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching $P2
# 분석 스트림 실패 가시성 — heartbeatStream.ts reject 핸들러가 '[analysis-stream] failed:'를
# 남긴다(Fix 1a). SSE는 항상 HTTP 200을 반환하므로 ALB 5xx 알람으로는 분석 전면 장애를
# 포착할 수 없다 — 이 로그 기반 메트릭이 유일한 서버사이드 신호다.
#
# '[analysis-stream] failed' 로 필터(따옴표 포함): 접두 패턴이 ASCII만으로 구성돼
# CloudWatch Logs 필터 매칭이 안정적이다(13-seo-prewarm.sh §FIX F 참조).
#
# 임계값: 15분 2건 초과가 **연속 2주기**(=30분) → 알람.
#
# 창을 5분→15분으로 넓히고 임계를 낮춘 이유: 임계가 트래픽 규모에 묶여 있으면 저트래픽
# 구간의 100% 장애를 못 잡는다. 심야에 5분당 4건씩 전부 실패하면 5분/5건 임계는 영원히
# 안 넘는다. 15분/2건이면 "장애 중 시도 자체가 드문" 시간대도 잡히고, 연속 2주기로
# 산발적 단발 실패는 여전히 걸러진다.
#   - isr-tag-failures 주석(위)이 경계하는 "도달 불가능한 임계"와 같은 실수를 피한다.
#   - 게이트 거부(BYOK/tier)는 `gate-denied`로 분리 로깅해 이 지표에 안 섞인다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-analysis-stream-failed \
  --filter-pattern '"[analysis-stream] failed"' \
  --metric-transformations metricName=AnalysisStreamFailed,metricNamespace=Siglens/Analysis,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-analysis-stream-failed --namespace Siglens/Analysis \
  --metric-name AnalysisStreamFailed --statistic Sum --period 900 --evaluation-periods 2 --threshold 2 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1
# Node 힙 고갈 — worker 제거 이후 새로 생긴 실패 모드.
#
# LLM 호출이 앱 프로세스 안에서 돌면서 요청당 bars+지표+프롬프트를 들고 있게 됐다.
# `user-data.sh`가 Node 힙을 컨테이너 리밋보다 낮게 잡아 뒀으므로, 한계에 닿으면
# 커널 OOM killer가 조용히 죽이는 대신 Node가 이 문자열을 stderr에 남기고 종료한다
# (awslogs 드라이버가 CloudWatch로 보낸다). systemd가 재시작하지만 진행 중이던
# 분석은 전멸하므로, 한 번이라도 뜨면 신호다.
#
# 임계값 0 초과 = 1시간에 1회라도 발생하면 알람. 정상 운영에선 절대 안 나온다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-node-heap-oom \
  --filter-pattern '"JavaScript heap out of memory"' \
  --metric-transformations metricName=NodeHeapOom,metricNamespace=Siglens/Runtime,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-node-heap-oom --namespace Siglens/Runtime \
  --metric-name NodeHeapOom --statistic Sum --period 3600 --evaluation-periods 1 --threshold 0 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1

# 시장 공포·탐욕 지수 로더 실패 — fail-open 설계라 알람 없이는 아무 신호가 없다.
#
# `/fear-greed`는 로더 예외를 삼키고 200 + "표본이 부족합니다"를 렌더한다(0바이트 ISR
# 캐시 동결 방지). 문제는 그 결과가 정상 HTML이라 ISR/S3 캐시에 그대로 저장되고,
# FMP 402/403처럼 재시도 대상이 아닌 오류(`isFmpTransientError`가 false)면 매시 재생성이
# 똑같이 실패해 **영구히 빈 페이지**가 된다 — 5xx도, 헬스체크 실패도 안 뜬다.
# DEPLOY_RUNBOOK §7이 말하는 "fail-open이 실패를 조용하게 만드는" 바로 그 사례라
# 로그 문자열을 유일한 신호로 삼는다.
#
# ⚠️ 실패 **1회당 로그가 2줄** 남는다 — `generateMetadata`와 페이지 본문이 각각
# `getMarketFearGreedStatic()`을 호출하고 각각 catch한다(`React.cache`가 프라미스는
# 공유하지만 reject되면 두 catch가 모두 돈다). 임계값 4 초과 = **시간당 실패 렌더 2회
# 초과**. 재생성 주기가 1시간이라 일시 장애 1회는 넘기고, 연속 2주기 지속되면 알람.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-fear-greed-loader-failed \
  --filter-pattern '"[FearGreedRoute] getMarketFearGreedStatic failed"' \
  --metric-transformations metricName=FearGreedLoaderFailed,metricNamespace=Siglens/MarketFearGreed,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-fear-greed-loader-failed --namespace Siglens/MarketFearGreed \
  --metric-name FearGreedLoaderFailed --statistic Sum --period 3600 --evaluation-periods 2 --threshold 4 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2

# ── 한국 공포·탐욕 로더 실패 ──────────────────────────────────────────────
# 미국판과 **로그 접두사가 다르다**(`[FearGreedKrRoute] getMarketFearGreedKrStatic
# failed`). 위 필터는 리터럴 부분문자열 매칭이라 KR 로그를 잡지 못한다 — 필터를
# 따로 두지 않으면 KR 라우트만 fail-open이 무감시 상태가 된다.
#
# 실패 모드가 미국보다 넓다: yahoo가 무인증이라 429가 나고, KRX ETF 5종 중 하나가
# 상장폐지되면 `fetchKrDailyCloses`가 던져 200 + "표본이 부족합니다" + noindex가
# 매시 재생성마다 똑같이 굳는다. 임계값 근거는 미국과 동일(렌더 1회당 로그 2줄).
aws logs put-metric-filter --log-group-name /siglens/app   --filter-name siglens-fear-greed-kr-loader-failed   --filter-pattern '"[FearGreedKrRoute] getMarketFearGreedKrStatic failed"'   --metric-transformations metricName=FearGreedKrLoaderFailed,metricNamespace=Siglens/MarketFearGreed,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-fear-greed-kr-loader-failed --namespace Siglens/MarketFearGreed \
  --metric-name FearGreedKrLoaderFailed --statistic Sum --period 3600 --evaluation-periods 2 --threshold 4 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2

# ── 네이버 뉴스 실패(자격증명 부재 + 업스트림 non-OK) ─────────────────────
# `/news/kr`의 유일한 소스다. 키가 비거나 구독이 만료되면 빈 피드 + noindex가
# 조용히 굳으므로 두 로그 줄을 알람으로 승격한다(발생 즉시 = 설정/구독 문제라 0 초과).
#
# **필터 패턴은 ASCII만 쓴다.** CloudWatch metric filter는 non-ASCII 리터럴을
# 매칭하지 못한다(FIX F — `infra/aws/13-seo-prewarm.sh`, `docs/reference/CRON.md`).
# 원래 `"NAVER_CLIENT_ID/SECRET 미설정"`이었는데, 그러면 알람이 영원히 안 울린다.
# `?`는 OR — 두 접두 중 하나만 맞아도 센다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-naver-news-failed \
  --filter-pattern '?"NAVER_CLIENT_ID/SECRET" ?"non-OK response"' \
  --metric-transformations metricName=NaverNewsFailed,metricNamespace=Siglens/News,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-naver-news-failed --namespace Siglens/News \
  --metric-name NaverNewsFailed --statistic Sum --period 3600 --evaluation-periods 1 --threshold 0 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2

# ── 한국 대시보드 로더 실패 ──────────────────────────────────────────────
# `/market/kr`은 세 KR 라우트 중 실패 표면이 가장 넓다 — 지수 3 + ETF 6 + 종목 20을
# 무인증 yahoo로 긁는다(리필당 49회). 실패하면 빈 배열로 fail-open해서
# canonical null + noindex 상태가 ISR에 굳는데, 로그 말고는 아무 신호가 없다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-market-kr-loader-failed \
  --filter-pattern '"[MarketContent:kr]"' \
  --metric-transformations metricName=MarketKrLoaderFailed,metricNamespace=Siglens/Market,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-market-kr-loader-failed --namespace Siglens/Market \
  --metric-name MarketKrLoaderFailed --statistic Sum --period 3600 --evaluation-periods 2 --threshold 4 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2

# ── KRX 휴장 캘린더 지평선 만료 ──────────────────────────────────────────
# `KR_CALENDAR_HORIZON`(현재 2026-12-31)을 넘으면 모든 날을 정상 개장으로 보고
# `console.warn`만 남긴다. 그 값이 (a) 대시보드 캐시 TTL과 (b) `/fear-greed/kr`
# 사이트맵 lastmod를 끌고 가므로, 휴장일에 "장중 60초 TTL"로 yahoo를 긁고
# 바뀌지도 않은 페이지의 신선도를 주장하게 된다. warn 한 줄은 아무도 안 본다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-kr-calendar-horizon-expired \
  --filter-pattern '"[KR_EQUITY_SESSION]"' \
  --metric-transformations metricName=KrCalendarHorizonExpired,metricNamespace=Siglens/Market,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-kr-calendar-horizon-expired --namespace Siglens/Market \
  --metric-name KrCalendarHorizonExpired --statistic Sum --period 3600 --evaluation-periods 1 --threshold 0 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P2

log "alarms: P1(즉시)=5xx, unhealthy, disk, heap-oom, analysis-stream, capacity-needed(cpu/mem) | P2(오늘중)=mem-high, surplus-credits, isr-cache, isr-tag, redis-cache, seed-bars, fear-greed(us/kr), naver-news, market-kr, kr-calendar"

# ── 클라이언트 예외 (알람 없음 — 기준선 수집 단계) ────────────────────────────
#
# `src/instrumentation-client.ts` + 9개 error boundary가 `/api/client-error`로 비콘을
# 보내고, 그 라우트가 `[client-error]`를 로그에 찍는다.
#
# **알람을 일부러 안 건다.** 다른 모든 알람과 달리 클라이언트 예외는 건강한 상태에서도
# 0이 아니다(브라우저 확장, 봇, 중단된 내비게이션). `threshold 0`을 걸면 첫날부터 울린다.
# 1~2주 메트릭만 모아 Logs Insights로 기준선을 읽은 뒤 그 3~5배로 건다 —
# `analysis-stream-failed`에 이미 적용한 것과 같은 논리.
#
#   fields @timestamp, @message | filter @message like /\[client-error\]/
#   | stats count() by bin(1d)
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-client-error \
  --filter-pattern '"[client-error]"' \
  --metric-transformations metricName=ClientError,metricNamespace=Siglens/Client,metricValue=1


# ── 사후 점검 ────────────────────────────────────────────────────────────────
# put-metric-alarm은 생성/갱신만 한다 — 이름이 바뀌거나 폐기된 알람은 스스로 사라지지
# 않는다. `siglens-cpu-credits-low`는 배포마다 크레딧이 잠깐 떨어질 때 발동해
# 14일간 28통을 보내던 알람이고, `siglens-surplus-credits`(실제 과금 발생 시에만)로
# 대체했다. 명시적으로 지우지 않으면 P1/P2 분리를 해도 노이즈가 그대로 남는다.
# ALB 알람 2개는 ALB와 함께 폐기됐다. 지우지 않으면 메트릭이 끊긴 채 영원히
# INSUFFICIENT_DATA로 남는다.
aws cloudwatch delete-alarms --alarm-names \
  siglens-cpu-credits-low siglens-alb-5xx siglens-unhealthy-targets 2>/dev/null || true

# 구독자 없는 토픽은 "액션 없는 알람"과 같다 — 콘솔만 빨개지고 아무도 모른다.
# 확인 대기(PendingConfirmation)도 통지가 안 가므로 별도로 센다.
for pair in "P1:$ALARM_SNS" "P2:$ALARM_SNS_LOW"; do
  tier="${pair%%:*}"; arn="${pair#*:}"
  confirmed=$(aws sns list-subscriptions-by-topic --topic-arn "$arn" \
    --query "length(Subscriptions[?SubscriptionArn!='PendingConfirmation'])" --output text 2>/dev/null || echo 0)
  pending=$(aws sns list-subscriptions-by-topic --topic-arn "$arn" \
    --query "length(Subscriptions[?SubscriptionArn=='PendingConfirmation'])" --output text 2>/dev/null || echo 0)
  if [ "$confirmed" = "0" ]; then
    log "⚠️  $tier 토픽에 확인된 구독이 없다 (대기 $pending건) — 이 등급 알람은 아무에게도 안 간다: $arn"
  else
    log "$tier 구독 확인 $confirmed건 (대기 $pending건)"
  fi
done
