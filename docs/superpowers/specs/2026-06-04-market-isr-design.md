# `market` 페이지 ISR 전환 — 설계

- 날짜: 2026-06-04
- 상태: **설계 확정, 구현 대기**
- 관련: `[symbol]` ISR(PR #546·547·548·549, `docs/superpowers/specs/2026-06-02-symbol-isr-seo-design.md`), 이슈 #439(PPR 비활성)
- 참조 규약: `src/app/CLAUDE.md`(ISR 4축 규약), `docs/qa/README.md`

## 배경 / 문제

`/market` 페이지는 현재 **dynamic(SSR)** 으로 동작한다. 매 요청 서버 렌더되어 vercel transfer/compute cost가 발생하고, `[symbol]`이 받은 ISR 정적화 이득을 못 받는다. dynamic을 강제하는 요인은 3가지가 동시에 작용한다:

1. **`getMarketSummaryAction.ts:13` — `await headers()` 무조건 호출** (+ `isBot`, E2E 분기의 `cookies()`). 이 action이 RSC prefetch 경로(`page.tsx:137-140`)에서 실행되어 라우트 전체를 dynamic으로 끌어내린다. **가장 큰 벽.**
2. **`page.tsx:123` — `MarketContent`가 `await searchParams`** (sector/timeframe 파싱). 동적 API 접근.
3. **`getCachedMarketSummary` → `getOrSetCache`(redis `@upstash/redis` HTTP = no-store fetch).** ISR static generate가 no-store fetch를 만나면 `DYNAMIC_SERVER_USAGE`를 throw.
4. 부가: `submitBriefing`(AI worker로 fire-and-forget POST, side-effect)도 static prerender에 부적합.

`/market`은 **정적 라우트**(동적 세그먼트 아님)라 `[symbol]`보다 한 가지 쉽다 — `generateStaticParams`가 **불필요**하고 `export const revalidate` 리터럴만 추가하면 ISR이 걸린다(축 0~2가 선결된다는 전제 하에).

### `[symbol]` ISR 4축 규약 (참조 — `src/app/CLAUDE.md`)

PPR(`cacheComponents`) 비활성 상태에서 ISR을 정상 캐시하려면 4가지를 모두 지켜야 한다:

- **축 0**: 공유 셸(root layout)에서 `cookies()`/`headers()` 금지. → `[symbol]` ISR에서 **이미 제거 완료**(`AuthSessionHeaderClient` 클라이언트화). market은 추가 작업 불필요, 확인만.
- **축 1**: 동적 데이터(redis/DB/FMP)를 `unstable_cache`로 정적화(revalidate 1h + tag).
- **축 2**: `useSearchParams` CSR bailout 밖으로 SEO 콘텐츠를 서버컴포넌트로 분리.
- **축 3**: `generateStaticParams=[]` + `revalidate=3600`(리터럴). → market은 정적 라우트라 `revalidate`만.

## 목표

1. **`/market` ISR 활성화**: RSC 렌더 경로에서 동적 API 0건. `prod build && start`에서 `●(SSG)`/ISR로 캐시되어 transfer/compute cost 절감.
2. **3계층 캐시 전략을 `[symbol]`과 완전 정렬**: Redis(`getOrSetCache`) → React `cache()` → Next ISR(`unstable_cache`). 특히 **sector signals의 빠진 Redis 계층을 신설**.
3. **SEO 무손상 + 섹터 신호 SSR 노출**: `SectorFactsSummary`(서버컴포넌트)로 default tf 섹터 신호를 SSR HTML에 박아 크롤러가 보게 한다. canonical/메타 회귀 없음.
4. **briefing peek seed**: `[symbol]`의 `peekAnalysisCache` 패턴과 평행하게, cached briefing을 SSR seed로 노출(core `peekBriefingCache` 신설).
5. **E2E 무손상**: force-partial 안내 등 기존 E2E 스펙이 깨지지 않음.

## 검증 기준 (사용자 제약)

- 목표 1·3은 **실측**으로 증명: `prod build` output + `curl -I`(`x-nextjs-cache: HIT`) + 런타임 로그(`DYNAMIC_SERVER_USAGE` 0).
- **SEO QA를 curl + chrome 도구로 수행** — SSR HTML의 SEO 콘텐츠/메타/JSON-LD를 실측.
- 테스트 커버리지 **전체 변경면 90% 이상**, **Happy Path + Worst Case 모두** 작성.
- 작업은 **worktree로 분리** — siglens-core, siglens 둘 다.

## 결정 사항 (브레인스토밍 확정)

| 결정 | 선택 | 근거 |
|---|---|---|
| **신선도 정책** | A: `revalidate=3600`(1h) — SSR stale 허용, 클라 실시간 | `[symbol]`과 동일 모델. SSR HTML은 SEO/초기페인트 seed, 실가격은 클라 `useMarketSummary`(staleTime 1분)가 갱신. 섹터 신호 텍스트가 SEO 핵심이고 가격은 보조라 1h stale 무방. 캐시 효율 최고. |
| **briefing SSR 노출** | B: peek seed — cached briefing을 SSR에 노출 | `[symbol]`의 `peekAnalysisStatic`과 완전 평행 → 일관성. core `peekBriefingCache` 신설 필요. |
| **접근 방식** | ① 완전 평행 (core + siglens 동시) | core를 **로컬 build → `node_modules/@y0ngha/siglens-core` 덮어쓰기**로 publish 병목 우회. 정식 publish는 사용자가 추후. |

---

## 설계 — 섹션 A: 데이터 레이어 (core + 정적화 + Redis 정렬)

### A-1. siglens-core 변경 (worktree, 로컬 build → node_modules 덮어쓰기)

**`application/market/peekBriefingCache.ts` 신설** — `peekAnalysisCache`의 briefing 버전. `submitBriefing`이 쓰는 캐시(`ISO date+hour + briefing model + index/sector quote hash` 키)를 **읽기 전용**으로 조회. side-effect(worker POST) 없음.

```ts
// 반환: cached가 있으면 normalizeMarketBriefing 적용된 briefing, 없으면 null
export function peekBriefingCache(
    data: MarketSummaryData,
    modelId?: ModelId,
): Promise<MarketBriefingResponse | null>;
```

- 내부적으로 `submitBriefing`의 `cached` 분기 캐시 키 생성·조회·정규화 로직을 **추출/공유**해 키 불일치를 방지(submitBriefing이 cached로 판정하는 것과 peek이 보는 것이 동일해야 함).
- `index.ts`에 export 추가.

### A-2. siglens 정적화 헬퍼 3종 (`barsStaticCache` 패턴, `unstable_cache` + `revalidate=SECONDS_PER_HOUR` + tag)

| 헬퍼 (신설 위치) | 감싸는 대상 | 키 / 태그 |
|---|---|---|
| `entities/market-summary/lib/marketSummaryStaticCache.ts` → `getMarketSummaryStatic()` | `getCachedMarketSummary`(redis) | `['market-summary-static']` / `market-summary` |
| `entities/sector-signal/lib/sectorSignalsStaticCache.ts` → `getSectorSignalsStatic(tf)` | `getCachedSectorSignals`(A-3, redis) | `['sector-signals-static', tf]` / `market-summary` |
| `entities/market-summary/lib/briefingStaticCache.ts` → `peekBriefingStatic(summary)` | core `peekBriefingCache` | `['briefing-peek-static', hash]` / `market-summary` |

### A-3. sector signals Redis 계층 신설 (Redis 정렬 — `[symbol]` bars와 동일 3계층)

현재 `getSectorSignalsAction`은 core `getSectorSignals`를 매 호출 직접 실행(FMP fetch + 지표계산 반복) — **Redis 계층이 통째로 없다.** `[symbol]` bars(`getCachedBarsWithIndicators`)와 정렬:

**`entities/sector-signal/lib/sectorSignalsCache.ts` 신설** — `marketSummaryCache.ts` 패턴 복제:

```ts
export const getCachedSectorSignals = cache(   // React cache() — 요청 dedup
    (provider: MarketDataProvider, tf: DashboardTimeframe) =>
        getOrSetCache(
            `sector-signals:${tf}`,                       // redis 키 (tf별)
            computeBarsEffectiveTtl('1Day', new Date()),  // 장세션 동적 TTL — market summary와 동일
            () => getSectorSignals(provider, tf),
            result => result.stocks.length > 0,           // 가드: 빈 결과 미캐싱
        ),
);
```

- `getSectorSignalsAction` → 이 헬퍼를 호출하도록 변경.
- `getSectorSignalsStatic`(A-2)이 이 redis 레이어를 감쌈 → **3계층 완성**.

### 3계층 캐시 매트릭스 (목표 — `[symbol]` 정렬)

| 계층 | market summary | sector signals | briefing |
|---|---|---|---|
| **Next ISR** (`unstable_cache`, 1h, `market-summary` tag) | `getMarketSummaryStatic` | `getSectorSignalsStatic(tf)` | `peekBriefingStatic` |
| **React `cache()`** (요청 dedup) | ✅ 기존 | `getCachedSectorSignals` (신설) | (peek, 단발) |
| **Redis** (`getOrSetCache`, 장세션 동적 TTL) | ✅ 기존 | **신설** | core 캐시(date+hour) |

### ⚠️ A 리스크 — 0-price stale

`getBarsStatic`이 `getBarsAction`(redis)을 감싸듯 `getMarketSummaryStatic`도 `getCachedMarketSummary`(redis `getOrSetCache`)를 감싼다. 그런데 redis 레이어의 `allQuotesPresent` 가드(0 price 미캐싱)와 달리 `unstable_cache`는 throw만 안 하면 캐싱하므로, **0 price summary가 Next data cache에 최대 1h stale로 박힐 수 있다.** 클라 `useMarketSummary`가 마운트 후 실시간으로 덮으므로 사용자 영향은 초기 페인트 한정이나, 필요 시 "**0 price면 `unstable_cache` 콜백 안에서 throw → 캐시 회피**(호출부 `.catch`로 degrade)" 가드를 추가한다. sector signals도 빈 결과에 동일 고려.

---

## 설계 — 섹션 B: action 분리 + 클라 데이터 흐름

현재 `getMarketSummaryAction` 하나가 summary + briefing + 봇판정을 모두 처리한다. 관심사별로 분리해 summary는 정적 경로로 / briefing·봇판정은 클라 전용 동적 경로로 나눈다(`[symbol]`의 bars=정적 / analysis submit=클라 트리거 구조와 평행).

### B-1. Server Action 분리

| 경로 | 위치 | headers/봇/side-effect | 호출자 |
|---|---|---|---|
| **summary** | `getMarketSummaryStatic` (lib, A-2) | ❌ 없음 (정적) | RSC prefetch |
| **summary (클라)** | `getMarketSummaryClientAction` (신설, B-4 E2E seam) | E2E 쿠키 seam만 | `useMarketSummary` |
| **sector signals** | `getSectorSignalsStatic(tf)` (lib, A-2) | ❌ 없음 (정적) | RSC prefetch(default) + `useSectorSignals` |
| **briefing** (신설) | `entities/market-summary/actions/submitMarketBriefingAction.ts` | ✅ `headers()`+`isBot`+E2E `cookies()`+`submitBriefing` | `useMarketBriefing` (클라 마운트 후) |
| **poll** | 기존 `pollBriefing` action | ✅ 동적 | `useBriefing(jobId)` |

- `submitMarketBriefingAction`은 **내부에서 `getCachedMarketSummary` 재조회**(redis HIT라 저렴)해 봇판정과 함께 `submitBriefing(summary)` 실행 → 클라가 summary를 서버로 되보낼 필요 없음. 반환: `{ briefing | jobId, botBlocked }`.
- 기존 `getMarketSummaryAction`은 **제거**. `MarketSummaryActionResult` union(`types.ts:235-238`)은 summary-only로 단순화하고 briefing/botBlocked은 briefing 경로 전용 타입으로 분리.

### B-2. 클라 훅 3종

1. **`useMarketSummary`** (수정): `queryFn` → `getMarketSummaryClientAction`(prod에선 사실상 정적 seed 사용, 1분 후 redis 실시간). 반환에서 `briefing`/`botBlocked` 제거(summary-only). prefetch seed(`getMarketSummaryStatic`) 그대로.
2. **`useSectorSignals(tf)`** (신설): `queryFn` → `getSectorSignalsStatic(tf)`. **`useSectorSignalState`가 `data` props 대신 이 훅 사용** → `activeTimeframe` 변경 시 클라가 해당 tf 신호를 fetch(`[symbol]`의 `?tf=`→`useBars` 패턴). default tf는 prefetch seed.
   - 부수효과(개선): 현재 `useSectorSignalState`는 `activeTimeframe`을 quadrants 계산에 안 쓰고 RSC re-fetch에 의존했는데, 이제 훅이 tf별 데이터를 직접 공급 → tf 전환이 클라에서 정상 동작.
3. **`useMarketBriefing`** (신설): 마운트 후 `submitMarketBriefingAction` 호출. `peekBriefingStatic` 결과를 **초기 seed**로, `submitted`면 `useBriefing(jobId)` 폴링으로 교체, 봇이면 비노출.

### B-3. 소비처 수정

- `MarketSummaryPanel`: `useMarketSummary`(summary) + `useMarketBriefing`(briefing) **분리 소비**(현재 `useMarketSummary.briefing` → 신규 훅).
- `SectorSignalPanel`: `data` props 제거 → `useSectorSignalState` 내부에서 `useSectorSignals` 사용.

### B-4. ⭐ E2E seam 보존 (force-partial 안내)

현재 `getMarketSummaryAction.ts:21-36`의 `isE2E()` 분기가 **쿠키로 일부 quote를 0으로 주입**해 "데이터 일부 로드 실패" 안내를 E2E 검증한다. summary가 정적화되면 쿠키를 못 읽어 seam이 깨진다. **4원칙으로 보존:**

| # | 원칙 | 효과 |
|---|---|---|
| 1 | **RSC prefetch는 항상 정적** (`getMarketSummaryStatic`, 쿠키 없음) | ISR 정적화 보존 — E2E build에서도 동일 경로 |
| 2 | **클라 queryFn = `getMarketSummaryClientAction`**(server action). 내부에서 `isE2E()` && force-partial 쿠키면 `e2eForceMarketPartial(summary)`, 아니면 `getCachedMarketSummary`(redis 실시간) | 쿠키 seam을 클라 동적 경로에 유지(라우트 렌더와 무관 → dynamic 강제 안 함) |
| 3 | **E2E 모드에선 `useMarketSummary` staleTime=0 / refetchOnMount:'always'** 분기 | hydration 직후 seed(정상)를 무시하고 클라 action 즉시 fetch → stub partial이 **결정적으로** 표시 |
| 4 | E2E stub(`e2eMarketStub`)은 기존대로 **lazy chunk 격리**(prod 메인 번들 제외) | prod 번들 오염 0 |

→ market E2E 스펙은 그대로 통과, prod(non-E2E)는 정적 ISR, E2E build도 prefetch 경로가 동일해 메모리 경고(E2E_TEST env 차이로 인한 cache 무효/동작 분기)를 피한다. **검증은 양쪽 다 prod build로 수행.** briefing/sector signals의 E2E 쿠키 seam도 동일 원칙(정적 prefetch + 클라 action seam)을 적용.

---

## 설계 — 섹션 C: SEO 축2 + route config + 축0

### C-1. `SectorFactsSummary` 서버컴포넌트 신설 (축 2)

`SectorSignalPanel`은 `useSectorSignalState`(`useSearchParams`)로 CSR bailout → SSR HTML이 비어 크롤러가 섹터 신호 텍스트를 못 본다. `[symbol]`의 `TechnicalFactsSummary`와 동일:

- **`widgets/dashboard/SectorFactsSummary.tsx`** (서버컴포넌트) — `getSectorSignalsStatic(DEFAULT_DASHBOARD_TIMEFRAME)`로 default 섹터의 상승/조짐/혼재 신호를 **크롤 가능 텍스트**로 렌더.
- `SectorSignalPanel`의 **Suspense fallback에 배치** → hydration 시 인터랙티브 패널로 교체(중복·cloaking 없음, 텍스트 동일).
- 경량 순수 서버컴포넌트라 widget barrel 노출 가능. 단 정적화 헬퍼(`getSectorSignalsStatic`)는 server-only → barrel 제외, `lib/` deep import(클라 번들 누출 방지).
- `MarketSummaryPanel`(가격)은 `useSearchParams` 미사용 → CSR bailout 아님. SEO 핵심은 섹터 신호 텍스트라 가격은 현행(클라 seed 렌더) 유지.

### C-2. `page.tsx` route config (축 3)

```ts
export const revalidate = 3600; // 1h — ISR (리터럴 강제, MISTAKES §15 예외)
```

- `MarketContent`에서 **`await searchParams` 제거** + searchParams props/파싱(`isDashboardTimeframe`, sector 검증) 전부 제거.
- prefetch: `getMarketSummaryStatic()` + `getSectorSignalsStatic(DEFAULT_DASHBOARD_TIMEFRAME)`.
- `generateStaticParams` **불필요**(정적 라우트).
- 기존 JsonLd(canonical `/market`, ItemList, WebPage, Breadcrumb)는 유지.

### C-3. 축 0 확인

- root layout `cookies()`/`headers()`는 `[symbol]` ISR에서 이미 제거됨. market은 헤더/쿠키 호출이 전부 `submitMarketBriefingAction`(클라 전용)/`getMarketSummaryClientAction`(클라 전용)으로 격리 → **RSC 렌더 경로엔 동적 API 0**. build 시 `DYNAMIC_SERVER_USAGE` 0으로 실증.

---

## 작업 분리 (worktree — 사용자 제약)

두 레포 모두 worktree로 분리해 main 워킹트리를 깨끗이 유지한다. node_modules는 **`cp -al` 하드링크**(symlink 금지 — Turbopack 거부 + dual-React 실패, 메모리 규약), 잔여 `node_modules/node_modules` 제거.

| 레포 | worktree 작업 | 산출물 |
|---|---|---|
| **siglens-core** | `peekBriefingCache` 신설 + export (A-1) | 로컬 `build` → siglens `node_modules/@y0ngha/siglens-core/dist`에 덮어쓰기 (publish는 사용자가 추후) |
| **siglens** | 정적화 헬퍼 3종(A-2), sector signals redis(A-3), action 분리(B-1), 클라 훅 3종(B-2), 소비처(B-3), E2E seam(B-4), `SectorFactsSummary`(C-1), route config(C-2) | ISR 활성화된 `/market` |

> 의존 순서: siglens-core(peekBriefingCache) build·덮어쓰기 **선행** → siglens의 `peekBriefingStatic`/`useMarketBriefing` import가 해결됨. core가 준비되기 전 siglens 측 다른 작업(summary/sector 정적화 등)은 병행 가능.

---

## 테스트 전략 (커버리지 90%+, Happy + Worst Case)

전 변경면 **라인/브랜치 90% 이상**. 각 단위는 Happy Path와 Worst Case를 모두 입증한다.

### core
- **`peekBriefingCache`**: (H) cached hit → normalized briefing 반환 / (W) cache miss → `null`, 잘못된/손상된 캐시 엔트리 → `null`(throw 안 함), `submitBriefing` cached 분기와 키 일치(같은 summary → 같은 키), normalizeMarketBriefing 실패 시 degrade.

### siglens — 데이터 레이어
- **`getCachedSectorSignals`**(redis): (H) miss→fetch→set, hit→redis 값 / (W) 빈 결과(`stocks.length===0`) 미캐싱 가드, redis 부재(null client) → fetcher 직접 호출, redis get/set throw → degrade.
- **`getMarketSummaryStatic`/`getSectorSignalsStatic`/`peekBriefingStatic`**: (H) `unstable_cache` 통과·tag·revalidate 인자 / (W) 0-price/빈 결과 처리(가드 채택 시 throw→캐시 회피), underlying throw 전파/degrade.

### siglens — action / 클라
- **`submitMarketBriefingAction`**: (H) 비봇 → cached/submitted 반환 / (W) `isBot` → `botBlocked:true`, `submitBriefing` throw(worker env 부재) → degrade, E2E force-partial 쿠키 stub 적용.
- **`getMarketSummaryClientAction`**: (H) 일반 → redis summary / (W) E2E force-partial → stub partial, redis 실패 → error 형태.
- **`useMarketSummary`**: (H) seed 사용·1분 후 refetch / (W) E2E staleTime=0 분기로 즉시 stub, hasMissingQuotes(0-price) 안내.
- **`useSectorSignals(tf)`**: (H) default seed·tf 전환 시 refetch / (W) 잘못된 tf 딥링크 → default fallback, fetch 실패 → 빈 결과.
- **`useMarketBriefing`**: (H) peek seed→cached/submitted→poll 교체 / (W) 봇 비노출, poll timeout/error, worker 실패 degrade.

### siglens — UI / 라우트
- **`SectorFactsSummary`**: (H) 신호 텍스트 SSR 렌더 / (W) 빈 신호·default 섹터 없음 → graceful.
- **`page.tsx`**: (H) prefetch seed·`revalidate` export·searchParams 미참조 / (W) 데이터 실패 시 skeleton/안내.
- **`useSectorSignalState`**: (H) `useSectorSignals` 연동·sector/timeframe URL sync / (W) 잘못된 sector·tf, 빈 quadrants.

---

## 검증 전략 (QA + SEO QA + 실증) — `docs/qa/README.md` 준수

### 1. QA 환경 셋업 (`QA_ENV_SETUP.md`)
docker(Postgres+Redis+SRH) + prod-like 빌드, `.env.local` 전환·원복, **prod DB 미접촉**, 워크트리 node_modules 주의.

### 2. ISR Build + Curl 실증 (`EMPIRICAL_VERIFICATION.md` · `RELEASE_VERIFICATION.md`, `src/app/CLAUDE.md` ⚠️)
- `yarn build > build.log 2>&1; echo $?` — **파이프 없이 exit code 직접 캡처**(메모리 규약). output에서 `/market`이 ISR(`●`/SSG)로 표시되는지.
- `yarn start` 후 **`curl -I /market`로 2회차 `x-nextjs-cache: HIT`** 확인.
- 런타임 로그 **`DYNAMIC_SERVER_USAGE` 0건** — 정적 생성 성공 실증.
- `?timeframe=1Week` 딥링크: 클라 fetch 동작 + SSR HTML엔 default tf `SectorFactsSummary` 텍스트가 박힘 확인.

### 3. SEO QA — curl + chrome (사용자 강조)
- **curl `/market`**(JS 미실행 크롤러 시뮬레이션): SSR HTML에 ① `SectorFactsSummary` 섹터 신호 텍스트 존재 ② `<title>`/`description`/`keywords` ③ JSON-LD(WebPage·Breadcrumb·ItemList) ④ `<h1>` ⑤ `canonical=/market`, **noindex 없음**.
- **chrome 도구**(렌더 후): 메타/구조 정상, 콘솔 에러 0, `?sector=`/`?timeframe=` 변형이 canonical `/market`으로 통합되는지, Lighthouse SEO 점수 회귀 없음.

### 4. 페이지 정상 동작 QA (`MULTI_ENV_TESTING.md` · `E2E.md`)
Chrome/Safari × Desktop/Mobile에서 가격·섹터신호·briefing 렌더, tf/sector 전환, **market E2E 스펙(force-partial 쿠키) 통과**. `--no-verify` 금지(pre-push full gate = CI).

---

## 리스크 / 미해결

- **0-price stale**(A 리스크): 가드 추가 여부는 plan에서 결정. 기본은 redis 가드 의존 + 클라 실시간 덮기, 필요 시 unstable_cache throw 가드.
- **core 키 일치**: `peekBriefingCache`가 `submitBriefing`의 cached 키와 정확히 일치해야 peek HIT. core 내부 키 생성 로직 공유로 보장, core 단위 테스트로 입증.
- **E2E 타이밍**: 원칙 3(staleTime=0 분기)이 hydration 직후 결정적 refetch를 보장하는지 실측 필요.
- **briefing peek 키 hash 비용**: summary quote hash를 unstable_cache 키로 쓰면 매 요청 hash. 경량이나 plan에서 확인.
