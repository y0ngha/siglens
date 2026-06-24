#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
log "VPC: $VPC_ID"
ALB_SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=siglens-alb-sg Name=vpc-id,Values=$VPC_ID --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null) || true
if [ "$ALB_SG" = "None" ] || [ -z "$ALB_SG" ]; then
  ALB_SG=$(aws ec2 create-security-group --group-name siglens-alb-sg --description "siglens ALB - CF IPs only" --vpc-id "$VPC_ID" --query GroupId --output text)
fi
for cidr in $(curl -fsS https://www.cloudflare.com/ips-v4); do
  aws ec2 authorize-security-group-ingress --group-id "$ALB_SG" --protocol tcp --port 443 --cidr "$cidr" >/dev/null 2>&1 || true
done
# Defensive: the ALB is currently IPv4-only, but authorizing CF IPv6 ranges here
# future-proofs the SG for dual-stack. IPv6 ingress requires --ip-permissions with
# Ipv6Ranges rather than the --cidr shorthand (which only accepts IPv4 CIDRs).
for cidr6 in $(curl -fsS https://www.cloudflare.com/ips-v6); do
  aws ec2 authorize-security-group-ingress --group-id "$ALB_SG" \
    --ip-permissions "IpProtocol=tcp,FromPort=443,ToPort=443,Ipv6Ranges=[{CidrIpv6=$cidr6}]" >/dev/null 2>&1 || true
done
EC2_SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=siglens-ec2-sg Name=vpc-id,Values=$VPC_ID --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null) || true
if [ "$EC2_SG" = "None" ] || [ -z "$EC2_SG" ]; then
  EC2_SG=$(aws ec2 create-security-group --group-name siglens-ec2-sg --description "siglens EC2 - from ALB" --vpc-id "$VPC_ID" --query GroupId --output text)
fi
aws ec2 authorize-security-group-ingress --group-id "$EC2_SG" --protocol tcp --port 3000 --source-group "$ALB_SG" >/dev/null 2>&1 || true
cat > "$(dirname "$0")/.ids" <<IDS
export VPC_ID=$VPC_ID
export ALB_SG=$ALB_SG
export EC2_SG=$EC2_SG
IDS
log "ALB_SG=$ALB_SG EC2_SG=$EC2_SG"
