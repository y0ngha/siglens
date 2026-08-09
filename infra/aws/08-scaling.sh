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
# TargetValue 50 — 실측 기반. 이 값은 두 제약 사이의 절충이다.
#
# 실측(2026-08 첫 주, CWAgent/EC2): CPU 시간평균 5~10%, 하루 최대도 10.5%.
# t4g.medium baseline(vCPU당 20%)의 절반이라 정상 상태에서는 크레딧이 만점(576)에 머문다.
# 크레딧이 1.5까지 떨어진 날들이 있었지만 그건 부하가 아니라 **배포로 뜬 새 인스턴스가
# 0에서 적립을 시작**한 것이다(CPUSurplusCreditBalance는 내내 0 = 초과 요금 발생 없음).
#
# 왜 baseline(20%)이 아닌가: 타깃 트래킹은 평균을 목표치 "에" 붙든다. 20%로 잡으면 정상
# 부하의 3배만 돼도 스케일아웃이 돈다 — 한 대가 충분히 감당하는 구간에서 인스턴스를
# 늘리는 셈이라 과민하다.
#
# 왜 80%가 아닌가: 목표치에 붙드는 성질 때문에, 80%로 잡으면 발동 후 플릿이 80%에 머물며
# 크레딧을 시간당 -72씩 태운다(적립 24 - 소비 96). 576이 8시간이면 바닥나고 그때부터
# unlimited 모드 초과 요금이 계속 나간다.
#
#   타깃   소비/h   순증감   576 소진   발화 조건(정상 5~10% 대비)
#    20%      24      +0    무한 적립      3배  ← 과민
#    50%      60     -36      16시간      7배  ← 선택
#    80%      96     -72       8시간     11배  ← runway 부족
#
# 50%는 "정상 대비 7배 = 진짜 이상 상황"에서만 발동하고, 발동 후에도 16시간의 대응
# 여유를 준다. 만약 앞으로 baseline 위에서 상시 운영하게 되면 이 숫자를 올릴 게 아니라
# 인스턴스 타입을 non-burstable(m7g 등)로 바꾸는 게 맞다 — 버스터블에서 baseline 초과가
# 상시화되면 어떤 타깃값을 쓰든 크레딧 경제가 성립하지 않는다.
CPU_CONFIG=$(jq -n \
  --argjson target 50 \
  '{PredefinedMetricSpecification:{PredefinedMetricType:"ASGAverageCPUUtilization"},TargetValue:$target}')

aws autoscaling put-scaling-policy \
  --auto-scaling-group-name siglens-asg \
  --policy-name siglens-tt-cpu \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration "$CPU_CONFIG"

log "scaling policies set: siglens-tt-albreq (1000 req/target) + siglens-tt-cpu (50% CPU); ASG max-size owned by 06-alb-asg.sh (=4) | resource-label: $RES_LABEL"
