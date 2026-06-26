#!/usr/bin/env bash
# OPT-IN: CloudWatch Synthetics 카나리 — /api/ready 능동 레디니스 모니터링.
#
# ⚠️  BILLABLE 리소스를 생성한다:
#   - S3 아티팩트 버킷 (카나리 결과 저장)
#   - CloudWatch Synthetics 카나리 실행 (rate(5 minutes), ~$0.0012/실행)
#   - IAM 역할 (카나리 런타임 권한)
#   - CloudWatch 알람 (ALARM_SNS 토픽 트리거)
#
# 이 스크립트는 deploy.sh가 자동 실행하지 않는다. 운영자가 명시적으로 수동 실행해야 한다.
# 레디니스 모니터링이 필요할 때 단독 실행: bash infra/aws/11-readiness-canary.sh
#
# 배경:
#   /api/ready는 Neon DB + Upstash Redis 도달성을 확인하는 deep probe다.
#   07-alarms.sh의 ALB 5xx 알람은 하드 장애만 커버한다; DB/Redis 접속 실패가 5xx를
#   발생시키지 않는 경우(예: 준비 중인 인스턴스, 냉각 중 연결 복구)는 감지하지 못한다.
#   이 카나리는 /api/ready를 5분마다 직접 HTTP GET하여 그 간극을 메운다.
set -euo pipefail
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
require aws
require jq

REGION="${AWS_REGION:-ap-northeast-2}"
CANARY_NAME="siglens-readiness"
SITE_URL="${SITE_URL:-https://siglens.io}"
READY_URL="${SITE_URL}/api/ready"
ARTIFACT_BUCKET="siglens-synthetics-artifacts"
IAM_ROLE_NAME="siglens-synthetics-canary-role"
ALARM_NAME="siglens-readiness-canary-failed"
# CloudWatch Synthetics 런타임 버전. AWS는 런타임을 주기적으로 deprecate하며,
# deprecated 런타임의 카나리는 조용히 실행이 중단된다. 배포 전
# `aws synthetics describe-runtime-versions`로 최신 지원 버전을 확인하고 필요 시 bump할 것.
RUNTIME_VERSION="syn-nodejs-puppeteer-9.1"

# ALARM_SNS: 07-alarms.sh と同じ変数を使用 — .env または .ids から注入される.
# 未設定の場合は通知なし.
ACTIONS=""
[[ -n "${ALARM_SNS:-}" ]] && ACTIONS="--alarm-actions $ALARM_SNS"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")

# ── S3 아티팩트 버킷 (카나리 결과 저장, 멱등) ──────────────────────────────
log "ensuring S3 artifact bucket: $ARTIFACT_BUCKET"
if ! aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" 2>/dev/null; then
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
  # 퍼블릭 액세스 차단 (아티팩트는 비공개)
  aws s3api put-public-access-block --bucket "$ARTIFACT_BUCKET" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  log "S3 bucket $ARTIFACT_BUCKET created"
else
  log "S3 bucket $ARTIFACT_BUCKET already exists (ok)"
fi

# ── IAM 역할 (카나리 런타임 권한, 멱등) ────────────────────────────────────
log "ensuring IAM role: $IAM_ROLE_NAME"
ROLE_ARN=$(aws iam get-role --role-name "$IAM_ROLE_NAME" \
  --query 'Role.Arn' --output text 2>/dev/null) || true

if [ -z "$ROLE_ARN" ] || [ "$ROLE_ARN" = "None" ]; then
  TRUST_POLICY=$(cat <<'TRUST'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
TRUST
)
  ROLE_ARN=$(aws iam create-role \
    --role-name "$IAM_ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --query 'Role.Arn' --output text)
  log "IAM role $IAM_ROLE_NAME created: $ROLE_ARN"

  # 카나리가 S3에 아티팩트를 쓰고 CloudWatch Logs에 로그를 남기는 데 필요한 최소 권한.
  INLINE_POLICY=$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetBucketLocation"],
      "Resource": [
        "arn:aws:s3:::${ARTIFACT_BUCKET}",
        "arn:aws:s3:::${ARTIFACT_BUCKET}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:/aws/synthetics/*"
    },
    {
      "Effect": "Allow",
      "Action": "cloudwatch:PutMetricData",
      "Resource": "*",
      "Condition": {
        "StringEquals": { "cloudwatch:namespace": "CloudWatchSynthetics" }
      }
    }
  ]
}
POLICY
)
  aws iam put-role-policy \
    --role-name "$IAM_ROLE_NAME" \
    --policy-name "${IAM_ROLE_NAME}-policy" \
    --policy-document "$INLINE_POLICY"
  log "IAM inline policy attached"
  # IAM 전파 대기 (카나리 생성이 즉시 실패하는 것을 방지)
  log "waiting 10s for IAM propagation..."
  sleep 10
else
  log "IAM role $IAM_ROLE_NAME already exists: $ROLE_ARN"
fi

# ── Synthetics 카나리 스크립트 (Node.js 런타임) ─────────────────────────────
# /api/ready에 HTTP GET을 보내고 HTTP 200이면 성공, 그 외 실패로 기록한다.
CANARY_SCRIPT=$(cat <<SCRIPT
var synthetics = require('Synthetics');
var log = require('SyntheticsLogger');

var readinessCheck = async function () {
  var url = '${READY_URL}';
  var response = await synthetics.executeHttpStep('GET /api/ready', url, {
    method: 'GET',
    headers: { 'User-Agent': 'CloudWatch-Synthetics-Canary' }
  });
  log.info('status: ' + response.statusCode);
  if (response.statusCode !== 200) {
    throw new Error('/api/ready returned ' + response.statusCode);
  }
};

exports.handler = async function () {
  return await readinessCheck();
};
SCRIPT
)

# CloudWatch Synthetics는 ZIP 아카이브 형태로 코드를 업로드한다.
# 인라인 코드(S3 경유)를 사용하므로 임시 zip을 생성한다.
TMPDIR_CANARY=$(mktemp -d)
SCRIPT_DIR="${TMPDIR_CANARY}/nodejs/node_modules/readiness_check"
mkdir -p "$SCRIPT_DIR"
printf '%s' "$CANARY_SCRIPT" > "${SCRIPT_DIR}/readiness_check.js"
(cd "$TMPDIR_CANARY" && zip -r canary.zip nodejs/ -x "*.DS_Store" >/dev/null)
aws s3 cp "${TMPDIR_CANARY}/canary.zip" "s3://${ARTIFACT_BUCKET}/canary/canary.zip" >/dev/null
rm -rf "$TMPDIR_CANARY"
log "canary script uploaded to s3://${ARTIFACT_BUCKET}/canary/canary.zip"

# ── CloudWatch Synthetics 카나리 생성/업데이트 (멱등) ──────────────────────
log "creating/updating Synthetics canary: $CANARY_NAME"
EXISTING_CANARY=$(aws synthetics describe-canaries \
  --query "Canaries[?Name=='${CANARY_NAME}'].Name" \
  --output text --region "$REGION" 2>/dev/null) || true

CANARY_CONFIG=$(cat <<CONFIG
{
  "S3Bucket": "${ARTIFACT_BUCKET}",
  "S3Key": "canary/canary.zip",
  "Handler": "readiness_check.handler"
}
CONFIG
)

if [ -z "$EXISTING_CANARY" ] || [ "$EXISTING_CANARY" = "None" ]; then
  aws synthetics create-canary \
    --name "$CANARY_NAME" \
    --code "$CANARY_CONFIG" \
    --artifact-s3-location "s3://${ARTIFACT_BUCKET}/canary-results" \
    --execution-role-arn "$ROLE_ARN" \
    --schedule "Expression=rate(5 minutes)" \
    --runtime-version "$RUNTIME_VERSION" \
    --region "$REGION" >/dev/null
  log "canary $CANARY_NAME created"

  # 카나리 시작
  aws synthetics start-canary --name "$CANARY_NAME" --region "$REGION"
  log "canary $CANARY_NAME started"
else
  aws synthetics update-canary \
    --name "$CANARY_NAME" \
    --code "$CANARY_CONFIG" \
    --execution-role-arn "$ROLE_ARN" \
    --schedule "Expression=rate(5 minutes)" \
    --runtime-version "$RUNTIME_VERSION" \
    --region "$REGION" >/dev/null
  log "canary $CANARY_NAME updated"
fi

# ── CloudWatch 알람 (카나리 실패 시 SNS 알림, 07-alarms.sh 스타일) ─────────
# SuccessPercent < 100 for 2 evaluation periods (10 minutes) = 알람
log "creating/updating alarm: $ALARM_NAME"
aws cloudwatch put-metric-alarm \
  --alarm-name "$ALARM_NAME" \
  --namespace CloudWatchSynthetics \
  --metric-name SuccessPercent \
  --dimensions "Name=CanaryName,Value=${CANARY_NAME}" \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 100 \
  --comparison-operator LessThanThreshold \
  --treat-missing-data breaching \
  --region "$REGION" \
  $ACTIONS

log "alarm $ALARM_NAME created/updated"
log "readiness canary setup complete — $CANARY_NAME polling $READY_URL every 5 minutes"
