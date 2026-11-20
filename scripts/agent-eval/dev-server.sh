#!/usr/bin/env bash
# 에이전트 회귀 평가용 로컬 dev 서버(4200) — e2e docker 스택(DB·Redis)에 붙이고 실제 provider를 켠다.
#
# 먼저 한 번: `yarn e2e:up && yarn e2e:db` (로컬 Postgres :5433 + Redis, 새 마이그레이션 포함).
# 그다음 이 스크립트를 실행해 둔 채로 `node scripts/agent-eval/run.mjs ...`를 돌린다.
#
# 비밀 취급 원칙: .env.local은 운영 값을 담고 있을 수 있다. 여기서는 (1) .env.local에만 있는 키는 전부 빈 값으로
# 가려(Next가 .env.local을 자동으로 읽어도 이미 설정된 변수는 덮지 않는다) 운영 DB·Redis·토큰이 새지 않게 하고,
# (2) DB와 Redis는 .env.e2e에서 가져오고, (3) 허용 목록의 키 이름만 .env.local에서 다시 읽어 에코 없이 내보낸다.
# 값은 어디에도 출력하지 않는다.
set -euo pipefail
set +x

cd "$(dirname "$0")/../.."

[ -f .env.e2e ] || { echo "missing .env.e2e" >&2; exit 1; }

# 에이전트가 실제로 쓰는 키(이름은 llm-provider 어댑터와 webSearch.ts에 있다).
ALLOWLIST="DEEPSEEK_CHAT_API_KEY FMP_API_KEY GEMINI_CHAT_API_KEY BRAVE_SEARCH_API_KEY NAVER_AI_CLIENT_ID NAVER_AI_CLIENT_SECRET"

key_names() {
    # 이름만 뽑는다(값은 읽지 않는다). `export KEY=...` 꼴의 줄도 같은 키로 센다.
    sed -nE 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=.*/\2/p' "$1" 2>/dev/null | sort -u
}

if [ -f .env.local ]; then
    # (1) .env.local에만 있는 키는 빈 값으로 가린다.
    for name in $(comm -23 <(key_names .env.local) <(key_names .env.e2e)); do
        export "$name="
    done

    # (3) 허용 목록은 값을 에코 없이 다시 읽어 내보낸다.
    for name in $ALLOWLIST; do
        value="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${name}=" .env.local | tail -n 1 | sed -E "s/^[[:space:]]*(export[[:space:]]+)?${name}=//" || true)"
        value="${value%\"}"; value="${value#\"}"
        value="${value%\'}"; value="${value#\'}"
        if [ -n "$value" ]; then
            export "$name=$value"
        fi
    done
fi

export AGENT_REAL_PROVIDER=1
export NEXT_PUBLIC_SITE_URL=http://localhost:4200
# 이 값이 없으면 페이지가 운영 챗으로 요청을 보낸다.
export NEXT_PUBLIC_AI_SITE_URL=http://ai.localhost:4200

# (2) DB·Redis는 .env.e2e에서. dotenv-cli는 이미 설정된 변수를 덮지 않으므로 위에서 내보낸 값이 우선한다.
exec node_modules/.bin/dotenv -e .env.e2e -- node_modules/.bin/next dev --turbopack -p 4200
