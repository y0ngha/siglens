# Verification Spec — v0.15.0 → current HEAD (production-like)

> 작성: 2026-06-04 · 작성자 컨텍스트: fresh-analysis of `verify-0.15-current` worktree
> 대상: `git log v0.15.0..HEAD` = **218 commits** · 현재 `package.json` version = **0.17.0**
> 짝 문서(Test Cases): `docs/superpowers/specs/2026-06-04-v015-to-current-testcases.md`
> 선행 문서(이전 라운드, v0.16-era): `docs/superpowers/specs/2026-06-03-predeploy-verification.md`

이 문서는 검증을 **설계**한다 — 빌드/기동/검증을 직접 수행하지 않는다. 실행은 짝 Test Cases 문서(C/B/S/D/R 번호)로 한다.

---

## 1. 목적 & 범위

마지막 정상 배포는 **v0.17.0**(`2b44159e chore: release v0.17.0`). 현재 HEAD를 v0.17.0 위에 배포하기 전에, **v0.15.0 이후 누적된 전 변경**이 프로덕션처럼 빌드·기동된 상태에서 ① curl ② Chrome DevTools 양쪽으로 정상 동작하고 SEO·UX·배포 안정성 회귀가 없는지 실증한다.

검증 범위는 두 겹이다:

- **전체 범위 (Full scope):** `v0.15.0..HEAD` = **218 commits**. SEO/ISR 전면 전환, FSD 마이그레이션 후속, auth 클라이언트화, E2E 스위트, 봇/캐시 비용 최적화 등 누적분 전체.
- **배포 안정성 부분집합 (Since last deploy):** `v0.17.0..HEAD` = **67 commits**. v0.17.0 배포 이후 master에 들어온 것 — 이번 배포가 **"0.17.0 위 over-deploy"**로서 깨면 안 되는 표면. 가장 회귀 위험이 높은 구간이며 §5와 Test Cases의 전용 섹션(R1~)에서 따로 다룬다.

> ⚠️ 빌드 output의 `●`(SSG) 표시 ≠ 런타임 동작. ISR/캐시는 반드시 `prod build && start` 후 런타임 헤더(`x-nextjs-cache: HIT`)와 로그(`DYNAMIC_SERVER_USAGE` 0)로 실측한다 (`src/app/CLAUDE.md` ISR 4축 규약).

---

## 2. 변경 요약 (영역별, 커밋/경로 근거)

### A. `[symbol]` 6-라우트 ISR/SEO 전면 전환 (#543~#549, #551, #553) — 전체범위
- 라우트: `/[symbol]`(chart), `/[symbol]/overall`, `/[symbol]/fundamental`, `/[symbol]/news`, `/[symbol]/options`, `/[symbol]/fear-greed`.
- 각 `page.tsx`: `export const revalidate = 3600` + `export async function generateStaticParams() { return [] }`(on-demand ISR). 동적 데이터는 `staticSymbolCache`(`unstable_cache`, 1h + `symbol:` tag)로 정적화. (근거: `src/app/[symbol]/page.tsx`, `…/fundamental/page.tsx`, `src/shared/cache/staticSymbolCache.ts`.)
- **축 0 인증 클라이언트화** (`1f9ff95d`, `e4a66ce3`, #547): root layout이 `cookies()`를 직접 호출하지 않도록 헤더를 `AuthSessionHeaderClient`(client island)로 분리. navigation마다 `currentUser` 1회 refetch로 redirect-기반 인증 플로우 후 헤더 재동기화. (근거: `src/app/layout.tsx` L144, `src/app/_components/AuthSessionHeaderClient.tsx`.)
- **FactLayer SSR**: `useSearchParams` CSR-bailout 밖으로 크롤 가능 텍스트를 Suspense fallback에 서버 컴포넌트로 박음(`TechnicalFactsSummary`/`OverallFactsSummary`). (근거: `src/app/[symbol]/page.tsx` L282~330.)
- **News on-demand 무효화** (`39b0d7b7`): `headers()`(봇 판정) 제거 → 클라 트리거(`useNewsAnalysisTrigger`)로 이전, ingestion 후 `revalidateTag('news:${symbol}', 'max')`.

### B. 인프라 실패 graceful degrade + soft-404 정합 (#545, #552, #555) — 전체범위
- `getAssetInfoResilient` / `getProfileResilient`: FMP 인프라 장애 시 throw 대신 `{ degraded: true }` 반환 → 본문 200(degrade UI), `generateMetadata`는 `NOINDEX_SYMBOL_METADATA`(canonical:null). (근거: `src/entities/ticker`, `src/app/[symbol]/fundamental/getProfileResilient.ts`, `…/FundamentalDegraded.tsx`.)
- `0a59e92a` (#549): `getAssetInfoResilient`에서 `connection()` 제거 → ISR cold-gen 시 FMP 장애가 500을 던지지 않게 함 (ISR cold-gen 500 회귀 픽스).
- `a1368f38` (#555): symbol metadata soft-404에 noindex 누락 픽스 — `assetInfo === null`(형식 유효·실재 안 함)도 `NOINDEX_SYMBOL_METADATA`. (근거: `src/app/[symbol]/page.tsx` L68~70.)
- `[symbol]/error.tsx`(#552): 전 sibling 라우트 throw 봉쇄 에러 바운더리.

### C. FMP fundamental 캐시 데코레이터 (#560) — **배포 안정성 부분집합 (v0.17.0..HEAD)**
- `CachedFundamentalProvider`: `FundamentalProvider`를 감싸 메서드별 Redis 캐싱(`fundamental:*` 키, `getOrSetCache`). 페이지 SSR과 core 분석 경로가 동일 캐시 공유. (근거: `src/shared/api/fmp/CachedFundamentalProvider.ts`.)
- **Poison 방지**: FMP 장애(throw)는 `set` 전에 전파돼 캐싱 안 됨; 빈 200(존재하지 않는 티커)만 `null`로 캐싱. (근거: 같은 파일 L51~67.)
- **Peer PER/PSR 보강** (#538, `fe91a378`): peer 목록을 cached key-metrics로 enrich, `PEER_LIMIT = 10`으로 cap. sector-performance를 날짜별 캐싱.

### D. 운영 공지 팝업 (#559) — **배포 안정성 부분집합 (v0.17.0..HEAD)**
- DB 테이블 `notices`(migration `0016_clear_rachel_grey.sql`): title/body/link_url/path_pattern/priority/is_active/starts_at/ends_at.
- `getActiveNoticesAction`(server action, `'use server'`): DB 미설정/실패 시 `[]`로 graceful degrade. (근거: `src/entities/notice/actions/getActiveNoticesAction.ts`.)
- `NoticePopupLoader`(client-only `dynamic({ ssr: false })`) → root layout 마운트. `useNoticePopup`: 마운트 1회 fetch + pathname 변경 시 `matchPath` 경로 매칭 + `localStorage` dismiss 필터. (근거: `src/app/layout.tsx` L141, `src/widgets/notice-popup/`.)
- link_url은 http(s)만 허용(safeUrl 가드). "다시 보지 않기" = localStorage 영구, "닫기"/Esc/배경 = 임시. (근거: `docs/SERVICE.md` §운영 기능.)

### E. Auth 페이지 full-static 전환 (#557) — **배포 안정성 부분집합 (v0.17.0..HEAD)**
- `/login`, `/signup`, `/reset-password`: `searchParams` 읽기를 `*Content`('use client')로 격리 → 라우트가 full-static(○) prerender. shell/footer/metadata 정적, 쿼리 의존부만 Suspense 아래 CSR(`AuthFormSkeleton` fallback). (근거: `src/app/login/page.tsx` L20~52.)
- 전부 `robots: { index: false, follow: true }` + self-canonical. (근거: 같은 파일 L12~18.)

### F. Market summary 부분 실패 안내 (#556) — **배포 안정성 부분집합 (v0.17.0..HEAD)**
- `hasMissingQuotes`(quote=0 = FMP fetch 실패 종목 존재) → `MarketDataErrorNotice` 안내, 캐시 가드 강화. (근거: `src/widgets/dashboard/hooks/useMarketSummary.ts` L68~71, `MarketDataErrorNotice`.)

### G. Skills gating/tagging + chat prompt caching (#539, #541, #542) — 전체범위
- 모든 skill frontmatter에 gating 블록(snake_case) 태깅, CI frontmatter 검증 게이트. `FileSkillsLoader` skill-name dedupe, `freeApiKey` 정책 삭제. siglens-core 0.19.x bump.
- Anthropic multi-turn chat prompt caching(`withHistoryCacheBreakpoint`).
- 압축 indicator core + candle primer skill, dashboard bearish signal badge.
- ⚠️ 분석 로직 자체는 `@y0ngha/siglens-core` 소관 — siglens 측은 어댑터/로더만. 검증은 **렌더 결과** 기준.

### H. Vercel transfer-cost 최적화 + 봇 차단 (#543, `b3c220dc`) — 전체범위
- 봇 차단, page+OG ISR, FMP 404 안전성으로 Fast Origin/Data Transfer 절감. `popular tickers` 업데이트(`44a376fa`).

### I. SEO 인프라: sitemap index 분할 + 보안 헤더 — 전체범위(v0.15.0 직후~)
- `/sitemap.xml`(sitemapindex) → `/sitemap-static.xml`, `/sitemap-popular.xml`, `/sitemap-longtail-{n}.xml`. `next.config.ts` rewrites가 `/sitemap-*.xml` → `/api/sitemap/*` 매핑. (근거: `src/app/api/sitemap/route.ts`, `next.config.ts` L59~67.)
- robots.txt: `/api/` Disallow + 패러사이트봇(Ahrefs/Semrush/MJ12/Dot/BLEX/DataForSeo) 전면 Disallow. 인증 페이지는 robots.txt가 아닌 page noindex로 처리. (근거: `src/app/robots.ts`.)
- 전역 보안 헤더: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`. (근거: `next.config.ts` L69~92.)

### J. E2E Playwright 스위트 (#531~#537) — 전체범위(검증 인프라, 런타임 비영향)
- Tier 1~4 + resilience 23+ 스펙. fake OAuth/email 어댑터(`E2E_TEST=1`), 에러 주입 쿠키 seam, authed storageState. CI workers:1(DB-write 병렬 hang 회피). **런타임 코드 아님** — 회귀 안전망으로 참고.

---

## 3. 검증 대상 라우트 인벤토리 (App Router, 실재 확인)

### 페이지 라우트
| 경로 | 파일 | ISR/렌더 | 비고 |
|---|---|---|---|
| `/` | `src/app/page.tsx` | `revalidate=3600`, searchParams 미소비 | home, footer 포함 |
| `/[symbol]` | `src/app/[symbol]/page.tsx` | on-demand ISR(`gSP=[]`+`revalidate=3600`) | chart + AI, FactLayer SSR |
| `/[symbol]/overall` | `…/overall/page.tsx` | 동일 | 종합 결론, FactLayer SSR |
| `/[symbol]/fundamental` | `…/fundamental/page.tsx` | 동일 | profile degrade/notFound 게이트 |
| `/[symbol]/news` | `…/news/page.tsx` | 동일 + `news:${symbol}` on-demand 무효화 | 클라 분석 트리거 |
| `/[symbol]/options` | `…/options/page.tsx` | 동일 | hasOptions/snapshot 정적 |
| `/[symbol]/fear-greed` | `…/fear-greed/page.tsx` | 동일 | bars prefetch 정적 |
| `/market` | `src/app/market/page.tsx` | — | 마켓 요약 + 부분실패 안내(#556) |
| `/backtesting` | `src/app/backtesting/page.tsx` | — | |
| `/login` `/signup` `/reset-password` | 각 `page.tsx` | **full-static(○)**(#557) | noindex + self-canonical |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | — | noindex |
| `/signup/oauth/consent` | `…/oauth/consent/page.tsx` | — | OAuth 신규가입 동의 |
| `/account` `/account/delete` | `src/app/account/…` | — | authed only, noindex |
| `/terms` `/privacy` | 각 `page.tsx` | — | **빌드타임 DB 조회**(§6) |
| `/login` error | `src/app/login/error.tsx` | — | |
| `/[symbol]` error | `src/app/[symbol]/error.tsx` | — | sibling throw 봉쇄(#552) |
| not-found | `src/app/not-found.tsx` | — | invalid ticker는 ISR에서 HTTP 200 + 본문 |

### API / 메타 라우트
| 경로 | 파일 | 출력 |
|---|---|---|
| `/robots.txt` | `src/app/robots.ts` | text/plain |
| `/sitemap.xml` | rewrite → `src/app/api/sitemap/route.ts` | application/xml (sitemapindex) |
| `/sitemap-static.xml` | → `api/sitemap/static/route.ts` | xml |
| `/sitemap-popular.xml` | → `api/sitemap/popular/route.ts` | xml |
| `/sitemap-longtail-{n}.xml` | → `api/sitemap/longtail/[page]/route.ts` | xml |
| `/manifest.webmanifest` | `src/app/manifest.ts` | manifest+json (PWA) |
| `/[symbol]{,/overall,/fundamental,/news,/options,/fear-greed}/opengraph-image` | 각 `opengraph-image.tsx` | `dynamic='force-static'`, `revalidate=2592000`(30d), image/png |
| `/[symbol]/news/twitter-image` | `…/news/twitter-image.tsx` | image/png |
| `/api/auth/[provider]/start` | `…/start/route.ts` | OAuth 시작 redirect |
| `/api/auth/callback/[provider]` | `…/callback/route.ts` | OAuth 콜백 |
| `/api/jobs/cancel` | `…/jobs/cancel/route.ts` | 분석 job 취소 |

---

## 4. 영역별 핵심 동작 & 불변식 ("올바름"의 정의)

### 4.1 렌더링 / 상태 코드
- `/`, 6×`/AAPL[/*]`, `/market`, `/backtesting`, legal, auth 페이지 → **HTTP 200**.
- degrade 종목(FMP 미시드 well-formed, 예 `/MSFT`) → **200**(500/404 아님) + degrade UI.
- invalid-format ticker(예 `/INVALIDTICKER1`) → ISR에서 **HTTP 200 + not-found 본문**(`notFound()`는 ISR 컨텍스트에서 200).
- 소문자 ticker(`/aapl`) → **301** → `/AAPL`.
- 어느 라우트도 hydration 에러 0 (client-island 헤더, CSR-bailout subtree).

### 4.2 SEO 메타/구조화 데이터 (불변식)
- **canonical**: 유효 종목 = self·절대 URL·대문자. degrade/invalid = **canonical 태그 부재**(home `SITE_URL` 미상속 — `NOINDEX_SYMBOL_METADATA`의 `alternates.canonical: null`).
- **robots meta**: 유효 종목 `index,follow`; degrade/invalid `noindex,nofollow`; auth/account `noindex,follow`.
- **single h1**: 전 라우트 정확히 1개. chart는 SSR sr-only h1(fallback) ↔ 가시 클라 h1이 hydration 시 교체(동시 미존재).
- **`[SYMBOL]` placeholder 누출 0**: cacheComponents 비활성이라 fake-params prerender 없음 — generateMetadata가 실제 params로만 실행.
- **JSON-LD**: WebPage(`@id#webpage`) + BreadcrumbList + FAQPage; chart에 Corporation(about, stock 분류 시만); news에 Article. 전부 SSR HTML 내 유효 JSON.
- **title**: 라우트별 구체(`%s | Siglens` 템플릿).
- **robots.txt**: `/api/` Disallow + 패러사이트봇 6종 Disallow + sitemap 라인. 인증 페이지는 Disallow 없음(page noindex로 처리).
- **sitemap.xml**: 유효 sitemapindex XML, sub-sitemap(static/popular[/longtail-n]) 참조, `Content-Type: application/xml`.
- **OG images**: 6 라우트 + news twitter — 200 `image/png`, `force-static`+30d.

### 4.3 ISR 캐싱 (불변식)
- 6 종목 라우트 warm 요청(2번째 hit): `x-nextjs-cache: HIT` + `Cache-Control: s-maxage=3600` 계열.
- 런타임 로그 `DYNAMIC_SERVER_USAGE` = 0 (축 0/1 위반 없음).
- auth 3페이지: 빌드 output `○`(full static), 런타임 정적 서빙.
- home: `revalidate=3600` 반영.

### 4.4 Auth 플로우 (불변식)
- 게스트(쿠키 없음): 헤더에 로그인/회원가입, authed avatar flash 없음.
- login/signup 성공(redirect) → navigation refetch로 헤더 authed 전환. logout → guest 전환. (이 "redirect 후 헤더 stuck"이 v0.16 실패 축 — E2E `account-logout.spec.ts`가 커버.)
- OAuth start → callback → consent → finalize (E2E fake adapter로 CI 커버).

### 4.5 운영 공지 팝업 (불변식, v0.17.0..HEAD)
- 활성 공지 row가 있고 path_pattern 매칭 + 미dismiss → 모달 노출.
- DB 미설정/조회 실패 → 빈 큐, **에러 없이 페이지 정상**(부가 기능 degrade).
- "다시 보지 않기" → localStorage 영구 저장, 새로고침 후 미노출.
- link_url non-http(s) → 렌더 거부(safeUrl 가드).
- client-only(`ssr:false`)라 SSR HTML에 미포함 — hydration 후 마운트(streaming race 없음).

### 4.6 FMP fundamental 캐시 (불변식, v0.17.0..HEAD)
- 같은 종목 fundamental 2회 요청 → 2번째는 Redis HIT(FMP round-trip 없음, `x-nextjs-cache: HIT`로 간접 확인).
- FMP 장애 → degrade(N/A 렌더) + **장애 결과 미캐싱**(다음 요청 재시도 가능); 빈 200(존재 안 함)만 null 캐싱.
- peer 표 PER/PSR 채워짐(#538), peer ≤ 10.

### 4.7 에러/degrade 처리 (불변식)
- FMP/Redis/DB 인프라 장애가 어느 라우트도 **500으로 표면화하지 않음** — graceful degrade(200 + thin UI + noindex).
- market summary 부분 실패 → 안내 배너, 페이지 정상.

---

## 5. 리스크 영역 / 회귀 가능성 (배포 안정성)

### 5.1 v0.17.0..HEAD 부분집합 (이번 over-deploy가 깨면 안 되는 표면) — **최우선**
1. **공지 팝업(#559)** — root layout에 새 client island 마운트. 위험: hydration race / 모든 라우트에 영향 / DB 장애 시 페이지 깨짐 / Esc·focus-trap a11y. **DB seed 필요**(notices row) 또는 빈 큐 graceful 둘 다 검증.
2. **Auth full-static(#557)** — `/login` `/signup` `/reset-password`가 ○로 전환. 위험: searchParams(`?next=`, `?code=`) 의존부가 CSR로 안 올라오면 폼 동작 불가 / static prerender가 DB·쿠키 의존 누출로 빌드 실패.
3. **FMP fundamental 캐시(#560)** — 캐시 데코레이터 신규. 위험: poison(장애 캐싱)으로 long-tail 종목 영구 N/A / 키 대소문자 불일치(`sym()` uppercase) / peer enrich N+1.
4. **Market summary 부분실패(#556)** — 안내 로직. 위험: 정상 데이터에도 false-positive 안내 / 캐시 가드가 부분 데이터 캐싱.

### 5.2 전체범위 고위험 (v0.16 실패 모드 — 근본 해결 확인)
1. **루트 레이아웃 `cookies()` 재유입** — axis-0 위반 시 전 라우트 dynamic화 → ISR 붕괴 → cold-gen 500 (v0.16 롤백 원인). `src/app/layout.tsx`에 `cookies()`/`headers()` 직접 호출 0 확인.
2. **ISR 미정적화 재유입** — 종목 라우트 데이터 fetch가 `staticSymbolCache` 우회 시 `DYNAMIC_SERVER_USAGE` → cold-gen 500.
3. **soft-404 robots 충돌** — degrade/invalid에서 canonical 누출 또는 index+noindex 동시.
4. **route segment config 리터럴 위반** — `revalidate`/`dynamic`을 상수/식으로 추출 시 Next가 조용히 무시 → ISR 깨짐 (`src/app/CLAUDE.md` 경고).

---

## 6. 환경 노트 (빌드/기동/검증)

### 6.1 빌드 & 기동
- 프로덕션 빌드 `yarn build` + `yarn start`. **`yarn`만**(npm/pnpm 금지).
- 워크트리 node_modules는 **symlink 금지** — `cp -al` 하드링크 후 잔여 `node_modules/node_modules` 제거(Turbopack/dual-React 회피).
- env-shadow: e2e DB+redis 기동, `.env.local` 키를 `.env.e2e`로 shadow(`dotenv -e .env.e2e -o`).
- 빌드 exit code는 파이프 없이 직접 캡처(`> log 2>&1; echo $?`) — `| tail`은 실패를 exit 0으로 가림.

### 6.2 필수 env (없으면 코드와 무관하게 빌드/런타임 실패)
1. **`SIGLENS_GITHUB_TOKEN`** (read:packages) — `@y0ngha/siglens-core@0.19.1`(GitHub Packages) 설치. 없으면 `yarn install` 403. **CI(ci.yml)는 빌드 안 함 → 못 잡음**.
2. **`DATABASE_URL` + `terms` 테이블(active `tos`/`privacy`)** — `/terms`·`/privacy`가 **빌드타임** DB 조회(try/catch 없음).
3. **`DATABASE_URL` + `notices` 테이블(migration 0016 적용)** — 공지 팝업 server action 검증용. **미설정 시 `[]` graceful degrade라 빌드는 안 깨지나, 노출 검증엔 seed 필요.**
4. **`NEXT_PUBLIC_SITE_URL`** — 빌드타임 인라인(canonical/OG/JSON-LD/sitemap). 프로덕션 도메인.
5. **FMP API key** — 시드 종목(`AAPL`) 실데이터. 미설정/미시드 종목은 degrade(200+noindex)로 검증.
6. **Upstash Redis(`UPSTASH_REDIS_REST_*`)** — ISR `staticSymbolCache`·`getOrSetCache`·FMP fundamental 캐시·분석 peek. 장애 시 graceful degrade 경로도 검증 대상.

### 6.3 docker postgres가 필요한 케이스 (DB-backed)
| 플로우 | DB 의존 | seed 필요 |
|---|---|---|
| `/terms` `/privacy` | **빌드타임** active terms row | **예** (없으면 빌드 실패) |
| 공지 팝업 노출 | `notices` active row(+window+path) | **예**(노출 검증 시); 미시드면 빈 큐 graceful 검증 |
| auth(login/signup/reset/oauth) | users/sessions/verification | **예**(플로우 검증 시) — E2E 인프라(`.env.e2e` + fake email/oauth) 재사용 권장 |
| `/account` `/account/delete` | authed user + api_key | **예**(authed storageState) |
| sitemap longtail | tickers DB | 선택(없으면 longtail 항목 생략 graceful) |

> DB seed는 기존 E2E 인프라(docker postgres + `.env.e2e` + fake email/oauth 어댑터, `E2E_TEST=1`)를 그대로 재사용하는 것을 권장한다. 공지 검증을 위해 `notices`에 1 active row(path_pattern `null` 또는 `/AAPL/*`, window 현재 포함)를 INSERT.

---

## 7. 검증 방법 두 갈래

- **① curl** — status code / 응답 헤더(`x-nextjs-cache`·`cache-control`·`content-type`·`x-robots-tag`·보안 4종) / HTML 마커(canonical·h1·JSON-LD·noindex·`[SYMBOL]` 누출) / robots.txt·sitemap XML·OG 엔드포인트.
- **② Chrome DevTools** (claude-in-chrome) — 실제 렌더 / 콘솔(하이드레이션 0에러) / 헤더 게스트·authed 상태 / 인터랙션(검색·탭 전환·분석 트리거·auth·공지 팝업) / 네트워크 워터폴 / Core Web Vitals 스모크(LCP/CLS) / UX 회귀(vs 0.15.0).

실행 절차·기대값은 짝 문서 `2026-06-04-v015-to-current-testcases.md`로 한다.
