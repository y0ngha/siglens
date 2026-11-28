/**
 * 환경 변수의 **단일 목록과 분류**.
 *
 * 코드는 계속 `process.env.X`를 리터럴로 읽는다 — Next는 `NEXT_PUBLIC_*`를 리터럴 접근만 인라인하고,
 * `cache-handler/*.mjs`는 TS를 불러올 수 없고, core는 자기 env를 직접 읽는다. 그래서 모든 읽기를
 * 접근자로 바꾸는 대신 이 레지스트리가 "무엇이 존재하고 어디서 오는가"의 정본이 되고, 가드
 * (`src/__tests__/guards/envRegistry.test.ts`)가 코드·`.env.example`·배포 게이트·빌드 인자와의
 * 어긋남을 막는다.
 *
 * 파생물:
 * - `infra/aws/env-gate.txt` — `yarn env:gate`가 이 파일에서 생성한다. 배포 전 `check-env.sh`가 읽는다.
 *
 * 새 SSM 키를 쓰려면 여기에 등록하고 `yarn env:gate`를 돌린 뒤 `.env.example`에 설명 줄을 더한다.
 */

/**
 * - `required`: SSM에 없으면 배포를 막는다.
 * - `optional`: 기능 키. 없으면 그 기능이 꺼지므로 배포 게이트가 경고 한 줄로 알린다.
 * - `override`: 없는 것이 정상 상태인 값(킬 스위치, 튜닝 노브, 비상 우회, 코드 기본값 덮어쓰기).
 *   게이트 목록에는 문서로 남기되 경고하지 않는다 — 매 배포 경고가 쌓이면 진짜 경고가 묻힌다.
 *   빌드·플랫폼·로컬 키는 SSM 게이트 대상이 아니므로 이 구분과 무관하게 `optional`로 둔다.
 */
export type EnvRequirement = 'required' | 'optional' | 'override';

/**
 * 운영이 값을 받는 경로.
 * - `ssm`: 런타임 SSM `/siglens/*` (인스턴스 부팅 시 컨테이너 env로 주입)
 * - `build-arg`: `docker build --build-arg` (빌드 타임에 번들·prerender에 박힌다)
 * - `build-secret`: `docker build --secret` (이미지에 남지 않는 빌드 자격증명)
 * - `platform`: Node·Next·AWS가 설정한다
 * - `local`: 개발·테스트·E2E·번들 분석·운영자 로컬 도구에서만 쓴다
 */
export type EnvSource =
    | 'ssm'
    | 'build-arg'
    | 'build-secret'
    | 'platform'
    | 'local';

/** 읽는 쪽. `core`는 설치된 `@y0ngha/siglens-core`, `infra`는 `infra/aws`·Dockerfile·워크플로. */
export type EnvReader = 'siglens' | 'core' | 'infra' | 'scripts';

export interface EnvSpec {
    readonly name: string;
    readonly requirement: EnvRequirement;
    /** 운영이 값을 받는 경로 */
    readonly sources: readonly EnvSource[];
    readonly readBy: readonly EnvReader[];
    /** 한 줄: 없으면 무엇이 깨지는가 / 무엇을 제어하는가 */
    readonly note: string;
}

export const ENV_REGISTRY = [
    // ── SSM required (없으면 배포 게이트가 막는 키) ───────────────────────────────
    // *_API_KEY(CHAT 없음) 4개는 core의 resolveServerApiKey가 읽는다. 4개 provider 모두
    // TIER_CONFIG.models.free에 있어 서버가 대납한다. core는 호출 시점에 검증하므로 키가 없어도
    // 부팅은 되고, 그 provider로 라우팅되는 첫 분석이 SSE 200 안에서 조용히 실패한다 — 게이트가
    // 잡으려는 바로 그 실패다. *_CHAT_API_KEY 4개도 같은 이유로 required다(SiglensAI 에이전트와
    // analysis-plain이 provider별 서버 키를 읽는다. BYOK 전용이라는 옛 가정은 틀렸다).
    {
        name: 'ANTHROPIC_API_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['core'],
        note: 'Server key for Claude analysis models (core resolveServerApiKey); missing fails that provider silently over SSE.',
    },
    {
        name: 'ANTHROPIC_CHAT_API_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Server key for Claude in the SiglensAI agent and plain analysis for non-BYOK callers.',
    },
    {
        name: 'CRON_SECRET',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Bearer secret for cron-invoked routes and cleanup actions; they reject every call when unset.',
    },
    {
        name: 'DATA_GO_KR_SERVICE_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'KRX listed-name API (data.go.kr); missing limits Korean-name search to the curated names.',
    },
    {
        name: 'DATABASE_URL',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'PostgreSQL connection string; the app and migration gate cannot reach the DB without it.',
    },
    {
        name: 'DEEPSEEK_API_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['core'],
        note: 'Server key for DeepSeek analysis models (core resolveServerApiKey).',
    },
    {
        name: 'DEEPSEEK_CHAT_API_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Server key for DeepSeek in the SiglensAI agent and plain analysis for non-BYOK callers.',
    },
    {
        name: 'EMAIL_FROM',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Sender address for transactional and report mail.',
    },
    {
        name: 'EMAIL_REPORT_SIGNING_SECRET',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'HMAC secret for email-report links and the mail-alert cookie and links; the report cron sends nothing, link routes reject, and mail-alert sign-up is unavailable without it.',
    },
    {
        name: 'FMP_API_KEY',
        requirement: 'required',
        sources: ['ssm', 'build-secret'],
        readBy: ['core'],
        note: 'Market data key read by core; also a build secret so prerendered /economy, /market and /fear-greed are not degraded.',
    },
    {
        name: 'GEMINI_API_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens', 'core'],
        note: 'Server key for Gemini analysis models and ticker translation.',
    },
    {
        name: 'GEMINI_CHAT_API_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Server key for Gemini in the SiglensAI agent and plain analysis for non-BYOK callers.',
    },
    {
        name: 'GOOGLE_CLIENT_ID',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Google OAuth client id; login fails without it.',
    },
    {
        name: 'GOOGLE_CLIENT_SECRET',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Google OAuth client secret; login fails without it.',
    },
    {
        name: 'ISR_CACHE_BUCKET',
        requirement: 'required',
        sources: ['ssm', 'build-arg'],
        readBy: ['siglens'],
        note: 'S3 bucket for the externalised ISR/fetch cache; unset falls back to disk (disk-full risk). Also a build-arg. Published by 12-isr-cache.sh.',
    },
    {
        name: 'LLM_API_KEY_ENCRYPTION_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'At-rest encryption key for user-supplied LLM API keys.',
    },
    {
        name: 'NAVER_CLIENT_ID',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Naver search API for Korean ticker news; missing empties the news tab silently.',
    },
    {
        name: 'NAVER_CLIENT_SECRET',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Naver search API secret for Korean ticker news.',
    },
    {
        name: 'OAUTH_REDIRECT_BASE_URL',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Base URL for OAuth redirect URIs.',
    },
    {
        name: 'OAUTH_STATE_HMAC_SECRET',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'HMAC secret (32+ bytes) signing OAuth state cookies.',
    },
    {
        name: 'OAUTH_TOKEN_ENCRYPTION_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'At-rest encryption key for stored OAuth tokens.',
    },
    {
        name: 'OPENAI_API_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['core'],
        note: 'Server key for OpenAI analysis models (core resolveServerApiKey).',
    },
    {
        name: 'OPENAI_CHAT_API_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Server key for OpenAI in the SiglensAI agent and plain analysis for non-BYOK callers.',
    },
    {
        name: 'RESEND_API_KEY',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Resend API key for all outgoing mail.',
    },
    {
        // 코드 기본값(DEFAULT_TRANSLATE_MODEL)이 있어도 required로 둔다 — 게이트 동작을 바꾸지 않는
        // 결정이다(2026-11-21). 재분류는 사용자 동의 후 별도 변경으로.
        name: 'TRANSLATE_MODEL',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Gemini model id for ticker translation; code falls back to a default, kept required to preserve gate behaviour.',
    },
    {
        name: 'UPSTASH_REDIS_REST_READONLY_TOKEN',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens', 'core'],
        note: 'Read-only Upstash token for cache reads.',
    },
    {
        name: 'UPSTASH_REDIS_REST_TOKEN',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens', 'core'],
        note: 'Upstash Redis REST token (cache and rate limits).',
    },
    {
        name: 'UPSTASH_REDIS_REST_URL',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens', 'core'],
        note: 'Upstash Redis REST endpoint.',
    },
    {
        name: 'VISITOR_HASH_PEPPER',
        requirement: 'required',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Fixed pepper for visitor pseudonym hashes; /api/presence returns 500 and MAU/DAU stay 0 without it. Never rotate.',
    },

    // ── SSM optional / override ──────────────────────────────────────────────
    // optional: 기능 키(없으면 기능이 꺼지고 게이트가 경고). override: 없는 것이 정상(킬 스위치·튜닝·기본값 덮어쓰기).
    {
        name: 'AGENT_CHAT_DISABLED',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Kill switch: 1 makes /api/ai/chat/stream 503 and the page show maintenance. Unset in normal operation.',
    },
    {
        name: 'AGENT_WEB_SEARCH_PER_DAY',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Overrides core shared web_search daily budget (33 when unset); set only while extra Brave capacity is bought.',
    },
    {
        name: 'AGENT_WEB_SEARCH_PER_MONTH',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Overrides core shared web_search monthly budget (1,000 when unset).',
    },
    {
        name: 'AGENT_X_POSTS_PER_DAY',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Daily X post-read budget for get_x_posts (400 when unset); X bills per post read.',
    },
    {
        name: 'BRAVE_SEARCH_API_KEY',
        requirement: 'optional',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Brave half of SiglensAI web_search; unset drops the tool when Naver is also absent.',
    },
    {
        name: 'DART_API_KEY',
        requirement: 'optional',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'OpenDART key; unset ends both DART crons as disabled with zero requests.',
    },
    {
        name: 'DATABASE_PREPARE',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Forces prepared statements on/off when the host name cannot tell whether a pooler fronts the DB.',
    },
    {
        name: 'DB_CONTENT_LOCALE',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: "DB content localisation sidecar; only the value '1' turns it on (off when unset). Becomes optional once runbook step 7 sets it in production (absence would then disable the feature).",
    },
    {
        name: 'FINRA_SHORT_DATA_ENABLED',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'FINRA short-data cron flag; unset = enabled (non-commercial phase). Turn off before commercialising.',
    },
    {
        name: 'ISR_CACHE_DISABLED',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Turns the S3 ISR cache handler off entirely.',
    },
    {
        name: 'ISR_CACHE_MAX_INFLIGHT_UPLOADS',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Upper bound on concurrent S3 cache uploads (64 when unset).',
    },
    {
        name: 'ISR_FETCH_CACHE_DISABLED',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Turns the fetch (data) cache off.',
    },
    {
        name: 'ISR_FETCH_CACHE_MAX_BYTES',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'In-memory fetch cache byte bound (64 MiB when unset).',
    },
    {
        name: 'ISR_FETCH_CACHE_MAX_ENTRIES',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'In-memory fetch cache entry bound (20000 when unset).',
    },
    {
        name: 'ISR_FETCH_CACHE_ROUTE_MAX_BYTES',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Per-route byte bound inside the in-memory fetch cache.',
    },
    {
        name: 'ISR_PAGE_CACHE_DISABLED',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Turns the page cache off.',
    },
    {
        name: 'ISR_PAGE_CACHE_MAX_BYTES',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'In-memory page cache byte bound.',
    },
    {
        name: 'ISR_PAGE_CACHE_MAX_ENTRIES',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'In-memory page cache entry bound (5000 when unset).',
    },
    {
        name: 'ISR_PAGE_CACHE_TTL_MS',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'In-memory page cache TTL in ms (30000 when unset).',
    },
    {
        name: 'ISR_TAG_SYNC_DISABLED',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Turns cache tag synchronisation across replicas off.',
    },
    {
        // SSM 전용(운영 안전장치). report/off로 두면 check-env.sh가 배포마다 경고한다.
        name: 'MIGRATION_GATE',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Migration deploy gate mode: enforce (default) | report | off. Emergency override only; delete the SSM parameter after the deploy.',
    },
    {
        name: 'NAVER_AI_CLIENT_ID',
        requirement: 'optional',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Naver half of SiglensAI web_search (its own NCP application); unset turns that half off. Never falls back to NAVER_CLIENT_*.',
    },
    {
        name: 'NAVER_AI_CLIENT_SECRET',
        requirement: 'optional',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Secret for the SiglensAI web_search Naver application.',
    },
    {
        name: 'OPENFIGI_API_KEY',
        requirement: 'optional',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'OpenFIGI key; unset uses anonymous limits for the cusip-map cron.',
    },
    {
        name: 'OPERATOR_EMAIL',
        requirement: 'optional',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Operator inbox for inquiry/VOC mails and the daily AI-feedback digest; unset skips the mails (rows still stored).',
    },
    {
        name: 'PLAIN_MODEL',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Model override for plain (non-agent) analysis; code default applies when unset.',
    },
    {
        // 빌드 타임에 정적 페이지에 박히는 값인데 deploy.yml에는 build-arg가 없다. 공개 API를 켜는
        // 작업(WP-29)이 build-arg를 더하면서 분류를 바꾼다. 가드의 예외 목록이 이 상태를 명시한다.
        name: 'PUBLIC_API_ENABLED',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Public Open API launch flag; unset = OFF (/developers and /api/v1/* return 404). Read at build time for static pages.',
    },
    {
        name: 'REG_SHO_THRESHOLD_DATA_ENABLED',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Reg SHO threshold cron flag; unset = enabled (non-commercial phase).',
    },
    {
        name: 'SEC_USER_AGENT',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'SEC EDGAR User-Agent; unset uses a built-in default.',
    },
    {
        name: 'SERVER_KEY_DISABLED_PROVIDERS',
        requirement: 'override',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'Kill switch: comma list of providers whose server-paid models are paused. Unset = all on.',
    },
    {
        name: 'X_BEARER_TOKEN',
        requirement: 'optional',
        sources: ['ssm'],
        readBy: ['siglens'],
        note: 'X API token for get_x_posts; unset = the tool is not offered to the model.',
    },

    // ── 빌드 타임 주입(build-arg / build-secret) ─────────────────────────────
    {
        name: 'FMP_AT_BUILD',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'Build-time FMP policy for prerender (best-effort when unset); set from the FMP_AT_BUILD repo variable.',
    },
    {
        name: 'GIT_SHA',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'Release version (not a commit SHA) baked as buildId; also the per-release S3 page-cache prefix.',
    },
    {
        name: 'NEXT_BUILD_DATE',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'Build date used for page lastmod (falls back to module load time when unset).',
    },
    {
        name: 'NEXT_PUBLIC_ADSENSE_ENABLED',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'AdSense on/off, inlined into the client bundle.',
    },
    {
        name: 'NEXT_PUBLIC_ADSENSE_PUBLISHER_ID',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'AdSense publisher id, inlined into the client bundle.',
    },
    {
        name: 'NEXT_PUBLIC_ADSENSE_SLOT_FEAR_GREED',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'AdSense slot id for the symbol fear-greed tab unit (empty hides it).',
    },
    {
        name: 'NEXT_PUBLIC_ADSENSE_SLOT_GUIDE',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'AdSense slot id for the guide article unit (empty hides it).',
    },
    {
        name: 'NEXT_PUBLIC_ADSENSE_SLOT_NEWS',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'AdSense slot id for the symbol news tab unit (empty hides it).',
    },
    {
        name: 'NEXT_PUBLIC_ADSENSE_SLOT_SYMBOL_BOTTOM',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'AdSense slot id for the unit shared by all symbol tabs (empty hides it).',
    },
    {
        // 코드 기본값(https://ai.siglens.io)을 쓰고 Dockerfile·deploy.yml은 값을 넘기지 않는다.
        name: 'NEXT_PUBLIC_AI_SITE_URL',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'Absolute URL of the SiglensAI host (SSO handoff, main-to-ai 301); defaults to https://ai.siglens.io, inlined at build.',
    },
    {
        name: 'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'Google Search Console verification token, inlined into metadata.',
    },
    {
        name: 'NEXT_PUBLIC_SITE_URL',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'Canonical site origin, inlined at build (metadata, sitemap, email links).',
    },
    {
        name: 'PRERENDER_LOCALES',
        requirement: 'optional',
        sources: ['build-arg'],
        readBy: ['siglens'],
        note: 'Locales prerendered at build; set from the PRERENDER_LOCALES repo variable. SSM never reaches it.',
    },
    {
        name: 'SIGLENS_GITHUB_TOKEN',
        requirement: 'optional',
        sources: ['build-secret'],
        readBy: ['infra'],
        note: 'GitHub token (read:packages) for installing @y0ngha/siglens-core at build; never reaches the runtime.',
    },

    // ── 플랫폼이 설정 ────────────────────────────────────────────────────────
    {
        name: 'AWS_REGION',
        requirement: 'optional',
        sources: ['platform'],
        readBy: ['siglens'],
        note: 'AWS region for the S3 cache client (ap-northeast-2 when unset).',
    },
    {
        name: 'NEXT_PHASE',
        requirement: 'optional',
        sources: ['platform'],
        readBy: ['siglens'],
        note: 'Set by Next; distinguishes the production build phase.',
    },
    {
        name: 'NEXT_RUNTIME',
        requirement: 'optional',
        sources: ['platform'],
        readBy: ['siglens'],
        note: 'Set by Next: nodejs or edge.',
    },
    {
        name: 'NODE_ENV',
        requirement: 'optional',
        sources: ['platform'],
        readBy: ['siglens'],
        note: 'Set by Node/Next tooling.',
    },

    // ── 로컬(개발·테스트·E2E·분석·운영자 도구) ───────────────────────────────
    {
        name: 'AGENT_REAL_PROVIDER',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['siglens'],
        note: 'Local only: lets the agent hit the real provider instead of the stub.',
    },
    {
        // infra/aws/.env에서 읽는 운영자 로컬 값. 런타임이 읽지 않으므로 SSM 게이트 대상이 아니다.
        name: 'ALARM_EMAIL',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['infra'],
        note: 'Read by infra/aws/07-alarms.sh to subscribe the SNS alert topic; not a runtime key.',
    },
    {
        name: 'ANALYZE',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['siglens'],
        note: 'Local only: enables the bundle analyzer in next.config.ts.',
    },
    {
        name: 'DIRECT_DATABASE_URL',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['scripts'],
        note: 'db/ scripts prefer this over DATABASE_URL; the app client reads only DATABASE_URL.',
    },
    {
        name: 'E2E_ECONOMY_FORCE_EMPTY',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['siglens'],
        note: 'E2E only: forces the economy calendar to an empty state.',
    },
    {
        name: 'E2E_FAKE_FRESH_ANALYSIS_MS',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['siglens'],
        note: 'E2E only: holds run_fresh_analysis for this many ms (max 180000) before a stub result, for the agent slot load test (scripts/load/agent-slots.mts).',
    },
    {
        name: 'E2E_FLOWS_PIPELINE',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['siglens'],
        note: 'E2E only: exercises the investor-flows pipeline.',
    },
    {
        name: 'E2E_TEST',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['siglens'],
        note: 'E2E only: server-side test mode.',
    },
    {
        name: 'NEXT_PUBLIC_E2E_TEST',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['siglens'],
        note: 'E2E only: client-side test mode, inlined by the E2E build.',
    },
    {
        name: 'SIGLENS_OFFLINE_BUILD',
        requirement: 'optional',
        sources: ['local'],
        readBy: ['siglens'],
        note: 'Local/CI build without network access to Upstash and FMP.',
    },
] as const satisfies readonly EnvSpec[];

export type EnvKey = (typeof ENV_REGISTRY)[number]['name'];
