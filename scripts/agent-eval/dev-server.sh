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
ALLOWLIST="DEEPSEEK_CHAT_API_KEY FMP_API_KEY GEMINI_CHAT_API_KEY BRAVE_SEARCH_API_KEY NAVER_AI_CLIENT_ID NAVER_AI_CLIENT_SECRET NAVER_CLIENT_ID NAVER_CLIENT_SECRET DART_API_KEY"

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
# .env.e2e의 E2E_TEST=1은 시세·재무·뉴스·수급 provider까지 고정 픽스처(모든 종목이 같은 봉)로 바꾼다. 평가는 실제
# 데이터가 필요하므로 끈다(빈 값으로 미리 설정해 두면 dotenv가 덮지 않는다). DB 드라이버는 E2E와 무관하게 postgres-js다.
export E2E_TEST=
# DB·Redis 주소는 호출한 셸에서 DATABASE_URL·UPSTASH_REDIS_REST_URL을 주면 그 값이 .env.e2e보다 우선한다(다른 포트의
# 스택). 서버가 실제로 쓸 두 값(셸 값이 있으면 그것, 없으면 .env.e2e의 값)의 호스트가 localhost / 127.0.0.1 / ::1이
# 아니면 서버를 띄우기 전에 종료 코드 2로 멈춘다(운영 Redis·DB에 캐시·한도 키나 대화 행을 쓰지 않게). 앱이 읽는 DB·Redis
# 주소 변수는 이 둘뿐이다. 출력은 `이름 -> 호스트:포트`만이다(자격 증명·토큰 없음). 판정은 localGuard.mjs.
node scripts/agent-eval/localGuard.mjs DATABASE_URL UPSTASH_REDIS_REST_URL || exit 2
# 서버가 내놓는 도구 목록은 HTTP로 보이지 않는다. run.mjs가 web_search 가용 여부를 알 수 있게, 키 유무(값 아님)만
# 상태 파일에 적는다(`availableToolNames`와 같은 규칙: Brave 키가 있거나 Naver AI 키 쌍이 있으면 제공).
web_search=false
if [ -n "${BRAVE_SEARCH_API_KEY:-}" ] || { [ -n "${NAVER_AI_CLIENT_ID:-}" ] && [ -n "${NAVER_AI_CLIENT_SECRET:-}" ]; }; then
    web_search=true
fi
printf '{"webSearch": %s}\n' "$web_search" > "${AGENT_EVAL_STATE_FILE:-scripts/agent-eval/.server-state.json}"
echo "agent-eval dev server: web_search offered -> $web_search"
export NEXT_PUBLIC_SITE_URL=http://localhost:4200
# 이 값이 없으면 페이지가 운영 챗으로 요청을 보낸다.
export NEXT_PUBLIC_AI_SITE_URL=http://ai.localhost:4200

# (2) DB·Redis는 .env.e2e에서. dotenv-cli는 이미 설정된 변수를 덮지 않으므로 위에서 내보낸 값이 우선한다.
exec node_modules/.bin/dotenv -e .env.e2e -- node_modules/.bin/next dev --turbopack -p 4200
