#!/usr/bin/env bash
# EC2 부팅 스크립트: docker 설치 → SSM에서 env fetch → ECR pull → systemd로 컨테이너 실행.
# __IMAGE_TAG__ 는 05-launch-template.sh / deploy.sh 가 실제 태그로 치환한다.
set -euxo pipefail
REGION=ap-northeast-2

# 골든 AMI(M2) 감지: 09-bake-ami.sh가 docker·cloudwatch-agent·jq를 미리 설치하고
# /etc/siglens-golden-ami 마커를 남긴다. 마커가 있으면 부팅 시 dnf install을 건너뛰어
# 부팅을 빠르고 결정적으로 만든다(boot = env-fetch + docker pull(델타) + run).
# 마커가 없으면(=base AL2023에서 직접 기동) 기존처럼 부팅 시 설치한다.
if [ -f /etc/siglens-golden-ami ]; then
  echo "[user-data] golden AMI detected — skipping dnf installs (docker/cwagent/jq baked in)"
  systemctl enable --now docker
else
  dnf install -y docker jq amazon-cloudwatch-agent
  systemctl enable --now docker
fi

# InstanceId dimension intentionally omitted from append_dimensions: including it would cause
# each ASG instance to publish its own unique metric series, making custom-metric count grow
# linearly with fleet size (~$0.30/metric/mo per instance, ~30+ metrics at max ASG size).
# Keeping only AutoScalingGroupName means the aggregation_dimensions below still produces the
# {AutoScalingGroupName}-dimensioned metric that the disk-high/mem-high alarms in 07-alarms.sh
# target — alarm coverage is unchanged. Trade-off: no per-instance breakdown in CloudWatch;
# use SSM Session Manager or CloudWatch Logs for per-instance inspection instead.
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'CWCFG'
{
  "agent": { "metrics_collection_interval": 60, "run_as_user": "root" },
  "metrics": {
    "namespace": "CWAgent",
    "append_dimensions": {
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
# JSON + jq 파서(M6): --output text | awk -F'\t' 는 값에 탭/개행이 들어가면
# 필드를 깨뜨려 env가 손상된다(예: 멀티라인 PEM, base64). --output json + jq로
# Name/Value를 안전하게 추출한다. ltrimstr로 /siglens/ 접두를 제거.
# (참고: get-parameters-by-path는 --max-items 미지정 시 AWS CLI v2가 자동
#  페이지네이션하므로 수동 페이징은 불필요 — 10개 "truncation"은 오해다.)
aws ssm get-parameters-by-path --region "$REGION" --path /siglens/ --with-decryption \
  --output json \
  | jq -r '.Parameters[] | "\(.Name | ltrimstr("/siglens/"))=\(.Value)"' > /run/siglens/env
chmod 600 /run/siglens/env
FETCHSCRIPT
chmod +x /usr/local/bin/siglens-fetch-env.sh

# Run once now so the initial boot has the env-file ready before docker pull.
/usr/local/bin/siglens-fetch-env.sh

# ECR 로그인 + 이미지 pull
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR"
docker pull "$IMAGE"

# CloudWatch Logs(L4): 컨테이너 stdout/stderr를 awslogs 드라이버로 중앙 수집한다.
# json-file 로컬 로그는 인스턴스 종료(ASG roll/스케일인) 시 사라져 크래시 사후분석이
# 불가능했다. 로그 그룹은 09... 가 아니라 별도 infra 스크립트(10-logs.sh)가 생성하지만,
# 부팅 시에도 멱등하게 보장한다(레이스/순서 무관). 스트림은 인스턴스 ID로 구분.
# 필요 IAM: 인스턴스 역할에 logs:CreateLogStream, logs:PutLogEvents (+ CreateLogGroup).
LOG_GROUP=/siglens/app
TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60" || true)
INSTANCE_ID=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" \
  "http://169.254.169.254/latest/meta-data/instance-id" || echo unknown)
aws logs create-log-group --log-group-name "$LOG_GROUP" --region "$REGION" 2>/dev/null || true

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
# --security-opt no-new-privileges 적용: 컨테이너 프로세스의 권한 상승 차단.
# --cap-drop / --read-only 는 런타임 검증 후 적용 예정 (현재 보류).
# awslogs 드라이버로 stdout/stderr를 CloudWatch Logs($LOG_GROUP)로 전송(L4).
# 인스턴스가 사라져도 로그가 보존된다.
ExecStart=/usr/bin/docker run --rm --name siglens -p 3000:3000 --env-file /run/siglens/env --security-opt no-new-privileges:true --log-driver awslogs --log-opt awslogs-region=$REGION --log-opt awslogs-group=$LOG_GROUP --log-opt awslogs-stream=$INSTANCE_ID --log-opt awslogs-create-group=true $IMAGE
ExecStop=/usr/bin/docker stop -t 30 siglens
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now siglens
