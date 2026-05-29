# E2E 테스트 스위트 도입 — Playwright (설계서)

- 작성일: 2026-05-30
- 대상 레포: `siglens` (Next.js 16 / React 19 / FSD)
- 상태: 설계 승인 완료 → 구현 계획(writing-plans) 대기

---

## 0. 목적과 범위

기존 단위/통합 테스트(Vitest 4 + Testing Library, `src/**` 599개)는 **유지**한다. 그 위에 **실제 브라우저 기반 E2E 스위트(Playwright)**를 신규 도입해, 유저의 핵심 여정을 실 렌더링·실 상호작용으로 검증한다.

**원칙**
- Vitest = jsdom 컴포넌트/통합(세밀·고속), **그대로 유지**.
- Playwright E2E = 여정당 happy-path 1개 + 가치 높은 핵심 분기 소수. UI 기본동작(스크롤/입력)은 검증 대상이 아니며, "유저 목표 달성(결과)"을 assert한다.
- 단, 스크롤/레이아웃이 *기능이자 cross-browser 리스크*인 경우(예: iOS Safari fixed/스티키, vaul drawer, 모바일 시트, 차트 canvas)는 **WebKit** E2E로 검증한다.

**비범위(Non-goals)**
- 사용량 한도(무료 티어 쿼터, `checkAnalysisLimit`/`usageRepository`) → Vitest 잔류.
- 비주얼 회귀, Lighthouse/CWV 측정 → 본 스위트 대상 아님.
- siglens-core 도메인 로직 변경 → 본 작업은 siglens 앱 레이어 한정.

---

## 1. 핵심 아키텍처 결정

### 1.1 백엔드 전략 — Hybrid
- **외부 데이터·LLM·메일·OAuth = stub**, **인증·계정·세션 = 실제 로컬 테스트 DB+Redis**.

### 1.2 stub은 브라우저가 아닌 **서버사이드 provider 주입** (중요)
Next.js RSC + Server Action 구조라 FMP·yahoo·LLM·Resend·OAuth 호출은 **서버(Node) 프로세스**에서 일어난다. Playwright `page.route`는 브라우저 요청만 가로채므로 서버사이드 fetch를 막지 못한다. 따라서 stub의 1차 수단은 **FSD 어댑터 팩토리 주입**이다.

- `E2E_TEST=1` 부트스트랩에서 siglens provider 팩토리가 **fake 구현(fixture 기반)**을 반환:
  - `getMarketDataProvider()` → fake FMP/yahoo
  - LLM provider 팩토리 → 고정 분석/챗 JSON **즉시 반환**
  - Resend 클라이언트 → 발송하지 않고 토큰을 기록(테스트가 토큰 조회 가능)
  - OAuth 어댑터 → fake provider(코드 교환·프로필 반환·revoke no-op)
- 이는 Postgres 드라이버 스왑 / SRH Redis와 동일한 "팩토리 경계 주입" 패턴이며, *"I/O는 siglens 어댑터"* 아키텍처 원칙과 정합한다.
- `page.route`는 **보조**로만 사용: (a) 네트워크 allowlist 가드, (b) 클라이언트 비콘 허용(`/api/jobs/cancel`, analytics).

### 1.3 비동기 분석 잡 — "네트워크 단락"의 실제 구현
분석은 `enqueue → 폴링 → 결과` 잡 생명주기(Redis 저장, 잡 타입: analysis/fundamental/news/options/overall). fake LLM provider가 즉시 반환하므로, 실 Redis를 경유해도 잡이 **거의 즉시 완료**되고 클라이언트 폴링이 **첫 틱에 `completed`**를 수신한다(실대기 0). 의도(빠름·결정적·실 LLM 없음)는 유지하되 메커니즘은 서버사이드.

### 1.4 로컬 Docker — Postgres 17 + Redis 7.x + SRH
- 비용·데이터 관리 이유로 클라우드(Neon/Upstash) 대신 로컬 컨테이너.
- 드라이버 호환 브릿지:
  - **Redis**: `@upstash/redis`(REST) ↔ 로컬 Redis 앞에 **SRH(`serverless-redis-http`) 사이드카**(`localhost:8079`). 드라이버 코드 무변경, env만 교체.
  - **Postgres**: `@neondatabase/serverless`(HTTP/WS)는 로컬 PG에 직접 못 붙으므로 **드라이버 스왑** — `getDatabaseClient()`/`getAuthDatabaseClient()` 팩토리가 `E2E_TEST=1`일 때 `postgres`(node) 기반 drizzle 인스턴스를 반환. 레포지토리 코드는 drizzle 추상화로 무변경.
  - 트레이드오프: 테스트가 prod와 다른 PG 드라이버를 사용 → Neon HTTP 특유 제약(트랜잭션 등)은 못 잡음. 유저 여정 E2E 목적상 수용.

### 1.5 테스트 시간 기대치
로컬 Docker는 localhost 지연(sub-ms)이라 클라우드 대비 per-query가 더 빠르다. E2E 총시간을 지배하는 것은 브라우저 기동·렌더 × 스펙 수 × 브라우저 매트릭스이며 백엔드 위치가 아니다. Docker 추가분은 런당 ~10~20초 1회성(컨테이너 부팅 + migrate/seed). 잡 폴링·시간 의존은 stub/clock으로 실대기 0. 예상: 로컬 ~1~3분, CI ~3~6분(핵심 스펙 WebKit 포함).

---

## 2. 디렉토리 & 실행 구조

```
e2e/
  specs/            # *.spec.ts (Playwright testDir)
  fixtures/         # FMP/yahoo/LLM/news/options/analysis 결과 JSON, OAuth 프로필
  providers/        # E2E fake provider 구현 (market/LLM/resend/oauth)
  setup/            # global-setup(컨테이너 대기 → migrate → seed → storageState), global-teardown
  support/          # helpers: networkGuard, clock, auth(storageState), pageObjects
playwright.config.ts
docker-compose.e2e.yml
```

- **Vitest 무충돌**: Vitest `include`=`src/**`, Playwright `testDir`=`e2e/specs`. 글롭 비중첩. 기존 599개 유지.
- **webServer**: `E2E_TEST=1 yarn build && E2E_TEST=1 yarn start -p 4300` — 프로덕션 빌드로 실행(PPR/cache 정확성). dev(4200)와 포트 분리.
- **projects**: `chromium`(기본) + `webkit`(`@webkit` 태그 스펙만 grep 실행). firefox 후순위.
- **package.json scripts(신규)**: `test:e2e`, `test:e2e:ui`, `e2e:up`(compose up), `e2e:db`(migrate+seed).

---

## 3. Stub / 주입 레이어

- `E2E_TEST=1`에서만 fake 활성. 프로덕션 번들에 fake가 포함되지 않도록 부트스트랩 분기.
- **네트워크 가드**: `page.route('**/*')` 최후 핸들러가 localhost(앱) 외 호스트로 나가는 브라우저 요청을 abort + 테스트 실패 처리(드리프트·실 API 과금 차단). allowlist: `localhost:4300`, 명시 비콘(`/api/jobs/cancel`).
- **fixture 빌더**: 결정적 데이터 — AAPL bars 100봉, 뉴스 3+종(감정 혼합), 옵션 체인(만기 다수), 분석 결과 JSON(기술/펀더멘털/뉴스/옵션/공포탐욕/종합), OAuth 프로필. 기존 `src/__integration__/*` 26개에서 셀렉터·기대 텍스트 재사용.

---

## 4. Docker / DB / Redis / 시드

- `docker-compose.e2e.yml`: `postgres:17` + `redis:7` + SRH 사이드카.
- **시드**: drizzle migrate → 활성 terms(privacy/tos) → 시드 유저(알려진 자격증명) → tier 변형 유저(free/pro). 기존 `db/scripts/seed*` 및 migrate 스크립트 재사용.
- **격리**: 워커별 고유 이메일(`user+${workerIndex}@test.dev`), 파괴적 테스트(탈퇴) 전용 계정, 테스트 간 관련 테이블 truncate.

---

## 5. 최종 스펙 목록 (~21개)

### Tier 1 — 핵심 제품 루프
| spec | 검증 결과(outcome) | 태그 |
|---|---|---|
| `symbol-search` | 검색 입력 → 자동완성 → `/[SYMBOL]` 이동 (한글 IME 포함) | |
| `symbol-analysis` | 차트 + 타임프레임 변경 → 분석 결과 카드 렌더, 에러 시 재시도 | |
| `analysis-jobs` | 재분석(force)+쿨다운 / 분석 중 이탈 → 취소 beacon / 봇 차단 `BotBlockedNotice` 노출 | clock |
| `symbol-tabs` | 6탭 순회(뉴스/펀더멘털/옵션/공포탐욕/종합) 각 핵심 결과 1개 / 옵션 stale 배너(장마감) | `@webkit`, clock |
| `symbol-chat` | 챗봇 열기 → 질문 → 답변 렌더, 탭 이동 시 컨텍스트 전환(기술↔뉴스) | `@webkit` |
| `model-gate` | 무료모델 통과 / 프리미엄→비회원 auth게이트 / 회원무키→byok게이트 / pro·키등록 통과 | |

### Tier 2 — 인증·계정 (실 DB+Redis)
| spec | 검증 결과 |
|---|---|
| `auth-login` | 로그인 → 인증·이동 + 잘못된 자격증명 분기 + 로그인 시 `/login` 역가드 + 로그아웃 |
| `auth-signup` | 이메일 인증코드(토큰 조회) → 검증 → 가입 → 자동 로그인 |
| `auth-password-reset` | 재설정 요청 → 토큰 링크 → 새 비번 → 새 비번 로그인 성공·구 비번 실패 |
| `auth-oauth` | 신규(동의 필수) + 기존유저 자동로그인 + 이메일 충돌 에러 |
| `account-api-key` | 키 저장(암호화) → 프리미엄 모델 잠금 해제 → 삭제 |
| `account-delete` | 이메일 일치 입력 → 삭제 → 이후 로그인 불가 (격리 계정) |

### Tier 3 — 보조 페이지
`home`(`@webkit`) · `market` · `backtesting` · `contact` · `legal` · `pwa-install`(`@webkit`, iOS 가이드)

### Tier 4 — 횡단/인프라
`resilience`(위젯 에러 바운더리 → 재시도 → 복구) · `not-found`(잘못된 티커/경로 → 404 + 홈 링크) · `seo-smoke`(robots/manifest/sitemap/OG×6 → 200 + content-type)

---

## 6. 플레이키 방지 & CI

- **시간 고정**: `page.clock`으로 장개장/마감·staleTime 결정화(옵션 stale 배너 핵심).
- **storageState 재사용**: global-setup에서 1회 로그인 → 저장, 인증 스펙 외 재사용.
- **Service Worker 비활성**: 테스트 컨텍스트에서 SW 등록 차단(캐싱 간섭 방지).
- **analytics no-op**: `@vercel/analytics` 비콘 차단/무시.
- **CI**: PG/Redis/SRH를 서비스로 기동 → migrate/seed → 샤딩 실행. `retries: 2`(CI만), 실패 시 trace+video+screenshot. WebKit은 `@webkit` 태그 스펙만.

---

## 7. 확인 필요(구현 전 검증)

- **`proxy.ts` 보호 라우트**: 탐색 결과 `/account`·`/account/delete`가 비로그인 시 `/login?next=`로 리다이렉트되는 것으로 읽혔으나, 기존 메모리는 "보호 라우트 없음(역방향 가드만)"으로 기록됨. 계정 스펙은 인증 세션 setup이 전제이므로, 구현 착수 시 `src/proxy.ts`를 코드로 재확인하여 가드 방향을 확정한다.
- **분석 결과 렌더 경로**: 분석 결과가 클라이언트 폴링 응답으로 렌더되는지, RSC(서버 캐시 read)로 렌더되는지에 따라 fake provider만으로 충분한지/클라 폴링 핸들링이 추가로 필요한지 결정. 구현 1단계에서 `src/app/[symbol]/page.tsx` + 분석 위젯 훅으로 확정.

---

## 8. 산출물 요약

- 신규: `playwright.config.ts`, `docker-compose.e2e.yml`, `e2e/**`, `package.json` 스크립트.
- 변경(최소): provider/DB/Redis 팩토리에 `E2E_TEST=1` 분기 주입 지점. 레포지토리·도메인 코드 무변경.
- 불변: Vitest 599개, siglens-core.
