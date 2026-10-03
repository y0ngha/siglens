#!/usr/bin/env bash
# 로컬 개발 DB(docker-compose.dev.yml) 관리.
#
# 사용법: scripts/db-dev.sh <up|migrate|reset|down>
#   up       컨테이너를 띄우고 healthy가 될 때까지 기다린다.
#   migrate  drizzle 마이그레이션 테이블을 부트스트랩한 뒤 마이그레이션을 적용한다.
#   reset    볼륨까지 지우고(down -v) 다시 띄워 마이그레이션한다 — 데이터가 사라진다.
#   down     컨테이너만 내린다(볼륨 유지).
#
# 환경변수(둘 다 선택):
#   DEV_DB_PORT     호스트 포트. 기본 5435.
#   DEV_DB_PROJECT  compose 프로젝트 이름. 기본 siglens-dev.
#
# ⚠️ migrate는 `.env.local`을 읽지 않는다. 그 파일의 DATABASE_URL/DIRECT_DATABASE_URL
# 이 운영(또는 운영 터널)을 가리킬 수 있어서, `env -u`로 비운 뒤 로컬 URL만 주입한다.
# `yarn db:migrate`(dotenv -e .env.local)를 로컬 마이그레이션에 쓰지 말 것.
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${DEV_DB_PORT:-5435}"
PROJECT="${DEV_DB_PROJECT:-siglens-dev}"
LOCAL_URL="postgres://siglens:siglens@localhost:${PORT}/siglens_dev"

# 변수가 아니라 함수로 감싼다 — zsh에서도 단어 분할에 기대지 않는다.
compose() {
    DEV_DB_PORT="$PORT" docker compose -p "$PROJECT" -f docker-compose.dev.yml "$@"
}

wait_healthy() {
    local cid status
    cid="$(compose ps -q postgres)"
    if [[ -z "$cid" ]]; then
        echo "[db-dev] postgres 컨테이너를 찾지 못했다" >&2
        return 1
    fi
    for _ in $(seq 1 60); do
        status="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || true)"
        if [[ "$status" == "healthy" ]]; then
            # healthcheck가 healthy여도 접속 직후엔 한 번 더 흔들릴 수 있다.
            if compose exec -T postgres pg_isready -U siglens -d siglens_dev >/dev/null 2>&1; then
                echo "[db-dev] postgres healthy (localhost:${PORT})"
                return 0
            fi
        fi
        sleep 1
    done
    echo "[db-dev] 60초 안에 healthy가 되지 않았다 (status=${status:-unknown})" >&2
    return 1
}

cmd_up() {
    compose up -d postgres
    wait_healthy
}

cmd_migrate() {
    # migrate.ts는 시작하자마자 drizzle.__drizzle_migrations를 SELECT 한다. 새
    # 컨테이너에는 없어서 42P01로 죽으므로 e2e/setup/global-setup.ts와 똑같이
    # 먼저 만든다. IF NOT EXISTS라 반복 실행해도 안전하다.
    compose exec -T postgres psql -U siglens -d siglens_dev -v ON_ERROR_STOP=1 \
        -c "CREATE SCHEMA IF NOT EXISTS drizzle;" \
        -c "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);"

    # .env.local 값이 새어 들어오지 않게 둘 다 비우고 로컬 URL로 강제한다.
    # migrate.ts는 DIRECT_DATABASE_URL을 우선하므로 둘 다 같은 값이어야 한다.
    env -u DATABASE_URL -u DIRECT_DATABASE_URL \
        DATABASE_URL="$LOCAL_URL" DIRECT_DATABASE_URL="$LOCAL_URL" \
        node_modules/.bin/tsx db/scripts/migrate.ts
}

cmd_reset() {
    compose down -v
    cmd_up
    cmd_migrate
}

cmd_down() {
    compose down
}

case "${1:-}" in
    up) cmd_up ;;
    migrate) cmd_migrate ;;
    reset) cmd_reset ;;
    down) cmd_down ;;
    *)
        echo "사용법: $0 <up|migrate|reset|down>" >&2
        exit 2
        ;;
esac
