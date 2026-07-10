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
# 새 연결을 끊고 in-flight 요청만 흘려보낸 뒤 dereg을 완료한다. 기본 300s는
# 우리 graceful-shutdown 예산과 맞지 않으므로 30s로 낮춘다:
#   - systemd ExecStop=docker stop -t 30 (컨테이너 30s 후 SIGKILL)
#   - instrumentation SIGTERM drain deadline 25s
#   - 이 dereg delay 30s
# 셋이 정합해야 롤 시 in-flight 요청·백그라운드 작업이 깔끔히 비워진다.
# modify-target-group-attributes는 upsert라 매 실행 안전(멱등).
aws elbv2 modify-target-group-attributes --target-group-arn "$TG_ARN" \
  --attributes Key=deregistration_delay.timeout_seconds,Value=30 >/dev/null
# HTTPS 443 리스너 (ACM)
if ! aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Port==`443`]' --output text | grep -q .; then
  aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" --protocol HTTPS --port 443 \
    --certificates CertificateArn="$CERT_ARN" \
    --default-actions Type=forward,TargetGroupArn="$TG_ARN" >/dev/null
fi
HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[?Port==`443`].ListenerArn | [0]' --output text)

if [ "$HTTPS_LISTENER_ARN" = "None" ] || [ -z "$HTTPS_LISTENER_ARN" ]; then
  echo "ERROR: HTTPS listener ARN lookup returned empty/None for ALB $ALB_ARN" >&2
  exit 1
fi

bash "$(dirname "$0")/reconcile-www-redirect.sh" --listener-arn "$HTTPS_LISTENER_ARN"
# ASG (멱등)
ASG_EXISTS=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names siglens-asg --query 'AutoScalingGroups[0].AutoScalingGroupName' --output text 2>/dev/null) || true
if [ "$ASG_EXISTS" = "None" ] || [ -z "$ASG_EXISTS" ]; then
  # min/desired 2: 단일 인스턴스가 ELB health check failure로 교체될 때 healthy
  # target이 0개가 되면 Cloudflare/ALB가 사이트 전체 502를 반환한다. 평시 2대를
  # 유지해 한 대가 교체·배포·unhealthy 상태여도 다른 한 대가 계속 트래픽을 받게 한다.
  #
  # max-size 4: ASG 용량의 단일 소스 오브 트루스(L1). 08-scaling.sh는 더 이상
  # max-size를 건드리지 않는다 — 06과 08이 서로 다른 값을 설정해 표류하던 문제를
  # 여기로 통합. instance refresh는 MaxHealthyPercentage=200(desired=2 → max
  # running=4)를 허용하므로 4면 충분하고, 지속 부하 시 타깃 트래킹 스케일아웃
  # 여유도 확보된다.
  aws autoscaling create-auto-scaling-group --auto-scaling-group-name siglens-asg \
    --launch-template "LaunchTemplateName=siglens-lt,Version=\$Latest" \
    --min-size 2 --max-size 4 --desired-capacity 2 \
    --vpc-zone-identifier "$SUBNET_CSV" --target-group-arns "$TG_ARN" \
    --health-check-type ELB --health-check-grace-period 240 # golden AMI: env-fetch+delta pull; base AL2023: +dnf installs+full pull can approach 180s
else
  # Existing groups are reconciled as well as newly-created groups. This prevents
  # a future infra rerun from leaving the production ASG in the unsafe desired=1
  # shape that can produce a total 502 during unhealthy replacement.
  aws autoscaling update-auto-scaling-group --auto-scaling-group-name siglens-asg \
    --min-size 2 --max-size 4 --desired-capacity 2 \
    --vpc-zone-identifier "$SUBNET_CSV" --health-check-type ELB \
    --health-check-grace-period 240 >/dev/null
fi
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)
for kv in "ALB_ARN=$ALB_ARN" "TG_ARN=$TG_ARN" "ALB_DNS=$ALB_DNS"; do
  grep -q "^export ${kv%%=*}=" "$(dirname "$0")/.ids" || echo "export $kv" >> "$(dirname "$0")/.ids"
done
log "ALB_DNS=$ALB_DNS"
