# E2E 테스트 (Playwright)

실제 브라우저로 사용자 여정을 검증하는 Playwright E2E 스위트입니다. 기존 Vitest 단위/통합 테스트(`src/**` 약 599개 파일) 위에 추가로 올라가는 레이어이며, Vitest는 그대로 유지됩니다.

- **Vitest** = jsdom 기반 컴포넌트/통합 테스트 (세밀·고속).
- **Playwright E2E** = 실제 프로덕션 빌드를 실제 브라우저에서 띄워, 사용자가 목표를 달성하는지(결과)를 검증.

이 문서는 현재 레포에 **실제로 구현된** E2E 하니스를 설명합니다. 이번 기반 작업(foundation)에서는 하니스 + 단일 smoke 스펙만 출하했습니다. Tier 1(symbol/analysis), Tier 2(auth/account), Tier 3/4 스펙은 향후 작업이며, 자세한 계획은 설계서를 참고하세요.

- 설계서: [`docs/superpowers/specs/2026-05-30-e2e-playwright-design.md`](./superpowers/specs/2026-05-30-e2e-playwright-design.md)
- 구현 계획: [`docs/superpowers/plans/2026-05-30-e2e-foundation.md`](./superpowers/plans/2026-05-30-e2e-foundation.md)

---

## 아키텍처 — stubbing이 동작하는 방식

가장 비자명한 부분입니다. **외부 데이터/LLM/이메일은 브라우저(`page.route`)에서 stub하지 않습니다.** Next.js RSC + Server Action 구조라 FMP·LLM·메일 호출은 서버(Node) 프로세스에서 일어나고, Playwright의 `page.route`는 브라우저 요청만 가로채므로 서버사이드 fetch를 막지 못합니다.

대신 stub은 **`E2E_TEST=1`로 게이팅된 서버사이드 fake-provider 주입**으로 처리합니다 (FSD 어댑터 팩토리 경계 주입).

| 의존성   | 프로덕션                            | E2E (`E2E_TEST=1`)                                                            |
| -------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| 시세     | `FmpMarketProvider` (FMP API)       | `FakeMarketProvider` — `e2e/fixtures/bars.json` 고정 데이터 반환              |
| Database | Neon serverless (`@neondatabase`)   | postgres-js 드라이버 스왑 (`clientTest.ts`) → 로컬 Postgres                   |
| Redis    | Upstash REST (`@upstash/redis`)     | 로컬 Redis 앞에 **SRH** 사이드카 (Upstash REST 호환), env만 교체              |

구현 위치:

- **시세 fake** — `src/shared/api/market/getMarketDataProvider.ts`가 `process.env.E2E_TEST === '1'`일 때 `FakeMarketProvider`를 반환합니다(`require`로 가져와 프로덕션 번들에 fake/fixture가 섞이지 않게 함). fake 구현은 `src/shared/api/market/FakeMarketProvider.ts`.
- **DB 드라이버 스왑** — `src/shared/db/client.ts`의 `buildClient()`가 `E2E_TEST=1`일 때 `clientTest.ts`의 `createTestDatabaseClient()`(postgres-js + drizzle)를 반환하고, 그 외에는 Neon serverless 클라이언트를 반환합니다. drizzle 쿼리 API는 두 드라이버 간 런타임 호환이라 레포지토리 코드는 무변경입니다.
- **Redis** — `.env.e2e`의 `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`이 SRH 사이드카(`http://localhost:8079`)를 가리키도록 교체됩니다. Redis 클라이언트 코드는 그대로입니다.

> 참고: 현재 fake로 실제 구현된 것은 **시세(`FakeMarketProvider`)** 뿐입니다. 설계서가 언급하는 LLM/이메일/OAuth fake provider 주입은 향후 Tier 1/2 스펙과 함께 추가될 예정입니다.

브라우저 쪽에서는 **네트워크 가드**(`e2e/support/fixtures.ts`)가 보조 안전망 역할을 합니다. 앱 호스트(`localhost:4300` / `127.0.0.1:4300`)와 비-http 스킴 외의 모든 외부 요청을 차단하고, 그런 요청이 발생하면 테스트를 실패시킵니다. 서버사이드 fetch는 여기 보이지 않으므로(위 fake 주입이 담당), 이 가드는 stubbing 드리프트(브라우저에서 새는 실 외부 호출)를 잡는 용도입니다.

---

## 로컬 사전 준비물

- Docker 실행 중 (Postgres / Redis / SRH 컨테이너 기동용)
- `yarn` (패키지 매니저)

---

## 로컬 실행 방법

`package.json`에 정의된 스크립트만 사용합니다.

```bash
# 1. Docker 백엔드 기동 (Postgres 5433, Redis 6380, SRH 8079)
yarn e2e:up

# 2. (선택) 로컬 e2e Postgres에 migrate + seed.
#    Playwright globalSetup이 동일 작업을 수행하므로 생략 가능.
yarn e2e:db

# 3. 테스트 실행 (헤드리스)
yarn test:e2e
#    또는 UI 모드
yarn test:e2e:ui

# 4. 백엔드 정리
yarn e2e:down
```

스크립트 정의:

| 스크립트         | 명령                                                                | 역할                                                          |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `e2e:up`         | `docker compose -f docker-compose.e2e.yml up -d`                    | Postgres/Redis/SRH 컨테이너 기동                              |
| `e2e:down`       | `docker compose -f docker-compose.e2e.yml down -v`                  | 컨테이너 + **볼륨** 제거 (데이터 리셋)                        |
| `e2e:db`         | `tsx e2e/setup/run-global-setup.ts`                                 | Playwright 없이 migrate + seed만 실행                         |
| `test:e2e`       | `playwright test`                                                   | E2E 스위트 실행                                               |
| `test:e2e:ui`    | `playwright test --ui`                                              | Playwright UI 모드                                            |

Playwright의 `webServer`(`playwright.config.ts`)는 테스트 전에 **프로덕션 앱을 콜드 빌드**합니다:

```text
dotenv -e .env.e2e -- sh -c 'yarn build && yarn start -p 4300'
```

- 포트 **4300** (개발 서버 `yarn dev`는 4200). `baseURL`은 `http://localhost:4300`.
- `.env.e2e`를 통해 `E2E_TEST=1` + 로컬 DB/Redis 자격증명이 주입됩니다.
- 콜드 `next build`가 길어질 수 있어 `webServer.timeout`은 300초입니다.
- 로컬에서는 `reuseExistingServer: true`(CI에서는 false → 항상 콜드 빌드)이므로, 이미 4300에 서버가 떠 있으면 재사용합니다.

> DB 준비는 Playwright `globalSetup`(`e2e/setup/global-setup.ts`)이 스위트 시작 전 1회 수행합니다. 따라서 `yarn e2e:db`는 편의용이며 필수는 아닙니다(둘은 동일한 `globalSetup` 함수를 공유 — single source of truth).

---

## 디렉토리 구조

```text
e2e/
├── specs/
│   └── smoke.spec.ts        # 하니스 통합 증명: 홈 로드 → 티커 검색 → /AAPL 렌더
├── support/
│   ├── fixtures.ts          # 네트워크 가드 fixture. 여기서 { test, expect } import
│   └── clock.ts             # freezeClock(page, iso) — 브라우저 시계 고정 헬퍼
├── setup/
│   ├── global-setup.ts      # Playwright globalSetup: migrate + seed (1회)
│   ├── run-global-setup.ts  # yarn e2e:db용 thin wrapper (동일 globalSetup 호출)
│   └── seed.ts              # asset_translations에 AAPL 단일 행 시드
├── fixtures/
│   └── bars.json            # FakeMarketProvider가 반환하는 고정 OHLCV 3봉
└── tsconfig.json            # e2e 전용 tsconfig (@/* 별칭 + server-only stub)
```

관련 앱 측 파일:

```text
docker-compose.e2e.yml                       # postgres:17 + redis:7 + SRH 사이드카
.env.e2e                                     # E2E_TEST=1 + 로컬 DB/Redis 자격증명 (커밋됨)
playwright.config.ts                         # testDir, webServer, projects(chromium/webkit)
src/shared/db/clientTest.ts                  # postgres-js 드라이버 (E2E 전용)
src/shared/db/client.ts                      # E2E_TEST 분기 (buildClient)
src/shared/api/market/FakeMarketProvider.ts  # fixture 기반 MarketDataProvider
src/shared/api/market/getMarketDataProvider.ts  # E2E_TEST 분기
.github/workflows/e2e.yml                    # CI 워크플로
```

---

## 데이터 & 결정성(determinism)

- **로컬 Postgres 17** (드라이버 스왑) — 프로덕션 Neon 대신 사용. `docker-compose.e2e.yml`이 호스트 포트 5433에 노출.
- **AAPL 시드** — `e2e/setup/seed.ts`가 `asset_translations` 테이블에 AAPL 한 행을 `onConflictDoNothing`으로 넣습니다. `[symbol]` 페이지는 이 행이 있어야 `/AAPL`을 렌더합니다(없으면 `getAssetInfo`가 null → `notFound()`). 이 레포에 `tickers` 테이블은 없고, asset 조회의 권위 테이블은 `asset_translations`입니다.
- **고정 OHLCV** — `FakeMarketProvider`는 `e2e/fixtures/bars.json`의 3봉을 항상 반환하므로 차트/시세가 결정적입니다.
- **`freezeClock` 헬퍼** — `e2e/support/clock.ts`. 시간 의존 UI(옵션 stale 배너, React Query staleTime 등)를 결정적으로 만들기 위해 브라우저 시계를 고정합니다. 기본값은 미국장 마감 주말 시각(`2026-05-30T20:00:00Z`).
- **PWA 차단** — `playwright.config.ts`의 `serviceWorkers: 'block'`으로 서비스 워커를 비활성화해 캐시로 인한 비결정성을 제거합니다.

---

## CI

`.github/workflows/e2e.yml`:

- 트리거: 모든 `pull_request` + `feat/e2e-playwright-foundation` 브랜치 push.
- Node 버전은 `.nvmrc`(`node-version-file: '.nvmrc'`)에서 가져옵니다. Yarn 4는 Corepack으로 활성화.
- 백엔드는 **`yarn e2e:up`(docker compose)** 으로 기동합니다. GitHub `services:` 컨테이너를 쓰지 **않습니다** — `global-setup.ts`가 migrate/seed를 `docker compose exec`로 실행하므로 Compose 프로젝트가 존재해야 하고, `services:` 컨테이너는 Compose 프로젝트가 없어 global-setup이 깨집니다.
- 컨테이너가 healthy해질 때까지 명시적으로 대기(`docker compose ps ... --format '{{.Health}}'` 폴링)한 뒤 테스트를 실행합니다.
- 브라우저: **chromium + webkit** 설치. webkit 프로젝트는 `@webkit` 태그가 붙은 스펙만 실행(`grep: /@webkit/`).
- `CI: '1'` 환경에서 실행 → `reuseExistingServer: false`(항상 콜드 프로덕션 빌드), `retries: 2`.
- 실패 시에만 Playwright 리포트(`playwright-report/`, `test-results/`)를 아티팩트로 업로드(보관 7일).
- 결과와 무관하게 `yarn e2e:down`으로 정리.

---

## 새 스펙 작성하기

- `{ test, expect }`를 **`e2e/support/fixtures`에서 import**합니다 (`@playwright/test`가 아니라). 이렇게 해야 네트워크 가드가 적용됩니다.

  ```ts
  import { test, expect } from '../support/fixtures';
  ```

- 모바일 Safari/레이아웃 관련 스펙(iOS fixed/스티키, vaul drawer, 모바일 시트, 차트 canvas 등)은 `@webkit` 태그를 붙입니다. webkit 프로젝트는 이 태그가 붙은 스펙만 실행합니다.
- UI 기본 동작(스크롤/입력)이 아니라 **사용자가 달성하는 결과(outcome)** 를 assert합니다. (예: "검색 후 `/AAPL` 종목 페이지의 h1이 보인다".)
- 시간 의존 UI는 `freezeClock(page)`로 시계를 고정한 뒤 검증합니다.

---

## 트러블슈팅 / 주의사항

- **`yarn e2e:down`은 `-v`로 볼륨을 삭제합니다.** 즉 DB 데이터가 리셋되며, 다음 실행 시 globalSetup이 다시 migrate/seed합니다. (컨테이너를 유지한 채 재실행하면 데이터가 남아 있고 seed는 `onConflictDoNothing`이라 멱등.)
- **E2E에는 절대 `yarn db:migrate`를 쓰지 마세요.** 그 스크립트는 `dotenv -e .env.local`로 감싸져 있고, `.env.local`에는 실제 프로덕션 Neon(`DIRECT_DATABASE_URL`)이 들어 있습니다. `migrate.ts`는 `DIRECT_DATABASE_URL || DATABASE_URL`을 우선하므로 프로덕션을 마이그레이션하게 됩니다. 반드시 `yarn e2e:db` 또는 globalSetup(둘 다 `.env.e2e`로만 실행)을 사용하세요.
- **Redis readonly 토큰을 `.env.e2e`에 명시한 이유** — `siglens-core`의 캐시 provider는 읽기에 `UPSTASH_REDIS_REST_READONLY_TOKEN`을 사용합니다. 이 값을 `.env.e2e`가 주지 않으면, Next가 자동 로드하는 `.env.local`의 **프로덕션 readonly 토큰**이 주입되어 캐시 reader가 로컬 SRH에 그 토큰을 보내고 모든 캐시 GET이 `Invalid token`으로 실패합니다(writer는 `e2e-token`이라 쓰기는 정상 → 읽기만 깨짐). 그래서 `.env.e2e`가 `UPSTASH_REDIS_REST_READONLY_TOKEN=e2e-token`을 명시해 `.env.local` 주입을 차단합니다. (`dotenv -e .env.e2e`가 process.env를 먼저 세팅하고 Next는 이미 설정된 변수를 덮어쓰지 않습니다.)
- **`.env.e2e`는 커밋되어 있습니다.** 로컬에서만 쓰이는 throwaway 자격증명(`siglens:siglens`, `e2e-token`)만 담고 있어 비밀이 아닙니다.
