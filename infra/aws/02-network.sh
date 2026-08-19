#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
log "VPC: $VPC_ID"

# EC2 보안 그룹 — **인그레스 규칙이 하나도 없다.**
#
# 2026-08 cloudflared 전환 전에는 여기서 `siglens-alb-sg`를 만들고 Cloudflare IPv4/IPv6
# 대역 전체에 :443을 열어 준 뒤, EC2 SG의 :3000을 그 SG에서만 열었다. 이제 인그레스
# 경로는 cloudflared 터널뿐이고, 터널은 **밖으로** 다이얼한다(UDP/TCP 7844 →
# region{1,2}.v2.argotunnel.com). 이그레스가 이미 전체 허용이라 SG 변경도 필요 없다.
#
# 덕분에 유지보수 대상이 줄었다: Cloudflare가 IP 대역을 갱신할 때마다 이 스크립트를
# 다시 돌릴 이유가 없어졌고, ACM 인증서(03-acm.sh)도 통째로 사라졌다.
# siglens-trader 박스와 동일한 자세다.
EC2_SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=siglens-ec2-sg Name=vpc-id,Values=$VPC_ID --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null) || true
if [ "$EC2_SG" = "None" ] || [ -z "$EC2_SG" ]; then
  EC2_SG=$(aws ec2 create-security-group --group-name siglens-ec2-sg --description "siglens EC2 - egress only (cloudflared tunnel)" --vpc-id "$VPC_ID" --query GroupId --output text)
fi

cat > "$(dirname "$0")/.ids" <<IDS
export VPC_ID=$VPC_ID
export EC2_SG=$EC2_SG
IDS
log "EC2_SG=$EC2_SG (ingress: none — cloudflared dials out)"
