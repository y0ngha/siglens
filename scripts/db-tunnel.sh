#!/usr/bin/env bash
# 운영 RDS(private)로 가는 SSM 포트포워딩 터널.
#
# RDS는 default VPC 안에 있고 퍼블릭 접근이 없다. 살아 있는 siglens EC2 인스턴스를
# 점프 호스트 삼아 SSM Session Manager로 localhost:6543 → RDS:5432를 잇는다.
# SSH 키도, 열린 인바운드 포트도 필요 없다.
#
# 사용법: scripts/db-tunnel.sh [--host <rds-endpoint>]
#   --host 를 생략하면 SSM 파라미터 /siglens/RDS_ENDPOINT 에서 읽는다.
#   (infra가 RDS를 만들 때 이 파라미터를 게시한다 — 아직 없으면 --host로 넘길 것.)
#
# 환경변수:
#   AWS_PROFILE  기본 siglens.
#
# 요구: aws CLI + session-manager-plugin
#   macOS: brew install --cask session-manager-plugin
#
# ⚠️ 이 터널의 끝은 **운영 DB**다. 6543 포트로 향하는 URL은 db/scripts/lib/dbTarget.ts
# 가 호스트가 localhost여도 REMOTE로 분류해 쓰기를 막는다(ALLOW_REMOTE_DB_WRITE=1
# 없이는 거부). 그 판정이 이 번호에 기대므로 TUNNEL_PORT는 환경변수로 바꿀 수
# 없게 고정한다 — dbTarget.ts의 DB_TUNNEL_PORT, scripts/db-dev-seed-from-prod.sh와
# 반드시 같은 값이어야 한다.
set -euo pipefail

readonly TUNNEL_PORT=6543
readonly REGION="ap-northeast-2"
readonly ASG_NAME="siglens-asg"
readonly RDS_ENDPOINT_PARAM="/siglens/RDS_ENDPOINT"
PROFILE="${AWS_PROFILE:-siglens}"
RDS_HOST=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --host)
            RDS_HOST="${2:-}"
            if [[ -z "$RDS_HOST" ]]; then
                echo "[db-tunnel] --host 뒤에 RDS 엔드포인트가 필요하다" >&2
                exit 2
            fi
            shift 2
            ;;
        -h | --help)
            cat <<'USAGE'
운영 RDS(private)로 가는 SSM 포트포워딩 터널을 연다 (localhost:6543 -> RDS:5432).

사용법: scripts/db-tunnel.sh [--host <rds-endpoint>]
  --host   RDS 엔드포인트. 생략하면 SSM 파라미터 /siglens/RDS_ENDPOINT 에서 읽는다.

환경변수:
  AWS_PROFILE  기본 siglens.

요구: aws CLI + session-manager-plugin (macOS: brew install --cask session-manager-plugin)

이 터널의 끝은 운영 DB(PRODUCTION)다. 6543 포트는 dbTarget 쓰기 가드가 REMOTE로 취급한다.
USAGE
            exit 0
            ;;
        *)
            echo "사용법: $0 [--host <rds-endpoint>]" >&2
            exit 2
            ;;
    esac
done

if ! command -v aws >/dev/null 2>&1; then
    echo "[db-tunnel] aws CLI가 없다. https://docs.aws.amazon.com/cli/ 에서 설치할 것." >&2
    exit 1
fi

if ! command -v session-manager-plugin >/dev/null 2>&1; then
    cat >&2 <<'MSG'
[db-tunnel] session-manager-plugin이 없다.
  `aws ssm start-session`은 이 플러그인이 있어야 포트포워딩을 열 수 있다.
  macOS 설치:  brew install --cask session-manager-plugin
  그 외 OS:    https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html
MSG
    exit 1
fi

if lsof -nP -iTCP:"$TUNNEL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[db-tunnel] 로컬 포트 ${TUNNEL_PORT}가 이미 사용 중이다. 기존 터널을 먼저 종료할 것." >&2
    exit 1
fi

if [[ -z "$RDS_HOST" ]]; then
    RDS_HOST="$(aws ssm get-parameter \
        --profile "$PROFILE" --region "$REGION" \
        --name "$RDS_ENDPOINT_PARAM" --query 'Parameter.Value' --output text 2>/dev/null || true)"
    if [[ -z "$RDS_HOST" || "$RDS_HOST" == "None" ]]; then
        echo "[db-tunnel] SSM ${RDS_ENDPOINT_PARAM}를 읽지 못했다(infra가 RDS 생성 시 게시한다)." >&2
        echo "            --host <rds-endpoint> 로 직접 넘기거나 AWS_PROFILE(${PROFILE}) 권한을 확인할 것." >&2
        exit 1
    fi
fi

INSTANCE_ID="$(aws autoscaling describe-auto-scaling-groups \
    --profile "$PROFILE" --region "$REGION" \
    --auto-scaling-group-names "$ASG_NAME" \
    --query "AutoScalingGroups[0].Instances[?LifecycleState=='InService'].InstanceId | [0]" \
    --output text 2>/dev/null || true)"
if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
    echo "[db-tunnel] ASG ${ASG_NAME}에서 InService 인스턴스를 찾지 못했다." >&2
    exit 1
fi

cat <<MSG

==========================================================================
  ⛔ 운영 DATABASE에 연결하는 터널이다 (PRODUCTION)
  - 읽기 전용 확인 외에는 쓰지 말 것. 마이그레이션·백필·시드는 의도가 있을 때만.
  - dbTarget 가드가 이 포트(${TUNNEL_PORT})를 REMOTE로 취급한다.
    쓰기는 ALLOW_REMOTE_DB_WRITE=1 을 명시해야만 통과한다.
  - 끝나면 Ctrl-C로 터널을 닫을 것.
==========================================================================

  경유 인스턴스 : ${INSTANCE_ID}
  RDS 엔드포인트: ${RDS_HOST}

  접속 문자열 (비밀번호는 운영 자격증명으로 대체):
    postgres://<user>:<password>@localhost:${TUNNEL_PORT}/<database>?sslmode=require

MSG

exec aws ssm start-session \
    --profile "$PROFILE" --region "$REGION" \
    --target "$INSTANCE_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "host=${RDS_HOST},portNumber=5432,localPortNumber=${TUNNEL_PORT}"
