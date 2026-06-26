#!/usr/bin/env bash
# ASG 운영 여유 확보 + ALB 요청 수 기반 타깃 트래킹 스케일링 정책 설정.
# update-auto-scaling-group / put-scaling-policy 모두 upsert — 재실행 안전.
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"

# (a) ASG max-size는 06-alb-asg.sh가 단일 소스 오브 트루스로 4를 설정한다(L1).
#     이전에는 여기서 update-auto-scaling-group --max-size 4 로 다시 설정해
#     06(2)과 08(4)이 표류했다. 중복 설정을 제거해 06으로 일원화.

# (b) ALB 요청 수 기반 타깃 트래킹 정책
#     순간적 봇 버스트는 Cloudflare에서 처리하므로, 여기서는 지속 트래픽 스케일아웃에 집중.
ALB_LABEL=$(echo "$ALB_ARN" | sed 's#.*:loadbalancer/##')          # -> app/siglens-alb/<id>
TG_LABEL=$(echo "$TG_ARN"  | sed 's#.*:\(targetgroup/[^/]*/[^/]*\)$#\1#')  # -> targetgroup/siglens-tg/<id>
RES_LABEL="$ALB_LABEL/$TG_LABEL"

TT_CONFIG=$(jq -n \
  --arg res_label "$RES_LABEL" \
  --argjson target 1000 \
  '{PredefinedMetricSpecification:{PredefinedMetricType:"ALBRequestCountPerTarget",ResourceLabel:$res_label},TargetValue:$target}')

aws autoscaling put-scaling-policy \
  --auto-scaling-group-name siglens-asg \
  --policy-name siglens-tt-albreq \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration "$TT_CONFIG"

log "scaling policy siglens-tt-albreq set (target 1000 req/target); ASG max-size owned by 06-alb-asg.sh (=4) | resource-label: $RES_LABEL"
