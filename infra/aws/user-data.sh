#!/usr/bin/env bash
# EC2 부팅 스크립트: docker 설치 → SSM에서 env fetch → ECR pull → systemd로 컨테이너 실행.
# __IMAGE_TAG__ 는 05-launch-template.sh / deploy.sh 가 실제 태그로 치환한다.
set -euxo pipefail
REGION=ap-northeast-2

dnf install -y docker
systemctl enable --now docker

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
ECR="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
IMAGE="$ECR/siglens:__IMAGE_TAG__"

# SSM /siglens/* → env-file (인스턴스 역할이 복호화)
mkdir -p /run/siglens
aws ssm get-parameters-by-path --region "$REGION" --path /siglens/ --with-decryption \
  --query 'Parameters[].[Name,Value]' --output text \
  | sed 's#^/siglens/##' | awk -F'\t' '{print $1"="$2}' > /run/siglens/env
chmod 600 /run/siglens/env

# ECR 로그인 + 이미지 pull
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR"
docker pull "$IMAGE"

# systemd 유닛 (graceful stop 30s — Dockerfile tini가 SIGTERM 전달)
cat > /etc/systemd/system/siglens.service <<UNIT
[Unit]
Description=siglens
After=docker.service
Requires=docker.service
[Service]
TimeoutStopSec=35
ExecStartPre=-/usr/bin/docker rm -f siglens
ExecStart=/usr/bin/docker run --rm --name siglens -p 3000:3000 --env-file /run/siglens/env $IMAGE
ExecStop=/usr/bin/docker stop -t 30 siglens
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now siglens
