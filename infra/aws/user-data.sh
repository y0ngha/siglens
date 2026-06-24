#!/usr/bin/env bash
# EC2 부팅 스크립트: docker 설치 → SSM에서 env fetch → ECR pull → systemd로 컨테이너 실행.
# __IMAGE_TAG__ 는 05-launch-template.sh / deploy.sh 가 실제 태그로 치환한다.
set -euxo pipefail
REGION=ap-northeast-2

dnf install -y docker
systemctl enable --now docker

# CloudWatch 에이전트: 디스크·메모리 지표 수집 (EC2 기본 지표에 없음)
dnf install -y amazon-cloudwatch-agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'CWCFG'
{
  "agent": { "metrics_collection_interval": 60, "run_as_user": "root" },
  "metrics": {
    "namespace": "CWAgent",
    "append_dimensions": {
      "InstanceId": "${aws:InstanceId}",
      "AutoScalingGroupName": "${aws:AutoScalingGroupName}"
    },
    "aggregation_dimensions": [["AutoScalingGroupName"]],
    "metrics_collected": {
      "disk": { "measurement": ["used_percent"], "resources": ["/"], "metrics_collection_interval": 60 },
      "mem":  { "measurement": ["mem_used_percent"], "metrics_collection_interval": 60 }
    }
  }
}
CWCFG
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
ECR="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
IMAGE="$ECR/siglens:__IMAGE_TAG__"

# /run is tmpfs — wiped on reboot. Write the SSM fetch as a standalone script so
# the systemd unit can re-run it as ExecStartPre on every (re)start, not just at
# cloud-init time. Without this, a reboot would leave /run/siglens/env missing and
# the Restart=always docker run would crash-loop forever.
cat > /usr/local/bin/siglens-fetch-env.sh <<'FETCHSCRIPT'
#!/usr/bin/env bash
set -euxo pipefail
REGION=ap-northeast-2
mkdir -p /run/siglens
aws ssm get-parameters-by-path --region "$REGION" --path /siglens/ --with-decryption \
  --query 'Parameters[].[Name,Value]' --output text \
  | sed 's#^/siglens/##' | awk -F'\t' '{print $1"="$2}' > /run/siglens/env
chmod 600 /run/siglens/env
FETCHSCRIPT
chmod +x /usr/local/bin/siglens-fetch-env.sh

# Run once now so the initial boot has the env-file ready before docker pull.
/usr/local/bin/siglens-fetch-env.sh

# ECR 로그인 + 이미지 pull
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR"
docker pull "$IMAGE"

# systemd 유닛 (graceful stop 30s — Dockerfile tini가 SIGTERM 전달)
# ExecStartPre order: fetch env first (re-populates /run/siglens/env after reboot),
# then remove any stale container, then docker run.
cat > /etc/systemd/system/siglens.service <<UNIT
[Unit]
Description=siglens
After=docker.service
Requires=docker.service
[Service]
TimeoutStopSec=35
ExecStartPre=/usr/local/bin/siglens-fetch-env.sh
ExecStartPre=-/usr/bin/docker rm -f siglens
ExecStart=/usr/bin/docker run --rm --name siglens -p 3000:3000 --env-file /run/siglens/env --log-opt max-size=10m --log-opt max-file=3 $IMAGE
ExecStop=/usr/bin/docker stop -t 30 siglens
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now siglens
