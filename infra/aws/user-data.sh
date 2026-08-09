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

# systemd 유닛 — Dockerfile tini가 SIGTERM을 컨테이너 프로세스에 전달.
# graceful stop 타이밍(Fix 3, 06-alb-asg.sh와 정합):
#   - deregistration_delay 185s  ≥  instrumentation drain deadline(180s)
#   - docker stop -t 185s        >  drain deadline(SIGTERM → process.exit(0) 이후 멈춤)
#   - TimeoutStopSec=190s        ≥  docker stop -t(systemd 안전망)
# ExecStartPre order: fetch env first (re-populates /run/siglens/env after reboot),
# then remove any stale container, then docker run.
cat > /etc/systemd/system/siglens.service <<UNIT
[Unit]
Description=siglens
After=docker.service
Requires=docker.service
# SSM/KMS 스로틀 방지 (M3): ExecStartPre가 매 재시작마다 SSM GetParametersByPath +
# KMS Decrypt를 호출한다. 크래시 루프 시 플릿 전체가 단시간에 수백 회 호출→계정 단위
# SSM/KMS 스로틀로 번질 수 있다. 120s 안에 5회 초과 재시작 시 systemd가 유닛을 멈추고
# ASG/ELB unhealthy 경로가 인스턴스를 교체하도록 위임한다.
StartLimitIntervalSec=120
StartLimitBurst=5
[Service]
TimeoutStopSec=190
ExecStartPre=/usr/local/bin/siglens-fetch-env.sh
ExecStartPre=-/usr/bin/docker rm -f siglens
# --security-opt no-new-privileges 적용: 컨테이너 프로세스의 권한 상승 차단.
# --cap-drop / --read-only 는 런타임 검증 후 적용 예정 (현재 보류).
# awslogs 드라이버로 stdout/stderr를 CloudWatch Logs($LOG_GROUP)로 전송(L4).
# 인스턴스가 사라져도 로그가 보존된다.
#
# 메모리 상한 2층 (worker 제거 이후 도입). 값은 프로덕션 실측 기반이다:
#
#   CWAgent mem_used_percent 7일(2026-08-02~08-09), t4g.medium 실사용 ~3.8GiB 기준
#     평균 24.1% =  938MiB (호스트+컨테이너 전체)
#     최대 44.2% = 1720MiB
#   호스트(AL2023+dockerd+CloudWatch/SSM agent)를 ~500MiB로 보면 컨테이너 피크는 ~1220MiB.
#   여기에 분석 인플라이트(동시 24건 × bars+지표+프롬프트, GC 지연 포함 +200~300MiB)를
#   더해 배포 후 예상 피크 ~1.5GiB.
#
#   --memory=2.5g        컨테이너 하드 리밋. 예상 피크의 ~1.7배 여유이면서 호스트에
#                        1.3GiB를 남긴다. (3g로 잡으면 호스트 여유가 300MiB뿐이라,
#                        컨테이너가 한계에 근접할 때 커널이 dockerd나 CW agent를 죽일 수
#                        있다 — 앱이 죽는 것보다 진단이 어렵다.)
#   --memory-swap=2.5g   memory와 같은 값 = 스왑 사용 안 함. 다르면 한계 도달 시
#                        스와핑으로 늘어지며 응답이 조용히 느려진다 — 차라리 빨리 죽는 게 낫다.
#   --max-old-space-size Node 힙 상한 1536MiB. **컨테이너 리밋보다 낮게** 잡는 게 핵심이다.
#     =1536              나머지 ~1GiB는 힙 밖(Buffer, 네이티브, 코드, 스택) 몫이다.
#
# 왜 Node 상한이 더 낮아야 하나: 힙이 먼저 차면 Node가 GC를 공격적으로 돌려 버티고,
# 그래도 안 되면 "JavaScript heap out of memory"를 **로그에 남기고** 종료한다. 반대로
# 컨테이너 리밋이 먼저 닿으면 커널 OOM killer가 프로세스를 조용히 죽여 원인이 안 남는다.
#
# 이 상한이 필요해진 이유: worker 제거로 LLM 호출이 앱 프로세스 안에서 돌면서, 요청당
# bars(252봉)+지표 39종+프롬프트를 동시 분석 수만큼 들고 있게 됐다. 앞단의 동시 분석
# 상한(24, activeStreams.ts)이 1차 방어이고 이건 그게 뚫렸을 때의 안전망이다.
ExecStart=/usr/bin/docker run --rm --name siglens -p 3000:3000 --memory=2.5g --memory-swap=2.5g -e NODE_OPTIONS=--max-old-space-size=1536 --env-file /run/siglens/env --security-opt no-new-privileges:true --log-driver awslogs --log-opt awslogs-region=$REGION --log-opt awslogs-group=$LOG_GROUP --log-opt awslogs-stream=$INSTANCE_ID --log-opt awslogs-create-group=true $IMAGE
ExecStop=/usr/bin/docker stop -t 185 siglens
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now siglens
