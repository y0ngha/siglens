#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
TAG="${1:?usage: 05-launch-template.sh <image-tag>}"

# AMI 핀(M1): 매 배포마다 "latest AL2023 arm64"를 새로 resolve하면 베이스 이미지가
# 조용히 표류한다(커널/패키지 변경이 의도치 않게 들어옴). 대신 고정된 AMI ID만 쓴다.
# 우선순위:
#   1) 환경변수 PINNED_AMI (CI: deploy.yml이 repo variable vars.PINNED_AMI에서 주입)
#   2) infra/aws/.ami 파일의 export PINNED_AMI=ami-... (로컬 운영자)
# 둘 다 없으면 실패한다 — "latest"로 조용히 떨어지지 않는다.
#
# 핀 갱신은 의도적으로만 한다:
#   - 골든 AMI(M2): 09-bake-ami.sh가 AMI를 구운 뒤 .ami(및 안내에 따라 repo variable)를 갱신
#   - base AL2023 갱신: 아래로 최신 AMI를 핀에 박는다
#       AMI=$(aws ssm get-parameter \
#         --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
#         --query 'Parameter.Value' --output text)
#       echo "export PINNED_AMI=$AMI" > infra/aws/.ami   # 로컬
#       # CI는 repo Settings → Secrets and variables → Actions → Variables 의 PINNED_AMI 갱신
AMI_FILE="$(dirname "$0")/.ami"
if [ -z "${PINNED_AMI:-}" ] && [ -f "$AMI_FILE" ]; then
  # shellcheck source=/dev/null
  source "$AMI_FILE"
fi
if [ -z "${PINNED_AMI:-}" ]; then
  log "ERROR: no pinned AMI (set env PINNED_AMI or write infra/aws/.ami)."
  log "  Bake a golden AMI (09-bake-ami.sh) or pin latest AL2023 arm64:"
  log "    AMI=\$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query 'Parameter.Value' --output text)"
  log "    echo \"export PINNED_AMI=\$AMI\" > $AMI_FILE"
  exit 1
fi
AMI="$PINNED_AMI"
UD=$(sed "s|__IMAGE_TAG__|$TAG|" "$(dirname "$0")/user-data.sh" | base64 | tr -d '\n')
LTDATA=$(jq -n \
  --arg     ami           "$AMI" \
  --arg     instance_type "$INSTANCE_TYPE" \
  --arg     ec2_role      "$EC2_ROLE" \
  --arg     ec2_sg        "$EC2_SG" \
  --arg     ud            "$UD" \
  --argjson vol_size      50 \
  '{
    ImageId:             $ami,
    InstanceType:        $instance_type,
    IamInstanceProfile:  { Name: $ec2_role },
    SecurityGroupIds:    [ $ec2_sg ],
    BlockDeviceMappings: [{
      DeviceName: "/dev/xvda",
      Ebs: {
        VolumeSize:          $vol_size,
        VolumeType:          "gp3",
        DeleteOnTermination: true
      }
    }],
    UserData: $ud,
    MetadataOptions: { HttpTokens: "required", HttpPutResponseHopLimit: 2 },
    TagSpecifications: [{
      ResourceType: "instance",
      Tags: [{ Key: "Name", Value: "siglens" }]
    }]
  }')
if aws ec2 describe-launch-templates --launch-template-names siglens-lt >/dev/null 2>&1; then
  aws ec2 create-launch-template-version --launch-template-name siglens-lt --version-description "$TAG" --launch-template-data "$LTDATA" --query 'LaunchTemplateVersion.VersionNumber' --output text
  aws ec2 modify-launch-template --launch-template-name siglens-lt --default-version '$Latest' >/dev/null
else
  aws ec2 create-launch-template --launch-template-name siglens-lt --version-description "$TAG" --launch-template-data "$LTDATA" >/dev/null
fi
log "launch template ready @ $TAG (AMI $AMI)"
