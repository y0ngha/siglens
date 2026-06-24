#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text)
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
# HTTPS 443 리스너 (ACM)
if ! aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Port==`443`]' --output text | grep -q .; then
  aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" --protocol HTTPS --port 443 \
    --certificates CertificateArn="$CERT_ARN" \
    --default-actions Type=forward,TargetGroupArn="$TG_ARN" >/dev/null
fi
# ASG (멱등)
ASG_EXISTS=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names siglens-asg --query 'AutoScalingGroups[0].AutoScalingGroupName' --output text 2>/dev/null) || true
if [ "$ASG_EXISTS" = "None" ] || [ -z "$ASG_EXISTS" ]; then
  aws autoscaling create-auto-scaling-group --auto-scaling-group-name siglens-asg \
    --launch-template "LaunchTemplateName=siglens-lt,Version=\$Latest" \
    --min-size 1 --max-size 2 --desired-capacity 1 \
    --vpc-zone-identifier "$SUBNET_CSV" --target-group-arns "$TG_ARN" \
    --health-check-type ELB --health-check-grace-period 180
fi
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)
for kv in "ALB_ARN=$ALB_ARN" "TG_ARN=$TG_ARN" "ALB_DNS=$ALB_DNS"; do
  grep -q "^export ${kv%%=*}=" "$(dirname "$0")/.ids" || echo "export $kv" >> "$(dirname "$0")/.ids"
done
log "ALB_DNS=$ALB_DNS"
