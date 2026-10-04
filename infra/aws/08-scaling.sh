#!/usr/bin/env bash
# ASG 스케일링 정책 정리. delete-policy는 없는 정책에도 안전하다 — 재실행 가능(idempotent).
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"

# (a) ASG max-size는 06-asg.sh가 단일 소스 오브 트루스로 4를 설정한다(L1).
#     이전에는 여기서 update-auto-scaling-group --max-size 4 로 다시 설정해
#     06(2)과 08(4)이 표류했다. 중복 설정을 제거해 06으로 일원화.
#     max-size를 줄이지 않는 이유: 배포가 ASG instance refresh(새 인스턴스를 먼저 띄우고
#     옛 것을 내리는 롤)로 도는데, 그 과정이 일시적으로 2대 이상을 요구한다.

# (b) [제거됨] ALB 요청 수 기반 타깃 트래킹(`siglens-tt-albreq`).
#     생성일(2026-06-24) 이후 한 번도 ALARM으로 전이한 적이 없다 — worker 제거 후
#     요청 수는 부하의 대리 지표가 아니게 됐다.
#
#     **명시적으로 지운다.** `put-scaling-policy`는 생성/갱신만 하므로 정의를 지워도
#     기존 정책은 살아남는다. 남으면 ALB 삭제 후 `RequestCountPerTarget`이 끊기고
#     그 관리형 알람 2개가 영원히 INSUFFICIENT_DATA가 되는데, 더 나쁜 건
#     **스케일인이 막힌다**는 점이다 — AWS는 스케일인 활성 타깃트래킹 정책이 **전부**
#     동의해야 축소하므로, CPU로 늘어난 인스턴스가 영영 안 줄어든다(상한 없는 비용 누수).
#     정책을 지우면 관리형 알람도 함께 사라진다. 알람을 직접 지우지 말 것.
aws autoscaling delete-policy --auto-scaling-group-name siglens-asg \
  --policy-name siglens-tt-albreq 2>/dev/null || true

# (c) [제거됨] CPU 기반 타깃 트래킹(`siglens-tt-cpu`, ASGAverageCPUUtilization 50%).
#     2026-10 CloudWatch 무료 티어 통합에서 폐기했다. 근거(30일 실측, 2026-10-03,
#     `aws cloudwatch describe-alarm-history --alarm-name <TargetTracking-…-AlarmHigh/Low>
#     --history-item-type StateUpdate`와 ASG CPUUtilization 5분 평균):
#       - 스케일아웃 알람(AlarmHigh)은 **딱 한 번** 31분간 발화했다. 평소 CPU는 5~10%라
#         50%는 정상 대비 7배, 사실상 도달하지 않는 값이다.
#       - 스케일인 알람(AlarmLow, 15분 평균 < 35%)은 min=1 상태에서 **항상 ALARM**이었다
#         — 줄일 인스턴스가 없는데도 상시 ALARM이라 신호가치가 없다.
#       - 정책이 만드는 관리형 알람 2개가 무료 티어(알람 지표 10개)를 2개 차지했다.
#     대체: 용량 부족은 `siglens-capacity-needed`(CPU 25% × 15분, P1)가 알리고, 운영자가
#     `aws autoscaling set-desired-capacity --auto-scaling-group-name siglens-asg
#     --desired-capacity N`로 직접 늘린 뒤 부하가 가라앉으면 1로 되돌린다.
#     실측상 단일 인스턴스가 baseline의 절반 이하로 감당하므로 자동 확장이 필요한 구간이
#     관측된 적이 없다. 다시 자동화가 필요해지면 정책을 이 스크립트에서 되살린다
#     (t4g 크레딧 경제 때문에 타깃은 baseline 20%보다 높고 80%보다 낮은 50% 근처였다).
#
#     **정책을 지우면 AWS가 TargetTracking-siglens-asg-AlarmHigh/AlarmLow 관리형 알람을
#     함께 지운다. 알람을 직접 delete-alarms 하지 말 것**(정책이 남아 알람을 다시 만든다).
aws autoscaling delete-policy --auto-scaling-group-name siglens-asg \
  --policy-name siglens-tt-cpu 2>/dev/null || true

log "scaling policies removed: siglens-tt-albreq, siglens-tt-cpu (manual set-desired-capacity; capacity-needed alarm pages); ASG max-size owned by 06-asg.sh (=4)"
# 실제 남은 정책을 찍는다. 위 delete-policy는 `2>/dev/null || true`라 IAM 거부·
# ResourceContention으로 실패해도 조용히 넘어가는데, 그러면 "지웠다고 로그만 찍고
# 스케일인이 계속 막혀 있는" 상태가 된다 — 정책이 남아 있으면 여기서 보인다.
log "active policies: $(aws autoscaling describe-policies --auto-scaling-group-name siglens-asg \
  --query 'ScalingPolicies[].PolicyName' --output text)"
