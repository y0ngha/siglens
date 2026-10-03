#!/usr/bin/env bash
#
# infra/aws/15-rds.sh — 운영 Postgres(RDS) 프로비저닝 (멱등)
#
# Neon(싱가포르) → AWS RDS PostgreSQL 17 이전의 인프라 부분이다. 절차 전체(롤/스키마/
# 논리 복제/컷오버/롤백)는 docs/architecture/RDS_MIGRATION.md가 정본이고, 이 스크립트는
# 그 §1(RDS 생성)과 §4(복제 구간의 공개 토글)만 맡는다.
#
# 만드는 것:
#   - DB 서브넷 그룹  siglens-db-subnets   (기본 VPC의 2a/2b/2c 서브넷)
#   - 보안 그룹       siglens-rds-sg       (5432 인그레스: siglens-ec2-sg + siglens-trader-sg만)
#   - 파라미터 그룹   siglens-pg17         (postgres17: SSL 강제, 슬로우 쿼리 로그)
#   - 인스턴스        siglens-db           (db.t4g.small, Single-AZ 2a, gp3 20GB→50GB 자동확장)
#   - SSM             /siglens-rds/MASTER_PASSWORD (SecureString), /siglens/RDS_ENDPOINT (String)
#
# 사용법:
#     bash infra/aws/15-rds.sh                # 생성(멱등) — 이미 있으면 건너뛰고 엔드포인트만 재게시
#     bash infra/aws/15-rds.sh --make-public  # 복제 구간 동안만: PubliclyAccessible=true
#     bash infra/aws/15-rds.sh --make-private # 복제 종료 후: PubliclyAccessible=false
#
# 전제:
#   - siglens-deployer에 RDS 권한이 있어야 한다. 이 권한은 00-iam-setup.sh가 부여한다
#     (iam/deployer-rds-policy.json을 고객 관리형 정책 siglens-deployer-rds로 게시: ap-northeast-2 +
#     siglens-* 리소스로 한정, 삭제·RI 구매 제외. rds 서비스 연결 역할도 함께 만든다). admin
#     자격증명으로 00-iam-setup.sh를 먼저 다시 돌려야 한다 — 안 하면 첫 rds 호출이 AccessDenied로 죽는다.
#   - 02-network.sh가 만든 .ids(VPC_ID, EC2_SG)가 있어야 한다.
#
# ⚠️ 이 스크립트는 deploy 어디서도 자동 호출되지 않는다(인프라 부트스트랩은 수동).
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/.env"
source "$(dirname "$0")/.ids"
require aws
require openssl

DB_ID="${RDS_DB_ID:-siglens-db}"
SUBNET_GROUP="siglens-db-subnets"
PARAM_GROUP="siglens-pg17"
RDS_SG_NAME="siglens-rds-sg"
TRADER_SG_NAME="siglens-trader-sg"
MASTER_USER="siglens_admin"
AZ="ap-northeast-2a"

# 엔진 버전은 메이저만 지정한다 — RDS가 그 메이저의 기본 마이너를 고른다. Neon이 17.11이고
# 논리 복제는 같은 메이저의 어떤 17.x 사이에서도 동작하므로 마이너 고정이 필요 없다.
# 특정 마이너가 필요하면 RDS_ENGINE_VERSION=17.x 로 덮어쓴다.
ENGINE_VERSION="${RDS_ENGINE_VERSION:-17}"

# SSM 파라미터 이름. 비밀(마스터 비밀번호 등)은 `/siglens/` 밖의 **별도 루트 `/siglens-rds/`**에 둔다.
#  - 앱의 env 주입(user-data.sh siglens-fetch-env.sh)은 `get-parameters-by-path /siglens/`
#    (비재귀)라서 `/siglens/` 직하위는 전부 앱 컨테이너 env로 실린다.
#  - 중첩 경로 `/siglens/rds/*`로 숨겨도 소용없다: EC2 역할(ReadAppSecrets)과 CI 역할
#    (EnvCompletenessCheck, 재귀 GetParametersByPath)의 IAM 패턴이 모두 `parameter/siglens/*`라
#    중첩 경로까지 읽을 수 있고, `/siglens/` 경로에 대한 GetParametersByPath는 하위 경로에 건
#    명시적 Deny로 막을 수도 없다.
#  - `/siglens-rds/`는 앱의 env 주입 경로와 두 역할의 `parameter/siglens/*` 패턴 밖이라 앱·CI는
#    허용 규칙이 없어 읽지 못한다(CI 쪽 Deny는 ci-deploy-policy.json 소관 — 별도 PR).
#  - **EC2 역할은 허용 규칙이 따로 있다**: 관리형 AmazonSSMManagedInstanceCore가
#    ssm:GetParameter(s)를 Resource "*"로 허용하고 DecryptSecrets가 ssm 경유 kms:Decrypt를
#    허용하므로, 명시적 Deny(ec2-role-policy.json의 DenyRdsSecrets, `parameter/siglens-rds[/*]`)로
#    막는다. 겹치는 경로가 없는 별도 루트라서 이 Deny가 실제로 동작한다.
#    운영자는 siglens-deployer/admin 프로파일(AmazonSSMFullAccess)로 읽는다.
# 바꿀 때는 RDS_MASTER_PASSWORD_PARAM만 덮어쓰면 된다(RDS_MIGRATION.md의 명령도 같이 고칠 것).
MASTER_PW_PARAM="${RDS_MASTER_PASSWORD_PARAM:-/siglens-rds/MASTER_PASSWORD}"
# 엔드포인트는 비밀이 아니고 로컬 터널 스크립트가 이 경로를 읽으므로 /siglens/ 아래에 둔다.
ENDPOINT_PARAM="/siglens/RDS_ENDPOINT"

# Performance Insights(7일 보존은 무료 티어). 일부 소형 인스턴스 클래스는 PI를 지원하지
# 않아 create-db-instance가 거절할 수 있다 — 그때만 RDS_PERF_INSIGHTS=0으로 다시 돌린다.
PERF_INSIGHTS="${RDS_PERF_INSIGHTS:-1}"

# "없음"과 "실패"를 구분한다. `describe ... >/dev/null 2>&1`로 존재를 판단하면 AccessDenied·
# 스로틀·네트워크 오류도 전부 "없음"으로 읽혀서, 이미 있는 인스턴스를 "없다"고 보고
# 비밀번호를 새로 만들거나 중복 생성을 시도하는 쪽으로 흘러간다.
#
# probe <없음-패턴> <명령...>
#   성공          → 0, stdout을 PROBE_OUT에 담는다
#   없음 에러      → 1 (stderr가 패턴에 매치될 때만)
#   그 밖의 에러   → stderr를 보여 주고 즉시 중단
# 호출 함수는 반드시 현재 셸에서 실행해야 한다($(...) 안에서 부르면 exit가 서브셸에 갇힌다).
probe() {
  local pat="$1" errf
  shift
  errf=$(mktemp)
  if PROBE_OUT=$("$@" 2>"$errf"); then
    rm -f "$errf"
    return 0
  fi
  if grep -qE "$pat" "$errf"; then
    rm -f "$errf"
    PROBE_OUT=""
    return 1
  fi
  log "ERROR: 예상 밖의 실패 — 없음으로 간주하지 않고 중단한다: $*"
  cat "$errf" >&2
  rm -f "$errf"
  exit 1
}

db_exists() {
  probe 'DBInstanceNotFound' aws rds describe-db-instances \
    --db-instance-identifier "$DB_ID" --query 'DBInstances[0].DBInstanceIdentifier' --output text
}

db_field() {
  aws rds describe-db-instances --db-instance-identifier "$DB_ID" \
    --query "DBInstances[0].$1" --output text
}

# 이름으로 SG ID를 찾는다. 없으면 "None"을 돌려주고(에러 아님), 호출 실패는 set -e로 중단된다.
lookup_sg() {
  aws ec2 describe-security-groups \
    --filters Name=group-name,Values="$1" Name=vpc-id,Values="$VPC_ID" \
    --query 'SecurityGroups[0].GroupId' --output text
}

# ── 공개 토글 (--make-public / --make-private) ───────────────────────────────
#
# 논리 복제는 **구독자(RDS)가 발행자(Neon)로 먼저 연결**한다. 기본 VPC에는 NAT가
# 없어서 공개 IP가 없는 RDS는 인터넷으로 나가지 못한다 — Neon에 닿을 수 없다.
# PubliclyAccessible=true는 RDS에 공인 IP를 붙여 **아웃바운드**를 가능하게 하는 용도다.
#
# 이것이 인바운드를 여는 것은 아니다. siglens-rds-sg에는 CIDR 규칙이 하나도 없고
# SG 참조(앱 SG 둘)만 있으므로, 공인 IP가 붙어도 인터넷에서 5432로 들어올 수 없다.
# 그래도 불필요한 노출이므로 복제가 끝나면 즉시 --make-private로 되돌린다.
#
# 이 "인바운드는 안 열린다"는 전제는 SG에 누군가 CIDR 규칙을 손으로 추가하면 깨진다
# (콘솔에서 임시로 내 IP를 열어 둔 경우 등). 그래서 공개로 바꾸기 **전에** SG를 검사해
# CIDR 규칙(IPv4/IPv6/프리픽스 리스트)이 하나라도 있으면 중단한다. 포트와 무관하게 막는다
# (all-traffic 규칙은 FromPort가 없어서 포트 조건으로는 놓친다).
assert_sg_has_no_cidr_rules() {
  local sg count
  sg=$(lookup_sg "$RDS_SG_NAME")
  if [ "$sg" = "None" ] || [ -z "$sg" ]; then
    log "ERROR: $RDS_SG_NAME 을 찾지 못했다 — 공개로 바꾸지 않는다"
    exit 1
  fi
  count=$(aws ec2 describe-security-groups --group-ids "$sg" \
    --query 'SecurityGroups[0].IpPermissions[].[length(IpRanges),length(Ipv6Ranges),length(PrefixListIds)][]' \
    --output text | tr '\t' '\n' | awk '{ s += $1 } END { print s + 0 }')
  if [ "$count" != "0" ]; then
    log "ERROR: $RDS_SG_NAME($sg)에 CIDR/프리픽스 인그레스 규칙이 ${count}개 있다 — 공인 IP를 붙이면 인터넷에 노출된다."
    log "       규칙을 지우고 다시 실행할 것: aws ec2 describe-security-groups --group-ids $sg --query 'SecurityGroups[0].IpPermissions'"
    exit 1
  fi
}
#
# 설정 변경은 다운타임 없이 적용된다(재부팅 없음). 상태가 modifying으로 넘어가기 전에
# wait가 즉시 반환하는 경쟁이 있어, 원하는 값이 반영될 때까지 직접 폴링한다.
toggle_public() {
  local want="$1" flag current
  db_exists || { log "ERROR: DB 인스턴스 $DB_ID 가 없다 — 먼저 인자 없이 실행해 생성할 것"; exit 1; }
  if [ "$want" = "true" ]; then flag="--publicly-accessible"; else flag="--no-publicly-accessible"; fi
  current=$(db_field PubliclyAccessible | tr '[:upper:]' '[:lower:]')
  if [ "$want" = "true" ]; then
    # 이미 공개 상태여도 검사한다 — 공개 중에 규칙이 추가됐을 수 있다.
    assert_sg_has_no_cidr_rules
  fi
  if [ "$current" = "$want" ]; then
    log "PubliclyAccessible 이미 $current — 변경 없음"
    return 0
  fi
  aws rds modify-db-instance --db-instance-identifier "$DB_ID" "$flag" --apply-immediately >/dev/null
  log "PubliclyAccessible=$want 적용 대기"
  local i
  for i in $(seq 1 60); do
    current=$(db_field PubliclyAccessible | tr '[:upper:]' '[:lower:]')
    if [ "$current" = "$want" ] && [ "$(db_field DBInstanceStatus)" = "available" ]; then
      log "PubliclyAccessible=$want 반영 완료"
      return 0
    fi
    sleep 10
  done
  log "ERROR: 10분 안에 PubliclyAccessible=$want 가 반영되지 않았다 — 콘솔에서 확인"
  exit 1
}

case "${1:-}" in
  --make-public)  toggle_public true;  exit 0 ;;
  --make-private) toggle_public false; exit 0 ;;
  "") ;;
  *) echo "usage: 15-rds.sh [--make-public|--make-private]"; exit 1 ;;
esac

# ── 1) DB 서브넷 그룹 ────────────────────────────────────────────────────────
#
# 기본 VPC의 서브넷을 AZ별 하나씩 모두 넣는다. RDS는 서브넷 그룹이 **최소 2개 AZ**를
# 덮어야 하고(Single-AZ여도), 나중에 Multi-AZ로 올리거나 다른 AZ로 복구할 여지를
# 남겨 둔다. 인스턴스 자체는 아래에서 2a에 고정한다(앱 EC2가 2a에 있어 AZ 간 전송비 0).
SUBNETS=$(aws ec2 describe-subnets \
  --filters Name=vpc-id,Values="$VPC_ID" Name=default-for-az,Values=true \
            "Name=availability-zone,Values=ap-northeast-2a,ap-northeast-2b,ap-northeast-2c" \
  --query 'Subnets[].SubnetId' --output text)
[ -n "$SUBNETS" ] || { log "ERROR: 기본 VPC($VPC_ID)에서 2a/2b/2c 서브넷을 찾지 못했다"; exit 1; }
# shellcheck disable=SC2086  # 의도적 단어 분할: aws가 서브넷 ID를 별도 인자로 받는다
if probe 'DBSubnetGroupNotFound' aws rds describe-db-subnet-groups --db-subnet-group-name "$SUBNET_GROUP"; then
  aws rds modify-db-subnet-group --db-subnet-group-name "$SUBNET_GROUP" \
    --db-subnet-group-description "siglens RDS (default VPC 2a/2b/2c)" \
    --subnet-ids $SUBNETS >/dev/null
else
  aws rds create-db-subnet-group --db-subnet-group-name "$SUBNET_GROUP" \
    --db-subnet-group-description "siglens RDS (default VPC 2a/2b/2c)" \
    --subnet-ids $SUBNETS >/dev/null
fi
log "subnet group $SUBNET_GROUP ready ($SUBNETS)"

# ── 2) 보안 그룹 ─────────────────────────────────────────────────────────────
#
# 인그레스는 **SG 참조만** 쓴다 — CIDR 규칙은 하나도 만들지 않는다. 앱 EC2는 ASG로
# 교체되며 IP가 바뀌지만 SG는 그대로이므로 SG 참조가 정답이고, 어떤 IP 대역도 열지 않으니
# 복제 구간에 --make-public을 켜도 인터넷에서 들어오는 길이 없다.
RDS_SG=$(lookup_sg "$RDS_SG_NAME")
if [ "$RDS_SG" = "None" ] || [ -z "$RDS_SG" ]; then
  RDS_SG=$(aws ec2 create-security-group --group-name "$RDS_SG_NAME" \
    --description "siglens RDS - 5432 from app SGs only (no CIDR)" \
    --vpc-id "$VPC_ID" --query GroupId --output text)
  log "created security group $RDS_SG_NAME ($RDS_SG)"
fi

# 멱등 판정은 "이 SG가 5432 규칙에 **들어 있나**"를 JMESPath로 그 한 쌍만 골라 묻는다.
# JMESPath 함정 두 가지(로컬 모의 엔드포인트로 실제 aws CLI에 돌려 확인했다):
#  - 문자열 비교값은 백틱 리터럴이 아니라 raw string '...'이어야 한다. `sg-x`는 유효한 JSON이
#    아니라서 항상 빈 결과가 나온다.
#  - `IpPermissions[?FromPort==..].UserIdGroupPairs[?GroupId==..]`처럼 필터 투영 뒤에 또 필터를
#    이으면 두 번째 필터가 개별 요소가 아니라 결과 리스트 전체에 걸려 항상 빈 결과다.
#    그래서 GroupId를 평탄화한 뒤 파이프(|)로 투영을 끊고 필터한다.
# 예전엔 모든 GroupId를 text로 받아 공백으로 감싼 문자열 매칭을 했는데, --output text는
# 값들을 **TAB**으로 구분해 출력한다. 규칙이 둘 다 생긴 뒤(= 두 번째 실행부터)는
# "sg-a<TAB>sg-b"가 되어 매칭이 실패하고, 이미 있는 규칙을 다시 만들려다
# InvalidPermission.Duplicate로 스크립트가 죽었다.
allow_from() {
  local src_sg="$1" label="$2" already
  already=$(aws ec2 describe-security-groups --group-ids "$RDS_SG" \
    --query "SecurityGroups[0].IpPermissions[?FromPort==\`5432\`].UserIdGroupPairs[].GroupId | [?@=='$src_sg']" \
    --output text)
  if [[ "$already" == *"$src_sg"* ]]; then
    log "ingress 5432 from $label ($src_sg) 이미 있음"
    return 0
  fi
  aws ec2 authorize-security-group-ingress --group-id "$RDS_SG" \
    --protocol tcp --port 5432 --source-group "$src_sg" >/dev/null
  log "ingress 5432 from $label ($src_sg) 추가"
}

allow_from "$EC2_SG" "siglens-ec2-sg"

TRADER_SG=$(lookup_sg "$TRADER_SG_NAME")
if [ "$TRADER_SG" = "None" ] || [ -z "$TRADER_SG" ]; then
  # trader 박스는 이 레포의 ASG가 아니라 별도 스택이다. 없는 계정(재프로비저닝 등)에서도
  # siglens 쪽 생성은 진행되게 경고만 남긴다. trader가 나중에 생기면 재실행하면 추가된다.
  log "WARN: $TRADER_SG_NAME 을 찾지 못해 trader 인그레스는 건너뛴다 (생기면 이 스크립트를 재실행)"
else
  allow_from "$TRADER_SG" "$TRADER_SG_NAME"
fi

# ── 3) 파라미터 그룹 ─────────────────────────────────────────────────────────
#
# - rds.force_ssl=1            평문 접속 거부. 앱은 sslmode=verify-full로 붙는다.
#                              (PG15+ 기본이 1이지만 의도를 코드에 박아 둔다.)
# - log_min_duration_statement 500ms 넘는 쿼리를 CloudWatch가 아닌 인스턴스 로그에 남긴다.
#                              이전 직후 Neon 대비 느려진 쿼리를 찾는 유일한 수단이다.
# - max_connections            **건드리지 않는다.** 기본값은 인스턴스 메모리 비례
#                              (LEAST(메모리/9531392, 5000) — t4g.small ≈ 180~225)이고,
#                              알람(07-alarms.sh `RDS_CONNECTIONS_ALARM_THRESHOLD`=150)이 먼저 울린다.
# - rds.logical_replication=0  명시적으로 끈다. 논리 복제는 **발행자(Neon)** 쪽에서 WAL 레벨을
#                              logical로 올려야 하는 기능이고, 구독자(RDS)는 일반 클라이언트처럼
#                              발행자에 연결해 변경분을 받아 적용할 뿐이라 필요 없다. 켜면
#                              wal_level=logical이 되어 WAL이 불어나고, 정적 파라미터라 변경에
#                              재부팅이 필요하다. 나중에 RDS를 발행자로 쓰는 롤백(RDS→Neon 복제)을
#                              하려면 그때 1로 바꾸고 재부팅한다.
if ! probe 'DBParameterGroupNotFound' aws rds describe-db-parameter-groups --db-parameter-group-name "$PARAM_GROUP"; then
  aws rds create-db-parameter-group --db-parameter-group-name "$PARAM_GROUP" \
    --db-parameter-group-family postgres17 \
    --description "siglens postgres17 (force_ssl, slow query log)" >/dev/null
  log "created parameter group $PARAM_GROUP"
fi
aws rds modify-db-parameter-group --db-parameter-group-name "$PARAM_GROUP" --parameters \
  "ParameterName=rds.force_ssl,ParameterValue=1,ApplyMethod=immediate" \
  "ParameterName=log_min_duration_statement,ParameterValue=500,ApplyMethod=immediate" \
  "ParameterName=rds.logical_replication,ParameterValue=0,ApplyMethod=pending-reboot" >/dev/null
log "parameter group $PARAM_GROUP synced"

# ── 4) 마스터 비밀번호 (로컬 생성 → SSM SecureString에만 저장) ─────────────────
#
# Secrets Manager의 관리형 마스터 비밀번호(--manage-master-user-password)를 쓰지 않는다:
# 시크릿 1개당 월 $0.40이고, 이 레포의 모든 비밀은 이미 SSM SecureString에 있다
# (user-data의 env-fetch, 로컬 터널 스크립트가 같은 경로를 읽는다). 비용 대비 얻는 건
# 자동 회전뿐인데 앱은 마스터 계정을 쓰지 않는다(롤 분리는 RDS_MIGRATION.md §2).
#
# 순서가 중요하다: **SSM에 먼저 저장하고 나서** 인스턴스를 만든다. 반대로 하면 인스턴스는
# 생겼는데 비밀번호를 잃는 창이 생긴다. 파라미터가 이미 있으면 재생성하지 않고 재사용한다
# (재실행해도 비밀번호가 바뀌지 않는다). 값은 어떤 로그에도 찍지 않는다.
#
# openssl rand -hex 24 = 48자 hex: RDS가 금지하는 문자(/ @ " 공백)가 없고 URL에 그대로
# 들어가도 이스케이프가 필요 없다.
MASTER_PW=""
if probe 'ParameterNotFound' aws ssm get-parameter --name "$MASTER_PW_PARAM"; then
  log "SSM $MASTER_PW_PARAM 이미 있음 — 재사용"
else
  if db_exists; then
    log "ERROR: DB 인스턴스는 있는데 SSM $MASTER_PW_PARAM 이 없다."
    log "       비밀번호를 복구할 수 없다. 새 값을 SSM에 넣고 아래로 인스턴스 쪽을 맞출 것:"
    log "       aws rds modify-db-instance --db-instance-identifier $DB_ID --master-user-password <새 값> --apply-immediately"
    exit 1
  fi
  MASTER_PW=$(openssl rand -hex 24)
  # --overwrite를 쓰지 않는다: 위 probe 이후 다른 실행이 먼저 만들었다면 여기서 실패해야 한다
  # (조용히 덮어쓰면 이미 인스턴스에 설정된 비밀번호를 잃는다).
  aws ssm put-parameter --name "$MASTER_PW_PARAM" --type SecureString --value "$MASTER_PW" >/dev/null
  log "SSM $MASTER_PW_PARAM 생성 (값은 출력하지 않음)"
fi

# ── 5) 인스턴스 ──────────────────────────────────────────────────────────────
if db_exists; then
  log "DB 인스턴스 $DB_ID 이미 있음 (status=$(db_field DBInstanceStatus)) — 생성 건너뜀"
else
  if [ -z "$MASTER_PW" ]; then
    # SSM에는 있는데 인스턴스가 없는 재실행(앞선 실행이 생성 직전에 중단된 경우).
    MASTER_PW=$(aws ssm get-parameter --name "$MASTER_PW_PARAM" --with-decryption \
      --query Parameter.Value --output text)
  fi

  # 각 설정의 이유:
  # - db.t4g.small / Single-AZ(2a)   데이터 1.4GB·소규모 트래픽. 앱 EC2가 2a라 AZ 간 전송비 0.
  #                                  고가용성이 필요해지면 modify로 Multi-AZ 승격(다운타임 짧음).
  # - gp3 20GB, 자동확장 상한 50GB    gp3는 용량과 무관하게 3000 IOPS 기본. 확장은 되돌릴 수 없으니
  #                                  상한을 낮게 두고 FreeStorageSpace 알람으로 먼저 안다.
  # - 암호화(aws/rds 키)             --kms-key-id를 생략하면 AWS 관리형 키(무료). 암호화는
  #                                  생성 시점에만 켤 수 있어 나중에 못 바꾼다.
  # - 백업 7일, 03:00 KST            스냅샷 I/O 정지(수 초)를 트래픽 최저 시간대에 둔다.
  #                                  18:00–18:30 UTC는 seo-prewarm 첫 tick(20:30 UTC)보다 앞이다.
  # - 유지보수 월 04:00 KST          sun 19:00 UTC = 월요일 04:00 KST. 백업 창과 겹치면 안 된다.
  # - deletion-protection            실수로 삭제 방지. 지울 때는 먼저 modify로 끈다.
  # - auto-minor-version-upgrade     보안 패치 자동 반영(유지보수 창에서만, 재시작 수 분).
  # - ca-certificate-identifier      앱이 sslmode=verify-full로 붙으므로 이미지에 구운 CA 번들과
  #                                  서버 인증서 체인이 같은 계열(rds-ca-rsa2048-g1)이어야 한다.
  # - no-publicly-accessible         평시 비공개. 복제 구간만 --make-public.
  # - monitoring-interval 0          Enhanced Monitoring은 끈다(CloudWatch 로그 비용). OS 지표가
  #                                  필요하면 그때 켠다. PI(7일)가 쿼리 단위 진단을 대신한다.
  # - master-user-password           argv에 실린다. 단일 사용자 로컬 머신 전제이고 04-params.sh도
  #                                  같은 방식이다. 화면에는 찍지 않는다.
  PI_ARGS=(--no-enable-performance-insights)
  if [ "$PERF_INSIGHTS" = "1" ]; then
    PI_ARGS=(--enable-performance-insights --performance-insights-retention-period 7)
  fi

  aws rds create-db-instance \
    --db-instance-identifier "$DB_ID" \
    --db-instance-class db.t4g.small \
    --engine postgres --engine-version "$ENGINE_VERSION" \
    --master-username "$MASTER_USER" --master-user-password "$MASTER_PW" \
    --allocated-storage 20 --storage-type gp3 --max-allocated-storage 50 \
    --storage-encrypted \
    --db-subnet-group-name "$SUBNET_GROUP" \
    --vpc-security-group-ids "$RDS_SG" \
    --db-parameter-group-name "$PARAM_GROUP" \
    --availability-zone "$AZ" --no-multi-az \
    --no-publicly-accessible \
    --port 5432 \
    --backup-retention-period 7 \
    --preferred-backup-window 18:00-18:30 \
    --preferred-maintenance-window sun:19:00-sun:19:30 \
    --deletion-protection \
    --auto-minor-version-upgrade \
    --ca-certificate-identifier rds-ca-rsa2048-g1 \
    --monitoring-interval 0 \
    --copy-tags-to-snapshot \
    "${PI_ARGS[@]}" \
    --tags Key=Name,Value="$DB_ID" Key=Project,Value=siglens >/dev/null
  unset MASTER_PW
  log "create-db-instance 요청 완료 — 생성에는 보통 10~15분이 걸린다"
fi

# ── 6) available 대기 → 엔드포인트 게시 ───────────────────────────────────────
aws rds wait db-instance-available --db-instance-identifier "$DB_ID"
ENDPOINT=$(db_field Endpoint.Address)
[ -n "$ENDPOINT" ] && [ "$ENDPOINT" != "None" ] || { log "ERROR: 엔드포인트를 읽지 못했다"; exit 1; }

# 호스트명만 게시한다(자격증명 없음 → String). 로컬 터널 스크립트(SSM 포트포워딩)와
# DATABASE_URL 조립(RDS_MIGRATION.md §6)이 이 값을 읽는다.
aws ssm put-parameter --name "$ENDPOINT_PARAM" --value "$ENDPOINT" --type String --overwrite >/dev/null
log "published $ENDPOINT_PARAM=$ENDPOINT"

log "rds ready: $DB_ID ($ENDPOINT) sg=$RDS_SG public=$(db_field PubliclyAccessible)"
