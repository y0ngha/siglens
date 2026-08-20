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
  echo "[user-data] golden AMI detected — skipping dnf installs (docker/cwagent/jq/cloudflared baked in)"
  systemctl enable --now docker
else
  dnf install -y docker jq amazon-cloudwatch-agent
  systemctl enable --now docker
fi

# cloudflared는 유일한 인바운드 경로다. **밖으로** 다이얼하므로 이 인스턴스는 열린
# 포트도, ACM 인증서도, Cloudflare IP 허용목록도 필요 없다(EC2 SG 인그레스 0개).
# siglens-trader 박스가 쓰는 것과 같은 저장소다.
#
# 골든 AMI 분기 **밖**에 두는 게 의도적이다. 09-bake-ami.sh가 cloudflared를 굽지만,
# 그 줄이 들어가기 전에 만들어진 기존 골든 AMI에는 없다 — 마커만 보고 건너뛰면
# cloudflared.service가 바이너리 없이 뜨다 죽는다(= 인그레스 전멸).
# 이미 있으면 즉시 통과하므로 구운 AMI에서는 비용이 0이다.
if ! command -v cloudflared >/dev/null 2>&1; then
  cat > /etc/yum.repos.d/cloudflared.repo <<'REPO'
[cloudflared]
name=cloudflared
baseurl=https://pkg.cloudflare.com/cloudflared/rpm
enabled=1
type=rpm
gpgcheck=1
gpgkey=https://pkg.cloudflare.com/cloudflare-main.gpg
REPO
  dnf install -y cloudflared
fi

# InstanceId dimension intentionally omitted from append_dimensions: including it would cause
# each ASG instance to publish its own unique metric series, making custom-metric count grow
# linearly with fleet size (~$0.30/metric/mo per instance, ~30+ metrics at max ASG size).
# Keeping only AutoScalingGroupName means the aggregation_dimensions below still produces the
# {AutoScalingGroupName}-dimensioned metric that the disk-high/mem-high alarms in 07-alarms.sh
# target — alarm coverage is unchanged. Trade-off: no per-instance breakdown in CloudWatch;
# use SSM Session Manager or CloudWatch Logs for per-instance inspection instead.
# logs 섹션: /var/log/siglens-ops.log를 /siglens/app으로 보낸다. cloudflared·systemd
# 로그는 journald에만 남고 awslogs 드라이버(컨테이너 stdout 전용)에도 안 잡히므로,
# 이 파일이 온박스 사건을 CloudWatch로 보내는 유일한 통로다.
# retention은 지정하지 않는다 — 인스턴스 역할에 logs:PutRetentionPolicy가 없고,
# /siglens/app의 보존기간은 10-logs.sh가 소유한다.
# ⚠️ 이 JSON에 주석/미지 키를 넣지 말 것. config translator가 거부하면 fetch-config가
#    비-0으로 끝나고 set -e가 docker pull 전에 부팅을 죽인다.
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
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/siglens-ops.log",
            "log_group_name": "/siglens/app",
            "log_stream_name": "{instance_id}-ops"
          }
        ]
      }
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
# ── 로컬 헬스 게이트 ──────────────────────────────────────────────────────────
# 앱이 리슨하기 전에 cloudflared가 터널에 붙으면, 타깃 그룹에 unhealthy 타깃을
# 등록한 것과 정확히 같은 상태가 된다 — Cloudflare가 이 복제본으로 라우팅하고
# connection refused를 받는다. 이 스크립트가 **타깃 그룹 헬스체크를 온박스로 옮긴 것**이다.
# 60 × 5초 = 300초. 인스턴스 기동부터 Next.js Ready까지는 실측 31초였다.
cat > /usr/local/bin/siglens-wait-healthy.sh <<'WAIT'
#!/usr/bin/env bash
for _ in $(seq 1 60); do
  curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null && exit 0
  sleep 5
done
echo "[wait-healthy] app not healthy after 300s" >&2
exit 1
WAIT
chmod +x /usr/local/bin/siglens-wait-healthy.sh

# ── cloudflared ──────────────────────────────────────────────────────────────
# TUNNEL_GRACE_PERIOD=180s가 ALB의 deregistration_delay=185를 대체한다. SIGTERM을
# 받으면 새 요청 수신을 멈추고 인플라이트를 이 값까지 배수한다(기본 30초는 180초
# SSE 드레인에 턱없이 짧다).
#
# **180초가 cloudflared의 하드 상한이다** — 185s를 주면 기동 자체가 거부된다
# (`grace-period must be equal or less than 3m0s`, 실측 2026.8.2). ALB의 185초와
# 다른 값인 게 의도적이다.
#
# 드레인 예산이 ALB 때보다 오히려 넉넉해졌다: ALB는 등록해제 185초가 끝나야 앱에
# SIGTERM이 갔지만, 여기서는 systemd가 cloudflared를 **먼저** 내리고(최대 180초
# 인플라이트 배수, 이때 앱은 아직 살아 있다) 그 다음 앱을 내린다(docker stop -t 185
# → 180초 드레인). 둘이 순차라 합이 최대 ~365초다.
#
# `Requires=siglens.service` + `After=`가 핵심이다: systemd가 앱 **뒤에** 띄우고,
# 더 중요하게는 앱 **앞에** 내린다. 그 순서가 드레인 설계 전부다 —
# Cloudflare가 먼저 이 박스로 라우팅을 멈추고, 그 다음 앱이 배수한다.
#
# 토큰은 SSM SecureString. EC2 역할이 이미 /siglens/* 에 ssm:GetParameter를 갖고 있어
# IAM 변경이 필요 없다.
cat > /etc/systemd/system/cloudflared.service <<TUNNEL
[Unit]
Description=Cloudflare Tunnel (siglens origin ingress)
After=network-online.target siglens.service
Wants=network-online.target
Requires=siglens.service
[Service]
Environment=TUNNEL_GRACE_PERIOD=180s
Environment=TUNNEL_METRICS=127.0.0.1:2000
ExecStartPre=/usr/local/bin/siglens-wait-healthy.sh
ExecStart=/bin/sh -c '/usr/bin/cloudflared tunnel --no-autoupdate run --token \$(aws ssm get-parameter --region $REGION --name /siglens/TUNNEL_TOKEN --with-decryption --query Parameter.Value --output text)'
TimeoutStartSec=360
TimeoutStopSec=190
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
TUNNEL

# ── ASG 라이프사이클 훅 ───────────────────────────────────────────────────────
# ALB를 떼면 `health-check-type ELB`가 하던 배포 시퀀싱이 사라진다. 이 두 스크립트가
# 그걸 대체한다.
#
# launch: 앱과 터널이 **둘 다** 살아난 뒤에 훅을 완료한다. 그 전까지 인스턴스는
#   Pending:Wait(=InService 아님)라 MinHealthyPercentage를 만족시키지 못하고,
#   instance refresh는 옛 인스턴스를 건드리지 못한다. ELB 헬스체크는 /api/health만
#   봤으므로 이쪽이 오히려 더 엄격하다.
cat > /usr/local/bin/siglens-lifecycle-launch.sh <<'LAUNCH'
#!/usr/bin/env bash
set -uo pipefail
REGION=ap-northeast-2
imds() {
  local t
  t=$(curl -sf -X PUT http://169.254.169.254/latest/api/token \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 300") || return 1
  curl -sf -H "X-aws-ec2-metadata-token: $t" "http://169.254.169.254/latest/meta-data/$1"
}
# 60 × 5초 = 300초. 앱은 이 시점에 이미 wait-healthy로 증명됐으므로 터널만 기다린다.
# 훅 예산 600초에서 부팅(cloud-init + dnf + docker pull + 앱 기동)이 이미 상당량을
# 쓰고 시작하므로, 여기서 500초를 더 쓰면 ABANDON이 폴링보다 먼저 터진다.
for _ in $(seq 1 60); do
  curl -fsS -m 2 http://127.0.0.1:2000/ready >/dev/null && break
  sleep 5
done
# ⚠️ 이 줄이 게이트의 전부다. 없으면 루프가 그냥 만료되고 아래에서 CONTINUE를 보내,
# 터널이 죽은 인스턴스가 InService가 된다 — MinHealthyPercentage가 충족되면서
# 마지막 정상 인스턴스가 드레인되고 인그레스가 0이 된다.
# 실패는 조용히 넘기지 말고 훅이 ABANDON으로 떨어지게 둘 것(= refresh 실패,
# 옛 인스턴스는 그대로 유지).
curl -fsS -m 2 http://127.0.0.1:2000/ready >/dev/null || {
  echo "[lifecycle-launch] tunnel not ready — letting the hook ABANDON" >&2
  exit 1
}
IID=$(imds instance-id) || exit 0
aws autoscaling complete-lifecycle-action --region "$REGION" \
  --auto-scaling-group-name siglens-asg \
  --lifecycle-hook-name siglens-launch-gate \
  --instance-id "$IID" --lifecycle-action-result CONTINUE
LAUNCH

# drain: IMDS의 target-lifecycle-state가 Terminating:Wait 동안 "Terminated"로 바뀐다.
#   터널을 **먼저** 내리고(Cloudflare가 이 박스로 라우팅 중단), 그 다음 앱을 내린 뒤
#   (docker stop -t 185 → 180초 SSE 드레인) 훅을 푼다.
#   훅이 없으면 EC2가 강제 전원차단까지 얼마나 기다리는지가 문서화돼 있지 않아
#   드레인이 비결정적이 된다.
cat > /usr/local/bin/siglens-lifecycle-drain.sh <<'DRAIN'
#!/usr/bin/env bash
set -uo pipefail
REGION=ap-northeast-2
imds() {
  local t
  t=$(curl -sf -X PUT http://169.254.169.254/latest/api/token \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 300") || return 1
  curl -sf -H "X-aws-ec2-metadata-token: $t" "http://169.254.169.254/latest/meta-data/$1"
}
while true; do
  STATE=$(imds autoscaling/target-lifecycle-state) || { sleep 5; continue; }
  [ "$STATE" = "Terminated" ] && break
  sleep 5
done
echo "[drain] terminating — stopping tunnel then app"
systemctl stop cloudflared
systemctl stop siglens
IID=$(imds instance-id) || exit 0
aws autoscaling complete-lifecycle-action --region "$REGION" \
  --auto-scaling-group-name siglens-asg \
  --lifecycle-hook-name siglens-drain-gate \
  --instance-id "$IID" --lifecycle-action-result CONTINUE || true
exit 0
DRAIN

# selfcheck: `health-check-type EC2`는 인스턴스 사망만 감지한다. 이 타이머가 앱 사망을
#   감지해 **교체까지** 시킨다 — systemd가 StartLimitBurst(120초 5회)로 포기한
#   "박스는 살아 있고 앱만 죽은" 상태까지 잡으므로 ELB 헬스체크보다 넓다.
#   2회 연속 실패에서만 동작해 단발 블립으로는 교체하지 않는다.
cat > /usr/local/bin/siglens-selfcheck.sh <<'CHK'
#!/usr/bin/env bash
set -uo pipefail
mkdir -p /run/siglens
# 로그는 CloudWatch 에이전트가 수집하는 파일로 쓴다. cloudflared·systemd 로그는
# journald에만 남고 awslogs 드라이버(컨테이너 stdout 전용)에도 안 잡히므로,
# 이 파일이 온박스 사건을 CloudWatch로 보내는 유일한 통로다.
OPS=/var/log/siglens-ops.log
say() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$OPS"; }

# (1) 인그레스: cloudflared가 엣지 연결을 유지 중인가. 죽으면 사이트 전체가 죽는다.
#     ASG 교체는 유발하지 않는다 — Restart=always가 먼저 시도하고, 알람이 사람을 부른다.
if ! curl -fsS -m 3 http://127.0.0.1:2000/ready >/dev/null; then
  say "[cloudflared-down] tunnel /ready not answering"
fi

# (2) 앱: 2회 연속 실패면 인스턴스를 Unhealthy로 표시해 ASG가 교체하게 한다.
#     systemd가 StartLimitBurst(120초 5회)로 포기한 "박스는 살아 있고 앱만 죽은"
#     상태까지 잡는다 — 옛 health-check-type=ELB가 하던 것보다 넓다.
if curl -fsS -m 3 http://127.0.0.1:3000/api/health >/dev/null; then
  rm -f /run/siglens/unhealthy
  exit 0
fi
[ -f /run/siglens/unhealthy ] || { touch /run/siglens/unhealthy; exit 0; }
T=$(curl -sf -X PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60") || exit 0
IID=$(curl -sf -H "X-aws-ec2-metadata-token: $T" \
  http://169.254.169.254/latest/meta-data/instance-id) || exit 0
say "[selfcheck] /api/health failed twice — marking $IID Unhealthy"
aws autoscaling set-instance-health --region ap-northeast-2 \
  --instance-id "$IID" --health-status Unhealthy
CHK
touch /var/log/siglens-ops.log
chmod +x /usr/local/bin/siglens-lifecycle-launch.sh          /usr/local/bin/siglens-lifecycle-drain.sh          /usr/local/bin/siglens-selfcheck.sh

cat > /etc/systemd/system/siglens-lifecycle-launch.service <<'UNIT2'
[Unit]
Description=Complete ASG launch lifecycle hook once app+tunnel are live
After=cloudflared.service
[Service]
Type=oneshot
ExecStart=/usr/local/bin/siglens-lifecycle-launch.sh
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
UNIT2

cat > /etc/systemd/system/siglens-lifecycle-drain.service <<'UNIT3'
[Unit]
Description=Drain tunnel+app when ASG parks this instance in Terminating:Wait
After=cloudflared.service
[Service]
Type=simple
ExecStart=/usr/local/bin/siglens-lifecycle-drain.sh
# on-failure다. always면 드레인을 정상 완료한 뒤에도 10초마다 재시작해 IMDS를 다시
# 읽고 complete-lifecycle-action을 재호출한다 — 이미 완료된 액션이라 ValidationError로
# 떨어지고, 그게 다시 비-0 종료라 전원이 꺼질 때까지 루프가 돈다.
# 스크립트 내부 폴링이 IMDS 블립을 이미 흡수하므로 실제 실패는 드물다.
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
UNIT3

cat > /etc/systemd/system/siglens-selfcheck.service <<'UNIT4'
[Unit]
Description=Mark instance Unhealthy when the app stops answering /api/health
[Service]
Type=oneshot
ExecStart=/usr/local/bin/siglens-selfcheck.sh
UNIT4

cat > /etc/systemd/system/siglens-selfcheck.timer <<'UNIT5'
[Unit]
Description=Run siglens-selfcheck every minute
[Timer]
# OnActiveSec(타이머 활성화 시점 기준)이지 OnBootSec(부팅 시각 기준)이 아니다.
# 이 타이머는 dnf·docker pull·앱 기동이 다 끝난 뒤에야 enable되므로, OnBootSec이면
# 부팅이 300초만 넘어도 유예가 0이 되어 즉시 첫 검사가 돈다.
OnActiveSec=300
OnUnitActiveSec=60
[Install]
WantedBy=timers.target
UNIT5

systemctl daemon-reload

# 순서가 중요하다. `cloudflared.service`는 `ExecStartPre=siglens-wait-healthy.sh`로
# 최대 300초 블록하고, 앱이 그 안에 못 뜨면 `systemctl start`가 비-0으로 끝난다.
# 이 파일은 `set -euxo pipefail`이라 거기서 user-data 전체가 죽는다 — 그러면 아래
# 라이프사이클/셀프체크 유닛이 **하나도 활성화되지 않고**, launch 훅은 600초 뒤
# ABANDON, ASG의 `TerminateHookAbandon: terminate` 정책이 인스턴스를 죽이고,
# min-size 1이 같은 실패를 무한 반복한다(서빙 용량 0, 알람 없음).
#
# 그래서 (a) 훅 유닛들을 cloudflared **앞에** 활성화하고,
#        (b) cloudflared는 `--no-block`으로 띄운다.
# 부팅이 느려도 훅 스크립트는 살아 있어 ABANDON 대신 정상 실패 경로를 탄다.
systemctl enable --now siglens
systemctl enable --now siglens-lifecycle-launch
systemctl enable --now siglens-lifecycle-drain
systemctl enable --now siglens-selfcheck.timer
systemctl enable cloudflared
systemctl start --no-block cloudflared
