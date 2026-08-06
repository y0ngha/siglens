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
# 임계값: 5분간 50건 초과 → 알람.
#   - 정상 노이즈: 산발적 LLM 오류·타임아웃은 시간당 수십 건 이하(5분당 ~5건 이하).
#   - 전면 장애: API 키 미설정 등 100% 실패 시 활성 사용자가 있으면 수백 건/5분.
# 50으로 잡으면 정상 노이즈를 충분히 흡수하면서 완전 장애는 빠르게(5분 내) 잡는다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-analysis-stream-failed \
  --filter-pattern '"[analysis-stream] failed"' \
  --metric-transformations metricName=AnalysisStreamFailed,metricNamespace=Siglens/Analysis,metricValue=1
aws cloudwatch put-metric-alarm --alarm-name siglens-analysis-stream-failed --namespace Siglens/Analysis \
  --metric-name AnalysisStreamFailed --statistic Sum --period 300 --evaluation-periods 1 --threshold 50 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS
log "alarms created (5xx, unhealthy, cpu-credits, disk, mem, isr-cache-failures, isr-tag-failures, analysis-stream-failed)"
