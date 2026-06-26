#!/usr/bin/env bash
# 골든 AMI 베이크(M2).
#
# user-data.sh가 부팅 시 dnf install하던 것들(docker, jq, amazon-cloudwatch-agent)을
# 미리 설치한 AMI를 굽는다. 부팅이 "env-fetch + docker pull(델타) + run"으로 줄어
# 빠르고 결정적이 된다. 결과 AMI ID를 infra/aws/.ami(=PINNED_AMI, M1)에 박아
# 05-launch-template.sh가 그것을 쓰게 한다.
#
# 흐름(베이크 → 핀 → 배포):
#   1. bash 09-bake-ami.sh            # 골든 AMI를 굽고 .ami에 PINNED_AMI 기록
#   2. (CI를 쓴다면) repo variable vars.PINNED_AMI 를 출력된 AMI ID로 갱신
#   3. v* 태그 push → deploy.yml 가 PINNED_AMI로 launch template 갱신 후 ASG roll
#
# 이 스크립트는 EC2를 실제로 띄우므로 운영자가 직접 실행한다(권한 필요:
# ec2 run-instances/create-image/terminate-instances, ssm send-command).
set -euo pipefail
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
require aws
require jq

REGION="${AWS_REGION:-ap-northeast-2}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t4g.medium}"
AMI_FILE="$(dirname "$0")/.ami"

# 베이스: 최신 AL2023 arm64. 골든 AMI는 여기서 출발해 한 번만 의도적으로 굽는다.
BASE_AMI=$(aws ec2 describe-images --owners amazon \
  --filters "Name=name,Values=al2023-ami-*-arm64" "Name=state,Values=available" \
  --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text --region "$REGION")
[ -n "$BASE_AMI" ] && [ "$BASE_AMI" != "None" ] || { log "ERROR: base AL2023 arm64 AMI not found"; exit 1; }
log "base AMI: $BASE_AMI"

# 빌더 네트워킹/권한(fix): run-instances는 subnet·SG·인스턴스 프로파일을 명시해야 한다.
# 누락 시 (1) default VPC가 없는 계정에서 launch 자체가 실패하고, (2) 인스턴스 프로파일
# 부재로 SSM send-command 폴링(아래 마커 확인)과 ECR 접근이 불가해 bake가 실패한다.
# 앱 런타임 롤($EC2_ROLE, AmazonSSMManagedInstanceCore 부착)을 재사용하고, 퍼블릭(IGW)
# 기본 서브넷을 골라 dnf/ECR/SSM 아웃바운드를 보장한다(--associate-public-ip-address).
BUILDER_PROFILE="${BUILDER_PROFILE:-$EC2_ROLE}"
BUILDER_SG="${BUILDER_SG:-$EC2_SG}"
BUILDER_SUBNET="${BUILDER_SUBNET:-$(aws ec2 describe-subnets --region "$REGION" \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=default-for-az,Values=true" \
  --query 'Subnets[0].SubnetId' --output text)}"
[ -n "$BUILDER_SUBNET" ] && [ "$BUILDER_SUBNET" != "None" ] || { log "ERROR: builder subnet not resolved in $VPC_ID"; exit 1; }
log "builder net: subnet=$BUILDER_SUBNET sg=$BUILDER_SG profile=$BUILDER_PROFILE"

# 빌더 인스턴스가 부팅 시 설치를 수행하도록 user-data를 구성한다.
# 마지막에 /etc/siglens-golden-ami 마커를 남겨 런타임 user-data.sh가 설치를 건너뛰게 한다.
BUILDER_UD=$(base64 <<'BAKE'
#!/usr/bin/env bash
set -euxo pipefail
dnf install -y docker jq amazon-cloudwatch-agent
# docker 데몬은 굳이 부팅 활성화만(이미지에 패키지가 들어가는 게 핵심)
systemctl enable docker
# 골든 AMI 마커: 런타임 user-data.sh가 이 파일을 보고 dnf install을 스킵한다.
echo "baked $(date -u +%FT%TZ)" > /etc/siglens-golden-ami
# 설치 완료 신호용 마커(폴링).
touch /var/lib/cloud/siglens-bake-done
BAKE
)

log "launching builder instance ($INSTANCE_TYPE from $BASE_AMI)..."
BUILDER_ID=$(aws ec2 run-instances --region "$REGION" \
  --image-id "$BASE_AMI" --instance-type "$INSTANCE_TYPE" \
  --user-data "$BUILDER_UD" \
  --iam-instance-profile "Name=$BUILDER_PROFILE" \
  --subnet-id "$BUILDER_SUBNET" --security-group-ids "$BUILDER_SG" \
  --associate-public-ip-address \
  --instance-initiated-shutdown-behavior stop \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=siglens-ami-builder}]' \
  --query 'Instances[0].InstanceId' --output text)
log "builder: $BUILDER_ID — waiting for running state..."

# 빌더가 끝나면 정리되도록 trap 설정(실패 시에도 인스턴스 누수 방지).
cleanup() {
  log "terminating builder $BUILDER_ID..."
  aws ec2 terminate-instances --region "$REGION" --instance-ids "$BUILDER_ID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

aws ec2 wait instance-running --region "$REGION" --instance-ids "$BUILDER_ID"

# user-data 설치 완료까지 폴링(/var/lib/cloud/siglens-bake-done 마커 확인, 최대 ~5분).
# SSM Agent는 AL2023에 기본 포함 — send-command로 마커 존재 여부를 확인한다.
log "waiting for bake to finish (polling marker via SSM)..."
for i in $(seq 1 30); do
  CMD_ID=$(aws ssm send-command --region "$REGION" \
    --instance-ids "$BUILDER_ID" --document-name "AWS-RunShellScript" \
    --parameters 'commands=["test -f /var/lib/cloud/siglens-bake-done && echo DONE || echo PENDING"]' \
    --query 'Command.CommandId' --output text 2>/dev/null) || { sleep 10; continue; }
  sleep 5
  OUT=$(aws ssm get-command-invocation --region "$REGION" \
    --command-id "$CMD_ID" --instance-id "$BUILDER_ID" \
    --query 'StandardOutputContent' --output text 2>/dev/null || echo "")
  if echo "$OUT" | grep -q DONE; then
    log "bake complete"
    break
  fi
  [ "$i" -eq 30 ] && { log "ERROR: bake did not finish in time"; exit 1; }
  sleep 10
done

# AMI 생성(인스턴스를 stop 후 스냅샷 — no-reboot 대신 일관성 위해 정지).
log "stopping builder before image creation..."
aws ec2 stop-instances --region "$REGION" --instance-ids "$BUILDER_ID" >/dev/null
aws ec2 wait instance-stopped --region "$REGION" --instance-ids "$BUILDER_ID"

IMAGE_NAME="siglens-golden-$(date -u +%Y%m%d-%H%M%S)"
log "creating AMI $IMAGE_NAME..."
GOLDEN_AMI=$(aws ec2 create-image --region "$REGION" \
  --instance-id "$BUILDER_ID" --name "$IMAGE_NAME" \
  --description "siglens golden AMI (docker+jq+cwagent baked)" \
  --query 'ImageId' --output text)
log "AMI creating: $GOLDEN_AMI — waiting until available..."
aws ec2 wait image-available --region "$REGION" --image-ids "$GOLDEN_AMI"

# 핀 갱신(M1): 05-launch-template.sh가 이 값을 PINNED_AMI로 읽는다.
echo "export PINNED_AMI=$GOLDEN_AMI" > "$AMI_FILE"
log "golden AMI ready: $GOLDEN_AMI"
log "pinned to $AMI_FILE (PINNED_AMI=$GOLDEN_AMI)"
log "NEXT: update repo variable vars.PINNED_AMI=$GOLDEN_AMI for CI deploys, then push a v* tag."
