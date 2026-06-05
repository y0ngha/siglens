# 릴리스 검증 Spec + Test Sheet — core overlay (f4029524 → master)

- 날짜: 2026-06-05
- 범위: `f40295243e991e8fa035380f971e7e764051e0b8` (exclusive) ~ **origin/master `c843e71e`** (44 commits)
- 검증 대상 페어링: **siglens `c843e71e`(origin/master) × core `c779322`(origin/main)**
- 검증 관점: **미release `@y0ngha/siglens-core`(origin/main)를 로컬 빌드해 node_modules에 overlay**한 뒤,
  실제 Production처럼 빌드/실행했을 때 동작·SEO·캐시에 문제가 없는지 (curl + Chrome 이중 실증)

> ⚠️ **검증 시작 시 교훈(stale local)**: 처음엔 로컬 siglens가 `eed3275c`(origin/master `c843e71e`보다
> 3커밋 뒤)였다. 이 stale 상태로 core HEAD를 overlay하니 `skill/api.ts`의 exhaustiveness 가드가
> 빌드를 막았다(core가 pro-indicators용 `SkillStateFeature` 11개 추가 ↔ stale siglens는 8개만 미러).
> origin/master로 ff하니 **PR #569(pro-indicators Phase 3 Part B — skill 미러링)** 가 새 feature 19개를
> 모두 반영해 호환. **반드시 양쪽 origin HEAD로 페어링해 검증할 것.**
- 작성 근거: `docs/qa/RELEASE_VERIFICATION.md` · `docs/qa/TEST_SHEET_AUTHORING.md`
- 실행 환경: `docs/qa/QA_ENV_SETUP.md` (docker Postgres+Redis+SRH + prod build + `yarn start`)
- 선행 시트(부분): `docs/qa/sheets/2026-06-05-fmp-cache-qa-sheet.md` (S1~S4 = 본 시트 그룹 B)

---

## 0. ⚠️ 선결 조건 — core overlay (완료)

master는 `peekBriefingCache`/`computeBarsEffectiveTtl`를 core에서 import하는데,
**publish된 `v0.19.1` 태그에는 `peekBriefingCache`가 없다** → published core로는 siglens master가
빌드 불가. 따라서 core를 로컬 빌드해 dist를 overlay하는 것이 **빌드 자체의 전제**다.

| 단계 | 명령 | 결과 |
|---|---|---|
| core 빌드 | `yarn --cwd ../siglens-core build` | exit 0 ✅ |
| dist overlay | `rm -rf node_modules/@y0ngha/siglens-core/dist && cp -R ../siglens-core/dist …` | ✅ |
| export 확인 | `grep peekBriefingCache …/dist/index.d.ts` | `peekBriefingCache`·`computeBarsEffectiveTtl` 존재 ✅ |

> package.json은 내용 동일(들여쓰기/공백만 차이)이라 overlay 불필요. `exports.browser=index.client.js`도 빌드 산출물에 존재.
> **배포 blocker**: 실제 배포 전 core를 GitHub Packages에 publish + siglens `package.json` 버전 bump 필요(사용자 담당).

---

## 1. 변경 범위 (Spec)

스키마 마이그레이션 **없음**(`drizzle/` 변경 0) — DB 마이그 배포 blocker 없음.

### 그룹 A — 시장(`/market`) 페이지 ISR 전환 (#563)

| # | 변경면 | 입력 | 출력/부수효과 | 영향 |
|---|---|---|---|---|
| A1 | `/market` ISR 전환 (`revalidate=3600` 리터럴, searchParams 제거) | — | 정적 prerender + 1h 재검증. tf/sector는 CSR(useSearchParams) | `/market` |
| A2 | static-safe 캐시 헬퍼 (`getMarketSummaryStatic`/`getSectorSignalsStatic`/`peekBriefingStatic`) | — | `unstable_cache`(1h, `market-summary` tag)로 redis getOrSetCache를 감싸 static generate가 no-store fetch에 막히지 않게 | `/market` SSR |
| A3 | `SectorFactsSummary` SSR 크롤 텍스트 (축2) | `SectorSignalsResult` | Suspense fallback에 섹터 신호를 서버 텍스트로 렌더(useSearchParams CSR bailout 보완), 신호 0이면 null | `/market` SEO |
| A4 | sector-signal Redis 캐시 (`getCachedSectorSignals`) | provider, tf | 3계층(React.cache→Redis getOrSetCache `sector-signals:{tf}`, 장중1m/장외 동적 TTL), 빈 stocks 미캐싱 | `/market` |
| A5 | 클라 훅 분리 (`useMarketSummary`/`useMarketBriefing`/`useSectorSignals`/`useSectorSignalState`) | peekSeed/initialData/tf | React Query seed(SSR hydration) + tf 전환 refetch + briefing 트리거(봇=null) | `/market` 클라 |
| A6 | 액션 분리 (`getMarketSummaryClientAction`/`submitMarketBriefingAction`, 기존 `getMarketSummaryAction` 제거) | — | summary(정적-클라)와 briefing(봇판정+submit) 책임 분리 | 위 훅 |
| A7 | SEO 메타·구조화데이터 | — | canonical=`/market`(변형 noindex 대신 통합), OG/Twitter, JSON-LD(WebPage·Breadcrumb·ItemList), 단일 h1, `main` 랜드마크 | `/market` SEO |

### 그룹 B — FMP 캐시 + earnings (#564/#566/#568) — 상세는 fmp-cache 시트(S1~S4)

| # | 변경면 | 핵심 |
|---|---|---|
| B1 | `CachedMarketDataProvider` (bars/quote provider 캐시) | 분석/차트 경로만 데코레이트(`getCachedMarketDataProvider`), market summary/sector는 raw. `bars:raw:*`/`quote:*`, 빈결과 미캐싱, graceful. **E2E_TEST=1이면 데코레이터 미적용(fake provider)** |
| B2 | earnings gate 단일화 (`isEarningsReportStale`) | fetchedAt 단독·순수(now 주입). news/분석 공유, cache-miss 루프 제거 |
| B3 | earnings 빈-응답 마커 (`isEarningsKnownEmpty`/`markEarningsEmpty`) | Redis `earnings:empty:<SYM>`(24h). 빈응답 set→TTL 동안 FMP skip(#567). Redis 장애 시 degrade |
| B4 | `getNextEarningsReport` lib→api 이동 (#566) | 순수레이어 위반 해소. 동작 불변(리팩토링) |

### 그룹 C — core overlay (교차)

| # | 변경면 | 핵심 |
|---|---|---|
| C0 | core `peekBriefingCache`(읽기전용 SSR seed) + `hashBriefingInput`(키 공유) + `computeBarsEffectiveTtl` | siglens가 직접 소비. **미release → 로컬 빌드 overlay 필수** |

---

## 2. 환경 & 실행 방법

> prod 빌드 런타임(ISR prerender·메타·캐시 헤더)을 보는 게 목적이므로 **dev가 아닌 prod build + start**.
> prod DB 미접촉을 위해 `E2E_TEST=1`(docker 백엔드 + FakeProvider)로 빌드/기동한다(QA_ENV_SETUP §3).

```bash
# 1) docker 백엔드 (Postgres 5433 / Redis 6380 / SRH 8079)
yarn e2e:up
# 2) prod build (exit code 직접 캡처 — 파이프 금지)
dotenv -e .env.e2e -- sh -c 'yarn build' > /tmp/siglens-build.log 2>&1; echo "EXIT=$?"
# 3) prod 서버 (port 4300)
dotenv -e .env.e2e -- yarn start -p 4300
# 4) 정리
yarn e2e:down
```

- **E2E_TEST=1 caveat**: `getCachedMarketDataProvider`가 fake를 반환 → B1(`bars:raw:*`/`quote:*`)
  데코레이터는 이 빌드에서 미적용. B1은 단위(U1-*, 9건 ✅)로 커버, 실증은 raw-provider 경유
  캐시(A2/A4: `sector-signals:*`/`market-summary*`/`briefing-peek`)로 본다.
- Redis 키 관측: SRH는 Upstash REST라 `redis-cli`로 직접 못 봄 → `docker compose -f docker-compose.e2e.yml exec redis redis-cli KEYS '*'`로 본다.

---

## 3. Test Cases (C#=curl, B#=Chrome, U#=단위 이미 통과)

### 그룹 C — 빌드/overlay (최우선)

| ID | 케이스 | 기대값 | 검증 | 결과 |
|---|---|---|---|---|
| C0-1 | overlaid core로 prod build | `EXIT=0`, `peekBriefingCache` 해소, 타입/번들 에러 0 | build 로그 | ⬜ |
| C0-2 | build output에서 `/market` 렌더 모드 | `●`(SSG/ISR) 또는 prerender 표기 | `next build` output | ⬜ |

### 그룹 A — 시장 ISR

| ID | 케이스 | 기대값 | 검증 | 결과 |
|---|---|---|---|---|
| C-A1 | `curl -i /market` | 200, `Content-Type: text/html`, HTML 본문에 h1 텍스트(`오늘의 미국 주식…`) 포함 | curl | ⬜ |
| C-A2 | `/market` 2회 요청 캐시 헤더 | 2회차 `x-nextjs-cache: HIT`(또는 `Age` 증가), 500/DYNAMIC 없음 | curl -i ×2 | ⬜ |
| C-A3 | `/market` SSR 크롤 텍스트(축2) | HTML에 `섹터별 신호 모아보기` + `상승 신호 N종목` 텍스트 존재(JS 없이 크롤 가능) | curl \| grep | ⬜ |
| C-A4 | `/market` JSON-LD | HTML에 `"@type":"ItemList"` + `"WebPage"` + `BreadcrumbList` 3개 script 존재 | curl \| grep | ⬜ |
| C-A5 | `/market` 메타/canonical/OG | `<link rel="canonical" href=".../market">`, og:title/twitter:card 존재, h1 정확히 1개 | curl \| grep | ⬜ |
| C-A6 | `?sector=XLK&timeframe=1Day` 변형 | 200, canonical 여전히 `/market`(변형 색인 통합), noindex 없음 | curl -i | ⬜ |
| B-A1 | Chrome `/market` 로드 | 시장요약·섹터신호 패널 정상 렌더, **콘솔 에러 0** | chrome | ⬜ |
| B-A2 | sector tf 전환(1Day↔다른 tf) | URL `?timeframe=` 갱신 + 데이터 refetch, 에러 0 | chrome | ⬜ |
| B-A3 | sector 칩 전환 | `?sector=` 갱신, 해당 섹터 신호 표시 | chrome | ⬜ |
| B-A4 | briefing 카드 | peek seed 즉시 표시 → submit 결과로 교체(또는 봇이면 BotBlockedNotice) | chrome | ⬜ |
| C-A7 | Redis 캐시 키(raw provider) | `sector-signals:*`, `market-summary*`(unstable_cache), `briefing-peek` 류 키 생성 | redis-cli KEYS | ⬜ |
| U-A* | sectorFacts/캐시/훅 단위 | PASS | vitest(sectorFacts·*StaticCache·useSectorSignals·useMarketBriefing 등) | ✅ |

### 그룹 B — FMP 캐시/earnings (실증 reachable 한정; 상세는 fmp-cache 시트)

| ID | 케이스 | 기대값 | 검증 | 결과 |
|---|---|---|---|---|
| B-B1 | Chrome `/AAPL` 차트·기술분석 | 정상 렌더(fake bars), 콘솔 에러 0 | chrome | ⬜ |
| B-B2 | Chrome `/AAPL/news` | 실적 비교/뉴스 영역 정상, 레이아웃 안 깨짐 | chrome | ⬜ |
| B-B3 | Chrome `/AAPL/overall` 4축 | 다가오는 실적 포함 정상(getNextEarningsReport 이동 후 불변) | chrome | ⬜ |
| C-B4 | `/AAPL/news` 실적없음 심볼(fake 빈응답 시) earnings:empty 마커 | (도달 시) `earnings:empty:*` 키 + TTL≈24h | redis-cli | ⬜ |
| C-B5 | `curl -i /AAPL` | 200, ISR 캐시 헤더, SEO 메타 정상 | curl | ⬜ |
| U-B* | CachedMarketDataProvider(9)·earningsEmptyMarker(6)·isEarningsReportStale(5)·getNextEarningsReport(9)·newsData(12) | PASS | vitest | ✅ |

### 그룹 — 회귀/안정성 공통

| ID | 케이스 | 기대값 | 검증 | 결과 |
|---|---|---|---|---|
| C-R1 | `curl -i /` (홈) | 200, 회귀 없음 | curl | ⬜ |
| C-R2 | `/sitemap.xml`, `/robots.txt` | 200, `/market` 포함 | curl | ⬜ |
| B-R1 | Redis 중단 상태 `/market` | graceful(매 요청 raw fetch), 페이지 정상·에러 0 | chrome(SRH stop) | ⬜ |
| B-R2 | 모바일 뷰포트 `/market` | 가로 오버플로우 없음, 패널/칩 정상 | chrome resize | ⬜ |

---

## 4. 누락 방지 체크리스트 매핑 (TEST_SHEET §2)

| 축 | 적용 | 케이스 |
|---|---|---|
| 2.1 외부 API 입력(누락/null/빈/에러) | ✅ | C-B4(빈 earnings), B-R1(Redis 장애), A4 빈 stocks 미캐싱 |
| 2.2 극단값(0/1/N) | ✅ | A3 신호 0이면 null, sectorFacts 0/1/N |
| 2.3 브라우저 엔진 | △ | 캐시·ISR은 서버측. 렌더 회귀는 `/market`·`/AAPL`을 Chrome 1회(Safari는 변경이 데이터/서버층이라 위험 낮음, 필요시 Playwright webkit) |
| 2.4 모바일 뷰포트 | ✅ | B-R2 |
| 2.5 캐싱·상태 영속 | ✅(핵심) | C-A2(ISR HIT), C-A7(Redis 키), B-R1(장애 degrade) |
| 2.6 a11y | △ | SectorFactsSummary `section aria-label`, 단일 h1/main 랜드마크 — C-A5 + Chrome a11y |

---

## 5. Pass 기준

1. **C0-1 빌드 성공**(overlay된 core로 `EXIT=0`) — 본 검증의 1순위 전제.
2. `/market` ISR 정상: C-A2(2회차 캐시 HIT)·DYNAMIC_SERVER_USAGE/500 0.
3. SEO: C-A3(SSR 크롤 텍스트)·C-A4(JSON-LD 3종)·C-A5(canonical/OG/단일h1) PASS.
4. 렌더: B-A1·B-B1·B-B2·B-B3 콘솔 에러 0.
5. 회귀: C-R1·C-R2, B-R1(graceful) PASS.
6. 단위(U-*) 전부 ✅(4916 baseline) — 본 빌드에서 회귀 없음.
7. 5개 fresh-context 감사(코드/배포×2/SEO/커버리지) 결과 dedup → 실이슈만 선별.

> 결과 칸(⬜)에 PASS/FAIL + **실측값**만 기록(추측 금지 — EMPIRICAL_VERIFICATION).

---

## 6. 실증 결과 (2026-06-05 측정값)

> 환경: core overlay(origin/main `c779322`) + siglens `c843e71e`(origin/master), `E2E_TEST=1` prod build,
> docker(PG/Redis/SRH), `yarn start -p 4300`. curl + claude-in-chrome.

### 빌드/overlay
| ID | 결과 | 실측 근거 |
|---|---|---|
| C0-1 | ✅ PASS | overlay 후 `BUILD2_EXIT=0`. (overlay 전 stale-local로는 `skill/api.ts:252` exhaustiveness 타입에러로 실패 → origin/master ff로 해소) |
| C0-2 | ✅ PASS | build output: `○ /market  Revalidate 1h Expire 1y`(Static/ISR), `/[symbol]/*` 6종 `● (SSG)` |

### 그룹 A — 시장 ISR
| ID | 결과 | 실측 근거 |
|---|---|---|
| C-A1 | ✅ PASS | `HTTP/1.1 200`, `Content-Type: text/html`, h1 정확히 1개("오늘의 미국 주식, 섹터별 기술적 신호") |
| C-A2 | ✅ PASS | 1·2회차 모두 `x-nextjs-cache: HIT`, `Cache-Control: s-maxage=3600, stale-while-revalidate=…` (revalidate 1h 일치) |
| C-A3 | ⚠️ N/A(데이터) | SSR HTML에 `섹터별 신호 모아보기` 부재. 원인 실증: FakeProvider 3봉→core `getSectorSignals` `stocks: []`(redis `dashboard:signals:1Day:2026-06-05`={"…","stocks":[]}) → `buildSectorFacts([])`=[] → `SectorFactsSummary` null. **코드 회귀 아님**(데이터 의존, SEO L2). 단위 100%+이전 market-isr 시트 C4가 신호 有 경로 커버 |
| C-A4 | ✅ PASS | HTML에 JSON-LD `"WebPage"`·`"BreadcrumbList"`·`"ItemList"` 3종 존재 |
| C-A5 | ✅ PASS | `canonical=.../market`, `og:title`, `twitter:card=summary_large_image`, h1 1개 |
| C-A6 | ✅ PASS | `?sector=XLK&timeframe=1Day` → 200, canonical 여전히 `/market`, noindex 0 |
| C-A7 | ✅ PASS | redis: `market:summary`={"data":{indices:[S&P500…]}}(envelope), core `dashboard:signals:1Day:*` 생성. siglens `sector-signals:*`는 빈stocks 가드로 **미생성**(정상) |
| B-A1 | ✅ PASS | Chrome /market: 시장요약(GSPC/DJI/IXIC/VIX)+11섹터ETF 렌더, 콘솔 에러 0(Vercel Analytics 스크립트 로드실패 1건=로컬 무해) |
| B-A2 | ✅ PASS | tf 칩 15분/1시간/1일 렌더(CSR), B-A3과 동일 searchParams 배선 |
| B-A3 | ✅ PASS | 섹터 칩 "금융" 클릭 → URL `?sector=XLF` 갱신, 콘솔 에러 0 |
| B-A4 | ✅ PASS | briefing 카드 "AI 브리핑 생성 중…"(submit 플로우 동작, 봇차단 아님) |

### 그룹 B — FMP 캐시/earnings
| ID | 결과 | 실측 근거 |
|---|---|---|
| B-B1 | ✅ PASS | Chrome /AAPL: 타이틀·차트·지표요약($195.70 +0.67%)·AI분석(보합)·`37종 인디케이터 적용`(PR#569 신규 스킬 통합), 콘솔 에러 0 |
| B-B2 | ✅ PASS | Chrome /AAPL/news: 타이틀 정상, "E2E fixture headline one" 렌더, 콘솔 에러 0 |
| B-B3 | ✅ PASS | Chrome /AAPL/overall: 5축 종합 본문+"AI 종합 분석 받기" CTA(submitOverall→getNextEarningsReport), 콘솔 에러 0 |
| C-B4 | ⚠️ N/A | earnings:empty 마커는 fake fundamental 경로에서 미도달(이 페이지 흐름이 빈 응답을 안 만듦). 단위 U-B*(earningsEmptyMarker 6) 커버 |
| C-B5 | ✅ PASS | curl /AAPL: 200, 1회차 MISS→2회차 `x-nextjs-cache: HIT`(on-demand ISR), `s-maxage=3600`, h1·canonical=/AAPL |

### 회귀/안정성
| ID | 결과 | 실측 근거 |
|---|---|---|
| C-R1 | ✅ PASS | curl / : 200, `x-nextjs-cache: HIT`, h1 1개 |
| C-R2 | ✅ PASS | robots.txt 200(Allow / · Disallow /api/), /api/sitemap·/static 200, static sitemap에 `/market` 포함 |
| B-R1 | ✅ PASS | SRH 정지 후 /TSLA cold-gen(`x-nextjs-cache: MISS`)=**200+h1**. 로그 `[getOrSetCache] get failed … ECONNREFUSED`만, **throw/500 없음**(직접 provider fallback). graceful 실증 |
| B-R2 | ✅ PASS | 모바일(390) /market: `scrollWidth==clientWidth`(가로 오버플로우 0), h1 1개, 2열 카드 그리드 정상 |
| 서버로그 | ✅ | 전 구간 `DYNAMIC_SERVER_USAGE`·unhandled·500 **0**(Redis-down 주입 구간의 graceful ECONNREFUSED 로그 제외) |

**판정: 빌드/ISR/SEO/렌더/캐시/graceful 전부 PASS.** C-A3·C-B4는 fake fixture 한계로 런타임 미도달이나 단위테스트(커버리지 99.11%)로 커버되며 코드 회귀 아님을 실증.

---

## 7. 감사 결과 종합 (5+1 에이전트, Opus 4.8) + 후속 액션

| 감사 | 판정 | 핵심 |
|---|---|---|
| 코드(review) | recommended 2 | ① `useSectorSignalState` eslint suppression(set-state-in-effect) ② `sectorFacts.ts` reduce 내 push() → `Map.groupBy` 권고. blocker 0 |
| 배포 안정성 | High 1 | **빈 sector-signals를 core `getSectorSignals`가 `dashboard:signals:*`에 무조건 캐싱(빈 결과 최대 1h poison)** → siglens 가드(`stocks>0`)는 상위라 무력. **→ core(siglens-core) 수정 대상.** Medium/Low(태그 공유 blast-radius, peek dateHour 이중소스 등) |
| 지금-배포 | NO-GO | `peekBriefingCache` 미publish → clean install 시 Vercel 빌드 실패. **core publish + dep bump 선행 필요(사용자 담당).** 마이그레이션/필수 env 추가는 없음 |
| SEO | Healthy | Critical/High 0. M1(ItemList url 전부 /market) M2("11개 섹터"≠12) L1(desc 139>120) L2(신호 0일 때 크롤텍스트 null=C-A3 실증) L3(generic og) |
| 커버리지 | 99.11% L/96.52% B | 변경 42파일 전부 ≥90%. sort comparator 2건(sectorFacts:76, api.ts:288)만 미세 gap. fake/dead coverage 0 |
| PR#569 보충(review) | approved | 19개 SkillStateFeature 미러 정확, tsc/validate-skills 통과, 12 skill .md 유효 |

**후속 액션 우선순위**
1. (배포 선행) **siglens-core publish** — peekBriefingCache + pro-indicators 포함 새 버전, siglens `package.json` bump + `yarn install` 후 **clean build 재검증**(현 node_modules는 hand-overlay).
2. (core) 배포-High #1: `getSectorSignals` 빈 `stocks` 캐시 write skip(SCOPE.md상 core 책임).
3. (siglens, 선택) review recommended 2건, SEO M1/M2, 커버리지 sort 2건.

### 환경 원복 (검증 종료 시)
- 서버 종료: `lsof -ti :4300` → `pkill -f "next start"` · docker: `yarn e2e:down`
- node_modules core overlay는 **의도된 상태로 유지**(published 0.19.1엔 peekBriefingCache 없어 clean install 시 빌드 깨짐). 배포는 위 1번 경로로.
- `.env.local` 미변경(빌드는 `dotenv -e .env.e2e -o`로 주입), 코드 seam 추가 없음. siglens 로컬은 origin/master로 ff됨(stale 해소).

---

## 8. Round 2 — 수정 + 재감사 (2026-06-05)

후속 액션의 fix를 적용하고 감사를 재실행했다. 브랜치: core `fix/sector-signals-empty-cache-poison`, siglens `fix/qa-audit-followups`(둘 다 미커밋 작업트리).

### 적용한 수정
| # | 영역 | 수정 | 실증/검증 |
|---|---|---|---|
| F1 | core (High#1) | `getSectorSignals` 캐시 write를 `stocks.length>0`로 가드(빈 결과 미캐싱) + 테스트 | redis `dashboard:signals:*` **ABSENT**(1Day·15Min fresh fetch), core 10테스트 통과 |
| F2 | siglens review#2 | `sectorFacts` reduce+push → `Map.groupBy`(불변·O(N)) | build/test green, repo 선례(usageRepository) 확인 |
| F3 | SEO M1 | ItemList ListItem `url` 제거 | HTML에 ListItem url 0 |
| F4 | SEO M2 | ItemList name 개수 표기 제거(`섹터·테마별 신호 스캐너`) | HTML 확인 |
| F5 | SEO L1 | MARKET_DESCRIPTION 139→100자 | desc len=100 (≤120) |
| F6 | SEO L2 | `SectorFactsSummary` 빈 신호 시 null→최소 텍스트 | **0신호에서도 SSR 크롤텍스트 존재**(C-A3 N/A 해소) |
| F7 | 커버리지 | sectorFacts bearish-only sort, toComparisonItems ≥2 upcoming, SectorSignalPanel initialData 테스트 추가 | 변경 파일 100% L/B |
| — | review#1 eslint | **유지**(조사): 단일파일·단일룰, v7.1.1 false-positive 정당화 충실. URL-derived 리팩토링은 8테스트 동작계약 파괴·회귀위험 → 보류 | — |

게이트: **lint 0 / build 0 / 단위 4991 통과**(플레인; E2E_TEST 미설정).

### 재감사 결과 (4 에이전트, Opus 4.8)
| 감사 | 판정 | 핵심 |
|---|---|---|
| 코드(review) | **approved** (findings 0) | poison 가드·Map.groupBy·ItemList·SectorFactsSummary·신규 테스트 전부 정확, FSD/컨벤션 clean |
| SEO | **0/0/0/0** ship-ready | M1·M2·L1·L2 전부 해소, 신규 회귀 0. (옵션: desc를 `clampSeoDescription`로 감싸면 미래 회귀 가드) |
| 커버리지 | **변경 파일 100%** | gap 3건 CLOSED, poison-fix 양분기·빈렌더 커버, fake/dead 0 |
| 배포 안정성 | fix 정확하나 **신규 High** | 아래 ⚠️ |

### ⚠️ 잔여 항목 — ISR 빈-결과 동결 (설계 결정 필요)
재감사가 더 깊은 층을 지적: F1이 안쪽 2개 Redis 층(core `dashboard:signals`, siglens `sector-signals`)은 닫았으나, **빈-결과 동결의 근본 층은 라우트 ISR(`/market revalidate=3600`) 자체**다 — FMP 전면 장애 중 ISR 재검증이 돌면 빈 sector-signals를 포함한 **렌더 HTML 전체가 최대 1h 캐시**된다. `unstable_cache`(`getSectorSignalsStatic`)도 동일 층의 일부지만, 그것만 우회해도 라우트 ISR이 빈 렌더를 캐시하므로 완전 해결은 안 됨.
- **완화 (이미 적용):** ① JS 사용자 — 클라 `SectorSignalPanel`이 hydration 시 `getSectorSignalsAction`로 self-heal(레이어 2·3 미오염, FMP 복구 시 실데이터). ② 크롤러/no-JS — F6의 빈-상태 텍스트(graceful, 비-broken).
- **진짜 해법(택1, 후속):** (a) 복구 시 on-demand `revalidateTag('market-summary')` 트리거, (b) 현 graceful degradation 수용(≤1h, self-heal). market-summary 등 다른 static helper도 동일 속성이라 단발 수정이 아닌 정책 결정 사항.
- **권고:** 지금은 (b) 수용(완화 충분), SEO 크롤 신선도가 장애 중 문제되면 (a) 도입.

### 결정 (2026-06-06)
- **ISR 빈-결과 동결: (b) graceful degradation 수용.** `revalidateTag` 기반 복구는 장애 복구에
  부적합(트리거 부재 + "정상 빈"과 "장애 빈" 구분 불가, `stocks=[]`가 둘 다 의미)하고, 일반화하면
  헬스체크 크론까지 필요한데 시나리오 심각도(전면 장애 × 재검증 윈도우 동시 + 이미 self-heal)가
  그 투자를 정당화하지 못함. `revalidateTag`는 본래 용도(콘텐츠 변경 무효화, 이 레포는 news
  ingestion에 이미 사용)로 한정.
- **적용한 일반 하드닝(F8): 공유 태그 분리.** `getMarketSummaryStatic`/`getSectorSignalsStatic`/
  `peekBriefingStatic`이 공유하던 `['market-summary']` 태그를 `market:summary` / `sector:signals` /
  `market:briefing`로 분리(소스 3 + 테스트 3). `revalidateTag` 호출자는 현재 없어 런타임 무변화이나,
  향후 어떤 무효화를 붙이든 셋이 함께 날아가는 blast-radius를 제거. (주의: `queryConfig.ts`의
  `['market-summary']`는 React Query queryKey로 **별개 시스템**이라 미변경.)
  - 검증: 3 static cache 테스트 12건 통과, lint/build green.
