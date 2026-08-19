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
# alarm + ok 양방향 통지(임계 초과뿐 아니라 정상 복구도 알린다).
ACTIONS="--alarm-actions $ALARM_SNS --ok-actions $ALARM_SNS"
ALB_SUFFIX=$(echo "$ALB_ARN" | sed 's#.*:loadbalancer/##')
TG_SUFFIX=$(echo "$TG_ARN" | sed 's#.*:##')
# 5분간 ELB 5xx 10건 초과 = 비정상 (정상 트래픽 노이즈 위)
aws cloudwatch put-metric-alarm --alarm-name siglens-alb-5xx --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_ELB_5XX_Count --dimensions Name=LoadBalancer,Value="$ALB_SUFFIX" \
  --statistic Sum --period 300 --evaluation-periods 1 --threshold 10 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS
aws cloudwatch put-metric-alarm --alarm-name siglens-unhealthy-targets --namespace AWS/ApplicationELB \
  --metric-name UnHealthyHostCount --dimensions Name=LoadBalancer,Value="$ALB_SUFFIX" Name=TargetGroup,Value="$TG_SUFFIX" \
  --statistic Maximum --period 60 --evaluation-periods 3 --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching $ACTIONS
# t4g 버스트 크레딧 소진 임박 여유분
aws cloudwatch put-metric-alarm --alarm-name siglens-cpu-credits-low --namespace AWS/EC2 \
  --metric-name CPUCreditBalance --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Minimum --period 300 --evaluation-periods 2 --threshold 30 \
  --comparison-operator LessThanThreshold --treat-missing-data notBreaching $ACTIONS
# 로그로테이션/캐시 증가 고려, 가득참 전 여유.
# ISR 외부화(S3) 이후 디스크가 다시 오르면 캐시 외부화가 조용히 실패한 것 — 회귀 카나리 역할.
aws cloudwatch put-metric-alarm --alarm-name siglens-disk-high --namespace CWAgent \
  --metric-name disk_used_percent --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Maximum --period 300 --evaluation-periods 2 --threshold 85 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS
# OOM 전 여유
aws cloudwatch put-metric-alarm --alarm-name siglens-mem-high --namespace CWAgent \
  --metric-name mem_used_percent --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 90 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS
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
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS

# FETCH 메모리 캐시(memStore.mjs) 가시성 — 알람이 아니라 **관측 지표**다.
#
# FETCH 엔트리는 S3가 아니라 프로세스 내 LRU에 산다. 이 캐시의 고장은 전부 조용하다:
# 히트율 0%, 축출 스래싱, 예산 드리프트 어느 것도 에러를 내지 않고 증상은 FMP 요금과
# Upstash 커맨드 수로만 뒤늦게 나타난다. memStore가 5분마다 남기는
# '[isr-cache] fetch-mem size=.. bytes=.. hit=.. miss=.. evicted=..' 줄을 메트릭으로 올린다.
#
# 알람을 걸지 않는 이유: 정상 히트율의 기준선이 아직 없다(배포 직후 워밍 구간과
# 정상 구간의 구분이 필요). 우선 지표만 쌓고, 기준선이 잡히면 임계값을 정한다.
#
# ⚠️ **JSON 필터여야 한다.** 공백 구분 필터 `[isr, kind, size, bytes, ...]`는 토큰을
# 공백으로만 쪼개므로 `size=12`가 통째로 한 토큰이 되고, `metricValue=$size`가
# "size=12"를 숫자로 읽지 못해 **조용히 아무것도 발행하지 않는다**. memStore가
# JSON 한 줄을 찍고 여기서 `$.필드`로 뽑는 이유다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-isr-fetch-mem \
  --filter-pattern '{ $.event = "fetch-mem" }' \
  --metric-transformations \
    metricName=FetchMemEvicted,metricNamespace=Siglens/ISRCache,metricValue='$.evicted' \
    metricName=FetchMemHit,metricNamespace=Siglens/ISRCache,metricValue='$.hit' \
    metricName=FetchMemMiss,metricNamespace=Siglens/ISRCache,metricValue='$.miss' \
    metricName=FetchMemBytes,metricNamespace=Siglens/ISRCache,metricValue='$.bytes'

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
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS

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
  --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching $ACTIONS
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
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS
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
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS

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
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS

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
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS

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
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS

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
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS

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
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS

log "alarms created (5xx, unhealthy, cpu-credits, disk, mem, isr-cache-failures, isr-tag-failures, analysis-stream-failed, node-heap-oom, fear-greed-loader-failed, fear-greed-kr-loader-failed, naver-news-failed, market-kr-loader-failed, kr-calendar-horizon-expired)"
