#!/bin/sh
set -eu

compose_file="docker-compose.e2e.yml"
dotenv_bin="node_modules/.bin/dotenv"

docker_process_running() {
    pgrep -x Docker >/dev/null 2>&1 ||
        pgrep -x dockerd >/dev/null 2>&1 ||
        pgrep -x com.docker.backend >/dev/null 2>&1 ||
        docker info >/dev/null 2>&1
}

fail_docker_not_running() {
    echo "Docker is not running. Start Docker before running release E2E."
    exit 1
}

wait_for_backend_health() {
    echo "Waiting for Postgres and Redis to report healthy..."

    i=1
    while [ "$i" -le 60 ]; do
        pg_status=$(
            docker compose -f "$compose_file" ps postgres --format '{{.Health}}' 2>/dev/null ||
                true
        )
        redis_status=$(
            docker compose -f "$compose_file" ps redis --format '{{.Health}}' 2>/dev/null ||
                true
        )

        echo "attempt $i: postgres=$pg_status redis=$redis_status"

        if [ "$pg_status" = "healthy" ] && [ "$redis_status" = "healthy" ]; then
            echo "Backend is healthy."
            return 0
        fi

        i=$((i + 1))
        sleep 2
    done

    echo "Backend did not become healthy in time. Dumping status + logs:"
    docker compose -f "$compose_file" ps
    docker compose -f "$compose_file" logs
    return 1
}

cleanup() {
    code=$?
    trap - EXIT

    echo "Tearing down e2e backend..."
    yarn e2e:down || true

    exit "$code"
}

next_env_shadow_args() {
    for env_file in .env.production.local .env.local .env.production .env; do
        [ -f "$env_file" ] || continue

        sed -n \
            -e 's/^[[:space:]]*export[[:space:]][[:space:]]*//' \
            -e 's/^[[:space:]]*\([A-Za-z_][A-Za-z0-9_]*\)[[:space:]]*=.*/\1=/p' \
            "$env_file"
    done | sort -u
}

run_with_e2e_env() {
    env -i \
        HOME="${HOME:-}" \
        PATH="$PATH" \
        SHELL="${SHELL:-/bin/sh}" \
        TMPDIR="${TMPDIR:-/tmp}" \
        USER="${USER:-}" \
        $(next_env_shadow_args) \
        "$dotenv_bin" -e .env.e2e -o -- "$@"
}

run_ci_with_e2e_env() {
    env -i \
        CI=1 \
        HOME="${HOME:-}" \
        PATH="$PATH" \
        SHELL="${SHELL:-/bin/sh}" \
        TMPDIR="${TMPDIR:-/tmp}" \
        USER="${USER:-}" \
        $(next_env_shadow_args) \
        "$dotenv_bin" -e .env.e2e -o -- "$@"
}

if ! docker_process_running; then
    fail_docker_not_running
fi

if ! docker info >/dev/null 2>&1; then
    fail_docker_not_running
fi

trap cleanup EXIT

yarn playwright install --with-deps chromium webkit
yarn e2e:up
wait_for_backend_health
run_with_e2e_env yarn e2e:db
run_ci_with_e2e_env yarn test:e2e
