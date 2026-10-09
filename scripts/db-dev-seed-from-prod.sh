#!/usr/bin/env bash
# 운영 DB의 **비개인 데이터**를 SSM 터널(localhost:6543)로 읽어 로컬 개발 DB에 복원한다.
#
# 사전 조건
#   1. 터널이 열려 있다:  yarn db:tunnel         (다른 터미널)
#   2. 로컬 개발 DB가 마이그레이션까지 끝난 빈 상태다:  yarn db:dev:reset
#      (data-only 복원이라 이미 데이터가 있으면 PK 충돌로 전체 롤백된다.)
#
# 사용법: SOURCE_DATABASE_URL='postgres://<user>:<pw>@localhost:6543/<db>' \
#           scripts/db-dev-seed-from-prod.sh [--yes]
#
# 안전장치 — 하나라도 어긋나면 아무것도 하지 않고 종료한다.
#   - 원본은 localhost/127.0.0.1의 6543 포트(= 운영 터널)여야 한다.
#     dbTarget.ts의 DB_TUNNEL_PORT, scripts/db-tunnel.sh와 같은 값이다.
#   - 대상은 localhost:5435 / siglens_dev 로 **고정**이다(DEV_DB_PORT를 읽지 않는다).
#   - 원본 연결은 default_transaction_read_only=on 이라 운영에 쓸 수 없다.
#
# 지원 환경: Docker Desktop(macOS/Windows)만. host.docker.internal에 의존하므로
# Linux에서는 시작 즉시 거부한다.
#
# pg_dump/psql은 postgres:17 이미지로 돌린다 — 로컬에 pg 도구가 없어도 된다.
# Docker Desktop for Mac은 --network host가 없어 host.docker.internal로 호스트
# 포트에 붙는다. 원본이 17보다 높은 메이저면 PG_IMAGE=postgres:<메이저>로 맞출 것
# (pg_dump는 자기보다 새 서버를 거부한다).
set -euo pipefail

readonly TUNNEL_PORT=6543
readonly DEV_PORT=5435
readonly DEV_DB="siglens_dev"
readonly DEV_USER="siglens"
readonly DEV_PASSWORD="siglens"
readonly PG_IMAGE="${PG_IMAGE:-postgres:17}"
readonly DOCKER_HOST_NAME="host.docker.internal"

# 개인정보·계정에 묶인 테이블 — **스키마(src/shared/db/schema.ts)만 복원하고 행은 가져오지 않는다.**
#   users, sessions, oauth_accounts, user_api_keys  계정·세션·OAuth 토큰·암호화된 사용자 API 키
#   portfolio_holdings                              보유종목
#   email_report_subscriptions                      메일 리포트 수신 설정(동의 시각·타임존)
#   email_report_deliveries                         메일 리포트 발송 기록(회원별 날짜·종목)
#   agreements                                      사용자별 약관 동의
#   inquiries                                       문의(이메일·본문)
#   chat_conversations, chat_messages               SiglensAI 대화 (messages는 conversations 소속)
#   visitor_days                                    방문자 해시·UA·국가·진입 경로
#   funnel_events                                   가입 퍼널 이벤트(방문자 해시·회원 id)
#   shared_analyses                                 user_id가 users를 FK로 가리킨다. users 행 없이
#                                                   복원하면 FK 위반이고, 작성자 연결을 지우면 의미가
#                                                   없어 통째로 제외한다.
# 이메일 인증·비밀번호 재설정 토큰은 DB가 아니라 Redis에 있어 대상 아님.
# 남기는 것: 종목·번역·뉴스·실적·경제 캘린더·terms/notices·분석 스냅샷/이력,
#           symbol_views_daily(집계값만, 개인 식별 없음).
# 새 테이블이 users를 참조하면 여기에 추가할 것 — scripts/__tests__/db-dev-seed-from-prod.test.ts 가 검증한다.
EXCLUDED_TABLES=(
    users
    sessions
    oauth_accounts
    user_api_keys
    portfolio_holdings
    email_report_subscriptions
    email_report_deliveries
    agreements
    inquiries
    chat_conversations
    chat_messages
    visitor_days
    funnel_events
    shared_analyses
)

fail() {
    echo "[seed] 거부: $*" >&2
    exit 1
}

# host.docker.internal은 Docker Desktop(macOS/Windows)에만 있다. Linux의 docker는
# 이 이름을 풀지 못하고(`--add-host=host.docker.internal:host-gateway`가 필요하다),
# 그렇게 우회하면 루프백 바인딩 포트에도 안 닿는다 — 조용히 이상하게 실패하는 대신 먼저 거부한다.
case "$(uname -s)" in
    Darwin | MINGW* | MSYS* | CYGWIN*) ;;
    *) fail "Docker Desktop(macOS/Windows)에서만 지원한다 — host.docker.internal에 의존한다. 현재 OS: $(uname -s)" ;;
esac

AUTO_YES=0
for arg in "$@"; do
    case "$arg" in
        --yes) AUTO_YES=1 ;;
        *) echo "사용법: SOURCE_DATABASE_URL=... $0 [--yes]" >&2; exit 2 ;;
    esac
done

[[ -n "${SOURCE_DATABASE_URL:-}" ]] || fail "SOURCE_DATABASE_URL 이 필요하다 (예: postgres://user:pw@localhost:${TUNNEL_PORT}/db)"

# URL 파싱은 node로 한다 — 비밀번호의 퍼센트 인코딩을 bash로 풀면 틀린다.
# 자격증명은 argv/로그에 싣지 않고 환경변수로만 흘린다.
url_part() {
    SRC_URL="$SOURCE_DATABASE_URL" node -e '
        const u = new URL(process.env.SRC_URL);
        const field = process.argv[1];
        const map = {
            host: u.hostname,
            port: u.port,
            user: decodeURIComponent(u.username),
            password: decodeURIComponent(u.password),
            db: u.pathname.replace(/^\//, ""),
            sslmode: u.searchParams.get("sslmode") ?? "",
        };
        process.stdout.write(map[field] ?? "");
    ' "$1"
}

SRC_HOST="$(url_part host)" || fail "SOURCE_DATABASE_URL 을 파싱하지 못했다"
SRC_PORT="$(url_part port)"
SRC_USER="$(url_part user)"
SRC_DB="$(url_part db)"
SRC_SSLMODE="$(url_part sslmode)"

[[ "$SRC_HOST" == "localhost" || "$SRC_HOST" == "127.0.0.1" ]] \
    || fail "원본 호스트가 '${SRC_HOST}' 이다. 운영 터널(localhost:${TUNNEL_PORT})만 허용한다."
[[ "$SRC_PORT" == "$TUNNEL_PORT" ]] \
    || fail "원본 포트가 '${SRC_PORT:-<기본>}' 이다. 터널 포트 ${TUNNEL_PORT}만 허용한다 (yarn db:tunnel)."
[[ -n "$SRC_USER" && -n "$SRC_DB" ]] || fail "원본 URL에 user와 database가 필요하다"

command -v docker >/dev/null 2>&1 || fail "docker 가 필요하다"

# 대상 DB가 실제로 떠 있고 로컬 개발 DB인지 확인한다.
docker run --rm -e PGPASSWORD="$DEV_PASSWORD" "$PG_IMAGE" \
    psql -h "$DOCKER_HOST_NAME" -p "$DEV_PORT" -U "$DEV_USER" -d "$DEV_DB" -tAc 'SELECT 1' >/dev/null 2>&1 \
    || fail "localhost:${DEV_PORT}/${DEV_DB} 에 접속하지 못했다. yarn db:dev:reset 후 다시 시도할 것."

echo "[seed] 원본 : ${SRC_HOST}:${SRC_PORT}/${SRC_DB}  (PRODUCTION, 읽기 전용)"
echo "[seed] 대상 : localhost:${DEV_PORT}/${DEV_DB}  (local)"
echo "[seed] 제외 : ${EXCLUDED_TABLES[*]}"

if [[ "$AUTO_YES" -ne 1 ]]; then
    read -r -p "[seed] 계속하려면 'seed' 를 입력: " answer
    [[ "$answer" == "seed" ]] || fail "취소했다"
fi

DUMP_ARGS=(--data-only --schema=public --no-owner --no-privileges --disable-triggers)
for table in "${EXCLUDED_TABLES[@]}"; do
    DUMP_ARGS+=("--exclude-table-data=public.${table}")
done

# 터널 끝(RDS)이 SSL을 요구할 수 있다. 인증서 호스트는 localhost와 안 맞으므로
# 검증 없는 require를 기본으로 한다.
PGSSLMODE_VALUE="${SRC_SSLMODE:-require}"

# 원본 비밀번호는 `-e PGPASSWORD`(값 없이 이름만)로 넘겨 docker 인자(= 프로세스
# 목록)에 남기지 않는다. 값은 해당 docker 호출에만 접두 환경변수로 준다.
#
# pipefail: pg_dump가 실패하면 psql이 부분 입력으로 성공해도 전체를 실패로 본다.
# --single-transaction + ON_ERROR_STOP: 중간에 실패하면 로컬에도 아무것도 남지 않는다.
PGPASSWORD="$(url_part password)" PGSSLMODE="$PGSSLMODE_VALUE" \
    PGOPTIONS='-c default_transaction_read_only=on' \
    docker run --rm -e PGPASSWORD -e PGSSLMODE -e PGOPTIONS \
    "$PG_IMAGE" \
    pg_dump -h "$DOCKER_HOST_NAME" -p "$TUNNEL_PORT" -U "$SRC_USER" -d "$SRC_DB" "${DUMP_ARGS[@]}" \
    | PGPASSWORD="$DEV_PASSWORD" \
        docker run --rm -i -e PGPASSWORD \
        "$PG_IMAGE" \
        psql -h "$DOCKER_HOST_NAME" -p "$DEV_PORT" -U "$DEV_USER" -d "$DEV_DB" \
        -v ON_ERROR_STOP=1 --single-transaction -q -o /dev/null

echo "[seed] 완료 — 개인정보 테이블(${#EXCLUDED_TABLES[@]}개)은 비어 있다."
