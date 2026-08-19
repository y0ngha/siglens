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
# user-data는 **gzip 후** base64로 넣는다. cloud-init이 gzip 매직바이트를 보고 알아서
# 푼다(공식 지원). EC2의 16,384바이트 상한은 base64 **디코드된** 바이트에 걸리므로,
# 압축하면 그만큼 여유가 생긴다.
#
# 왜 필요해졌나: 2026-08 cloudflared 전환으로 user-data에 systemd 유닛 5개와 헬스게이트·
# 라이프사이클·selfcheck 스크립트가 들어가면서 8,983 → 22,624바이트가 됐고,
# `CreateLaunchTemplateVersion`이 `InvalidUserData.Malformed`로 거부했다. 배포가
# 런치 템플릿 단계에서 죽어 ASG는 건드리지 않았지만, 그 전까지 아무도 크기를 재지 않았다.
# 주석을 깎아 맞추지 않는 이유: 그 주석들이 이 파일에서 가장 비싼 정보다.
UD_RAW=$(sed "s|__IMAGE_TAG__|$TAG|" "$(dirname "$0")/user-data.sh")
UD=$(printf '%s' "$UD_RAW" | gzip -9 | base64 | tr -d '\n')

# 상한을 **여기서** 검사한다. 안 하면 AWS가 배포 중반에 거부하고, 실패 지점이
# 원인(파일이 커졌다)에서 멀어진다.
UD_BYTES=$(printf '%s' "$UD" | base64 -d | wc -c | tr -d ' ')
if [ "$UD_BYTES" -gt 16384 ]; then
  log "ERROR: user-data가 gzip 후에도 ${UD_BYTES}바이트로 EC2 상한 16384를 넘는다."
  log "       임베드 스크립트를 골든 AMI(09-bake-ami.sh)로 옮길 시점이다."
  exit 1
fi
log "user-data: $(printf '%s' "$UD_RAW" | wc -c | tr -d ' ')B raw → ${UD_BYTES}B gzip (상한 16384)"
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
