#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
# ASG만 만든다. ALB·타깃그룹·HTTPS 리스너는 2026-08 cloudflared 전환에서 제거됐다
# (이 파일의 옛 이름이 06-alb-asg.sh였다).
#
# 왜 없앴나: 타깃이 1대뿐이라 로드밸런싱을 하지 않았고, `ALBRequestCountPerTarget`
# 타깃 트래킹은 생성일(2026-06-24) 이후 한 번도 ALARM으로 전이하지 않았으며,
# `siglens-alb-5xx`는 60일간 2회(둘 다 5분 자가복구, 런북이 이미 노이즈로 분류),
# `siglens-unhealthy-targets`는 0회였다. 대가는 월 $25.6~26.5
# (ALB 시간 $16.43 + LCU ~$2 + 서비스 관리형 EIP 2개 $7.30)였다.
#
# 인그레스는 이제 cloudflared 터널이다(user-data.sh). 밖으로 다이얼하므로
# EC2 SG는 인그레스 규칙이 0개이고, ACM 인증서도 CF IP 허용목록도 필요 없다.
#
# ALB가 하던 배포 시퀀싱은 라이프사이클 훅 2개가 대체한다(아래에서 생성).
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" "Name=availability-zone,Values=ap-northeast-2a,ap-northeast-2b" Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text)
SUBNET_CSV=$(echo $SUBNETS | tr ' ' ',')

# ASG (멱등)
#
# health-check-type EC2: ELB가 없으니 ASG는 인스턴스 사망만 감지한다. "박스는 살아
# 있는데 앱이 죽은" 상태는 user-data.sh의 siglens-selfcheck.timer가 잡아
# `set-instance-health --health-status Unhealthy`로 교체를 유도한다 —
# ELB 헬스체크보다 오히려 넓다(systemd가 StartLimitBurst로 포기한 경우까지 포함).
ASG_EXISTS=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names siglens-asg --query 'AutoScalingGroups[0].AutoScalingGroupName' --output text 2>/dev/null) || true
if [ "$ASG_EXISTS" = "None" ] || [ -z "$ASG_EXISTS" ]; then
  # 평시 한 대를 유지하고, target tracking이 필요할 때만 확장한다.
  # max-size 4: ASG 용량의 단일 소스 오브 트루스(L1). 08-scaling.sh는 max-size를
  # 건드리지 않는다.
  aws autoscaling create-auto-scaling-group --auto-scaling-group-name siglens-asg \
    --launch-template "LaunchTemplateName=siglens-lt,Version=\$Latest" \
    --min-size 1 --max-size 4 --desired-capacity 1 \
    --vpc-zone-identifier "$SUBNET_CSV" \
    --health-check-type EC2 --health-check-grace-period 240
else
  aws autoscaling update-auto-scaling-group --auto-scaling-group-name siglens-asg \
    --min-size 1 --max-size 4 --desired-capacity 1 \
    --vpc-zone-identifier "$SUBNET_CSV" --health-check-type EC2 \
    --health-check-grace-period 240 >/dev/null
fi

# ── 라이프사이클 훅 ──────────────────────────────────────────────────────────
# ALB의 `health-check-type ELB` + `deregistration_delay=185`가 하던 일을 대신한다.
# 훅 자체는 무료다.
#
# launch(ABANDON, 600s): 인스턴스는 앱과 터널이 **둘 다** 살아날 때까지
#   Pending:Wait에 머문다(= InService 아님 = MinHealthyPercentage 미충족). 그래서
#   instance refresh가 새 인스턴스가 죽어 있는 채로 옛 인스턴스를 종료할 수 없다.
#   완료 호출은 user-data.sh의 siglens-lifecycle-launch.service가 한다.
#   기본값이 ABANDON인 게 핵심 — 스크립트가 실패하면 refresh가 실패하지,
#   반쯤 죽은 인스턴스가 InService가 되지 않는다.
#
# drain(CONTINUE, 420s): 종료 시 인스턴스를 Terminating:Wait에 세워
#   cloudflared가 터널에서 빠지고(180초 grace) 앱이 SSE를 배수(docker stop -t 185)할
#   시간을 준다. 420 ≥ 180 + 190 + 여유. 훅이 없으면 EC2가 강제 전원차단까지
#   얼마나 기다리는지가 문서화돼 있지 않아 드레인이 비결정적이 된다.
#   기본값 CONTINUE — 스크립트가 멈춰도 타임아웃 뒤 종료는 진행된다(fail-safe).
#
# ⚠️ 필요 IAM: 인스턴스 역할에 autoscaling:CompleteLifecycleAction /
#    RecordLifecycleActionHeartbeat / SetInstanceHealth (iam/ec2-role-policy.json
#    Sid `AsgLifecycle`). 이게 없으면 launch 훅이 600초 뒤 ABANDON으로 떨어져
#    **모든 배포가 실패한다** — 훅을 만들기 전에 00-iam-setup.sh를 먼저 돌릴 것.
aws autoscaling put-lifecycle-hook --auto-scaling-group-name siglens-asg \
  --lifecycle-hook-name siglens-launch-gate \
  --lifecycle-transition autoscaling:EC2_INSTANCE_LAUNCHING \
  --heartbeat-timeout 600 --default-result ABANDON
aws autoscaling put-lifecycle-hook --auto-scaling-group-name siglens-asg \
  --lifecycle-hook-name siglens-drain-gate \
  --lifecycle-transition autoscaling:EC2_INSTANCE_TERMINATING \
  --heartbeat-timeout 420 --default-result CONTINUE

# ── 타깃 그룹 분리 (ALB 시절 잔재 정리) ──────────────────────────────────────
# `update-auto-scaling-group`은 타깃 그룹을 **제거하지 못한다**. 명시적으로 떼지 않으면
# ASG에 계속 붙어 있고, 나중에 `delete-target-group`이 ResourceInUse로 실패한다.
# 분리는 185초 등록해제 지연을 태우므로(그동안 ALB는 타깃 없이 503) **DNS 전환이
# 검증된 뒤에** 돌릴 것. 이미 떨어져 있으면 조용히 넘어간다.
TG_ARN=$(aws elbv2 describe-target-groups --names siglens-tg \
  --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null) || true
if [ -n "${TG_ARN:-}" ] && [ "$TG_ARN" != "None" ]; then
  aws autoscaling detach-load-balancer-target-groups \
    --auto-scaling-group-name siglens-asg --target-group-arns "$TG_ARN" 2>/dev/null || true
  log "detached target group: $TG_ARN"
fi

log "ASG ready (cloudflared ingress; no ALB)"
