#!/usr/bin/env bash
# ASG 운영 여유 확보 + ALB 요청 수 기반 타깃 트래킹 스케일링 정책 설정.
# update-auto-scaling-group / put-scaling-policy 모두 upsert — 재실행 안전.
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"

# (a) ASG 최대 용량을 4로 늘려 지속적 부하 시 스케일아웃 여유 확보
#     (min-size / desired 는 건드리지 않음)
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name siglens-asg \
  --max-size 4

# (b) ALB 요청 수 기반 타깃 트래킹 정책
#     순간적 봇 버스트는 Cloudflare에서 처리하므로, 여기서는 지속 트래픽 스케일아웃에 집중.
ALB_LABEL=$(echo "$ALB_ARN" | sed 's#.*:loadbalancer/##')          # -> app/siglens-alb/<id>
TG_LABEL=$(echo "$TG_ARN"  | sed 's#.*:\(targetgroup/[^/]*/[^/]*\)$#\1#')  # -> targetgroup/siglens-tg/<id>
RES_LABEL="$ALB_LABEL/$TG_LABEL"

aws autoscaling put-scaling-policy \
  --auto-scaling-group-name siglens-asg \
  --policy-name siglens-tt-albreq \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration "{\"PredefinedMetricSpecification\":{\"PredefinedMetricType\":\"ALBRequestCountPerTarget\",\"ResourceLabel\":\"$RES_LABEL\"},\"TargetValue\":1000}"

log "scaling policy siglens-tt-albreq set (target 1000 req/target); ASG max-size → 4 | resource-label: $RES_LABEL"
