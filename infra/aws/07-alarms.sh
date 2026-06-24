#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
ACTIONS=""; [[ -n "${ALARM_SNS:-}" ]] && ACTIONS="--alarm-actions $ALARM_SNS"
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
