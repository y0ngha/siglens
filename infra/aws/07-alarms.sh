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
# 로그로테이션/캐시 증가 고려, 가득참 전 여유
aws cloudwatch put-metric-alarm --alarm-name siglens-disk-high --namespace CWAgent \
  --metric-name disk_used_percent --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Maximum --period 300 --evaluation-periods 2 --threshold 85 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS
# OOM 전 여유
aws cloudwatch put-metric-alarm --alarm-name siglens-mem-high --namespace CWAgent \
  --metric-name mem_used_percent --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 90 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS
log "alarms created (5xx, unhealthy, cpu-credits, disk, mem)"
