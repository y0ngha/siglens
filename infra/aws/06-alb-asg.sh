#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
# Restrict to 2a/2b only: adding 2c/2d would auto-allocate extra public IPv4 addresses
# (~$3.6/mo each) and incur cross-AZ data charges. Two AZs satisfies the ALB minimum
# (requires ≥2) and still provides multi-AZ resilience.
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" "Name=availability-zone,Values=ap-northeast-2a,ap-northeast-2b" Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text)
SUBNET_CSV=$(echo $SUBNETS | tr ' ' ',')
# ALB (멱등)
ALB_ARN=$(aws elbv2 describe-load-balancers --names siglens-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null) || true
if [ "$ALB_ARN" = "None" ] || [ -z "$ALB_ARN" ]; then
  # $SUBNETS intentionally unquoted: word-split into multiple subnet IDs
  ALB_ARN=$(aws elbv2 create-load-balancer --name siglens-alb --type application --scheme internet-facing \
    --security-groups "$ALB_SG" --subnets $SUBNETS --query 'LoadBalancers[0].LoadBalancerArn' --output text)
fi
# Target Group
TG_ARN=$(aws elbv2 describe-target-groups --names siglens-tg --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null) || true
if [ "$TG_ARN" = "None" ] || [ -z "$TG_ARN" ]; then
  TG_ARN=$(aws elbv2 create-target-group --name siglens-tg --protocol HTTP --port 3000 --vpc-id "$VPC_ID" \
    --target-type instance --health-check-path /api/health --health-check-interval-seconds 30 \
    --healthy-threshold-count 2 --unhealthy-threshold-count 3 --query 'TargetGroups[0].TargetGroupArn' --output text)
fi
# Deregistration delay: 인스턴스 refresh로 타깃이 draining 상태가 되면 ALB가
# 새 연결을 끊고 in-flight 요청만 흘려보낸 뒤 dereg을 완료한다.
#
# SSE 분석 스트림이 최대 5분(STREAM_DEADLINE_MS)까지 지속될 수 있으므로 drain 체인을
# 180s 기준으로 재조정한다(Fix 3). 3값 정합 필수:
#   - instrumentation SIGTERM drain deadline: 180s  (instrumentation.node.ts)
#   - 이 dereg delay:                         185s  ≥ drain deadline
#     (SIGTERM은 deregistration 완료 후 오므로, drain 동안 새 연결이 들어오지 않는다)
#   - systemd ExecStop=docker stop -t 185s    >  drain deadline
#     (drain이 끝나 process.exit(0) 후 docker가 멈춤; user-data.sh)
#   - TimeoutStopSec=190s                     ≥  docker stop -t (systemd 안전망)
#
# 180s drain < STREAM_DEADLINE_MS(5분) = 5분짜리 분석은 잘릴 수 있다 — 허용된 트레이드오프.
# modify-*-attributes는 upsert라 매 실행 안전(멱등).
#
# ⚠️ 두 속성은 **소속이 다르다.** deregistration_delay는 타깃그룹, idle_timeout은
# 로드밸런서 속성이다(botocore ELBv2 모델에서 확인: TargetGroupAttribute에는
# idle_timeout이 없고 LoadBalancerAttribute에만 있다). 한 호출에 섞으면
# modify-target-group-attributes가 원자적이라 ValidationError로 **둘 다** 적용되지
# 않고, `set -euo pipefail` 때문에 여기서 스크립트가 죽어 아래 리스너·ASG 설정까지
# 통째로 건너뛴다. 반드시 분리해서 호출할 것.
aws elbv2 modify-target-group-attributes --target-group-arn "$TG_ARN" \
  --attributes Key=deregistration_delay.timeout_seconds,Value=185 \
  >/dev/null

# idle_timeout.timeout_seconds=60: ALB idle timeout을 명시 고정한다.
# heartbeatStream.ts의 HEARTBEAT_INTERVAL_MS=25s는 이 60s 값을 기준으로 산정됐다
# (실측: heartbeat 없이 61.1s에 연결 끊김 — project_sse_streaming_verified_alb_wall.md).
# AWS 기본값도 60s이나 스크립트에 명시하지 않으면 "AWS 기본"에 의존하게 되어
# 향후 기본값 변경이 heartbeat 설계와 조용히 어긋날 수 있다.
aws elbv2 modify-load-balancer-attributes --load-balancer-arn "$ALB_ARN" \
  --attributes Key=idle_timeout.timeout_seconds,Value=60 \
  >/dev/null
# HTTPS 443 리스너 (ACM)
if ! aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Port==`443`]' --output text | grep -q .; then
  aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" --protocol HTTPS --port 443 \
    --certificates CertificateArn="$CERT_ARN" \
    --default-actions Type=forward,TargetGroupArn="$TG_ARN" >/dev/null
fi

# ASG (멱등)
ASG_EXISTS=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names siglens-asg --query 'AutoScalingGroups[0].AutoScalingGroupName' --output text 2>/dev/null) || true
if [ "$ASG_EXISTS" = "None" ] || [ -z "$ASG_EXISTS" ]; then
  # 평시 한 대를 유지하고, target tracking이 필요할 때만 확장한다.
  # max-size 4: ASG 용량의 단일 소스 오브 트루스(L1). 08-scaling.sh는 더 이상
  # max-size를 건드리지 않는다 — 06과 08이 서로 다른 값을 설정해 표류하던 문제를
  # 여기로 통합. 4대면 instance refresh와 지속 부하 시 스케일아웃 여유를 확보한다.
  aws autoscaling create-auto-scaling-group --auto-scaling-group-name siglens-asg \
    --launch-template "LaunchTemplateName=siglens-lt,Version=\$Latest" \
    --min-size 1 --max-size 4 --desired-capacity 1 \
    --vpc-zone-identifier "$SUBNET_CSV" --target-group-arns "$TG_ARN" \
    --health-check-type ELB --health-check-grace-period 240 # golden AMI: env-fetch+delta pull; base AL2023: +dnf installs+full pull can approach 180s
else
  # Existing groups are reconciled as well as newly-created groups.
  aws autoscaling update-auto-scaling-group --auto-scaling-group-name siglens-asg \
    --min-size 1 --max-size 4 --desired-capacity 1 \
    --vpc-zone-identifier "$SUBNET_CSV" --health-check-type ELB \
    --health-check-grace-period 240 >/dev/null
fi
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)
for kv in "ALB_ARN=$ALB_ARN" "TG_ARN=$TG_ARN" "ALB_DNS=$ALB_DNS"; do
  grep -q "^export ${kv%%=*}=" "$(dirname "$0")/.ids" || echo "export $kv" >> "$(dirname "$0")/.ids"
done
log "ALB_DNS=$ALB_DNS"
