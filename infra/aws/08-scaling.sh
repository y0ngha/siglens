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

# (c) CPU 기반 타깃 트래킹 정책
#     worker 제거 후 LLM 호출이 앱 인스턴스 안에서 돈다. 그래서 요청 수는 더 이상
#     부하의 대리 지표가 아니다 — 90초짜리 분석 200개가 동시에 돌면 인스턴스는 포화지만
#     분당 완료 요청은 ~133건이라 위 1000 req/target 임계의 13%밖에 안 된다. 즉
#     ALBRequestCountPerTarget만으로는 이 구조의 병목에 영원히 반응하지 못한다.
#     CPU 정책을 함께 걸어 LLM 바운드 부하에도 스케일아웃되게 한다.
#     (siglens-cpu-credits-low는 알람일 뿐 스케일링 트리거가 아니다.)
# TargetValue 20 = t4g.medium의 baseline(vCPU당 20%).
#
# 타깃 트래킹은 평균을 목표치 "아래"가 아니라 목표치 "에" 붙든다. baseline보다 높게 잡으면
# (60은 3배, 30은 1.5배) 그 상태가 정상 판정이라 스케일아웃이 안 일어나고, unlimited 모드라
# 크레딧이 계속 순감해 결국 초과 요금 + siglens-cpu-credits-low 상시 ALARM으로 굳는다.
# baseline에 맞추면 크레딧이 수지균형이고, 그보다 부하가 높아지는 순간 스케일아웃이 돈다.
CPU_CONFIG=$(jq -n \
  --argjson target 20 \
  '{PredefinedMetricSpecification:{PredefinedMetricType:"ASGAverageCPUUtilization"},TargetValue:$target}')

aws autoscaling put-scaling-policy \
  --auto-scaling-group-name siglens-asg \
  --policy-name siglens-tt-cpu \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration "$CPU_CONFIG"

log "scaling policies set: siglens-tt-albreq (1000 req/target) + siglens-tt-cpu (20% CPU = t4g baseline); ASG max-size owned by 06-alb-asg.sh (=4) | resource-label: $RES_LABEL"
