# `[symbol]` ISR + SEO 전면 활성화 — 설계

- 날짜: 2026-06-02
- 상태: 설계 승인됨, 구현 대기
- 관련: PR #543(ISR 도입), PR #545(getAssetInfoResilient), 이슈 #439(PPR 비활성)

## 배경 / 문제 (디버깅으로 확정)

PR #543이 `[symbol]` 6라우트(page/news/fundamental/options/overall/fear-greed)에 ISR(`generateStaticParams=[]` + `revalidate=3600`)을 도입했다. 그러나 `[symbol]`은 redis(`@upstash/redis` HTTP = no-store fetch)를 RSC에서 광범위하게 await한다:

- `getAssetInfo` cache(`createCacheProvider`), `peekAnalysisCache`/`peekOverallAnalysisCache`
- bars: `getBarsAction` → `getOrSetCache`(redis)
- 외부 API: `getProfile`/`getProfileDescriptionKo`, `hasOptionsMarket`/`fetchOptionsSnapshot`, `getNewsList`/earnings/grades, 펀더멘털 metrics/ratios/peers/...

ISR static generate가 no-store fetch(dynamic data)를 만나 `DYNAMIC_SERVER_USAGE`를 throw → 동적 폴백이 깨지며 **런타임 HTTP 500**. 실측: 일반 prod `build && start`(E2E_TEST 없이) `/AAPL` = 500, `DYNAMIC_SERVER_USAGE` 14회. 빌드 output은 `●`(ISR)로 표시되지만 런타임 동작이 다르다.

이 하나의 뿌리가 ① prod `[symbol]` 500 ② E2E 17 실패 ③ E2E 속도 저하(`DYNAMIC_SERVER_USAGE` 207회 재시도)를 모두 유발한다.

### SEO 관련 추가 확정

- `TechnicalFactsSummary`("FactLayer")는 bars/indicators 기반 종목별 실측 지표 텍스트(현재가/RSI 과매수·과매도/MACD/추세)를 **크롤 가능한 텍스트로 노출**하려는 의도(주석 명시). 분석(`AnalysisPanel`, peek)도 동일.
- 그러나 `ChartContent`/`OverallContent`가 `useSearchParams`(timeframe)로 **CSR bailout** → 현재 FactLayer가 **SSR HTML에 안 들어간다**(실측: `기술적 지표 요약`/`현재가` 0, `aria-hidden` fallback만 SSR). 즉 FactLayer SEO 의도가 현재 미실현.
- 현재 SSR SEO는 메타(title/description/keywords) + JSON-LD(assetInfo 기반 정적)에 의존.

## 목표

1. **ISR 활성화 + 모든 오류 처리**: E2E 느림/실패, 런타임 500, ISR static→동적 전환 충돌을 전부 제거. `[symbol]`이 정상 ISR 캐시되어 vercel transfer cost를 줄인다.
2. **ISR 후 SEO 콘텐츠를 SSR HTML에 모두 채움**: FactLayer(bars/peek 기반 실측 텍스트)를 SSR HTML에 박아 크롤러(JS 미실행 봇 포함)가 보게 한다. `prod build && start`로 요청 시 값이 보여야 한다.
3. **SEO 무손상**: ISR 활성화로 canonical/메타가 깨지지 않는다(특히 `[SYMBOL]` placeholder 누출 없음).

## 검증 기준 (사용자 제약)

- 1·2 모두 **실측**으로 확인 — 오류 없이 렌더링됨을 증명.
- 테스트는 **Happy Path + Worst Case** 모두 입증.
- **E2E + Integration(vitest)** 테스트를 필요 시 추가.
- **변경된 파일은 90%+ 테스트 커버리지**.

## 비목표

- PPR(`cacheComponents`) 재활성은 하지 않는다(이슈 #439 — PPR이 dynamic route를 fake-params로 prerender → generateMetadata가 `[SYMBOL]` placeholder canonical 생성). **접근 A는 PPR을 켜지 않으므로 이 메커니즘 자체가 없다.**
- core(`@y0ngha/siglens-core`)의 분석/캐시 로직 변경. peek 함수 자체는 core이며, 본 작업은 siglens app 레이어의 **호출/캐싱/렌더 전략**만 바꾼다.

## 아키텍처 — 3축

### 축 1. 데이터 정적화

동적 호출을 ISR static-safe하게 만들어 static generate가 데이터를 HTML에 박고 정적 캐시하게 한다.

- **1차 방식(A)**: 각 동적 호출을 `unstable_cache(fn, [keyParts], { revalidate: 3600, tags: [`symbol:${SYMBOL}`] })` 래퍼로 감싼다. (legacy data cache — `cacheComponents` 없이 동작)
- **핵심 리스크 / PoC**: `unstable_cache`가 내부의 redis(`@upstash` no-store fetch)를 정적화하는지 불확실하다. **Phase 0의 첫 task를 PoC(실측)로 잡는다.**
  - PoC 성공(unstable_cache가 redis 호출을 정적화) → 방식 A로 전 라우트 진행.
  - PoC 실패 → **대안 B**: ISR 페이지에선 redis cache를 우회하고 source(FMP/DB)를 `fetch(url, { next: { revalidate } })`(Next 데이터 캐시)로 직접 가져온다. ISR이 그 fetch를 캐시한다. (redis는 런타임 cross-request 캐시로, ISR 페이지엔 ISR 자체가 캐시 역할이므로 중복.)
- PoC 결과가 전체 구현 방식을 확정한다. 둘 중 무엇이든 인터페이스는 동일한 정적화 헬퍼로 캡슐화해 호출부는 방식에 무관하게 한다.

### 축 2. FactLayer SSR 분리 (CSR bailout 해결)

`timeframe`(useSearchParams)을 FactLayer에서 떼어낸다.

- **FactLayer**(`TechnicalFactsSummary` + 분석 fact 텍스트): page RSC에서 **default-tf bars(정적화)** 로 **서버 렌더 → SSR HTML**. SEO 텍스트가 크롤러에 보인다.
- **인터랙티브**(timeframe 변경·차트 시각화·재분석 트리거): `ChartContent`(클라, useSearchParams) 유지.
- 대상: page(차트), overall — `useSearchParams` 사용처. fear-greed/options/fundamental/news는 CSR bailout이 없어 **데이터 정적화만으로 SSR** 된다.
- 원칙: FactLayer는 timeframe·검색 파라미터·쿠키 등 요청별 동적 입력에 의존하지 않는 default 뷰만 렌더한다(그래야 static generate 가능 + 종목당 캐시).

### 축 3. ISR 활성화 + SEO 무손상

- `generateStaticParams=[]` + `revalidate=3600`(리터럴) 유지. 축1·2로 static generate가 성공 → `500`/`DYNAMIC_SERVER_USAGE`/동적전환 제거.
- SEO 무손상 필수 조건:
  - `symbol-metadata.test`(canonical 회귀 가드 — `[SYMBOL]` placeholder 누출 검증) 통과.
  - 실측: `prod build && start` → `/AAPL` 200 + SSR HTML에 FactLayer 텍스트 + canonical이 실제 ticker.

## Phase (끝까지)

### Phase 0 — 인프라
1. **PoC(실측)**: 단일 동적 호출(예: bars)을 `unstable_cache`로 감싸 `[symbol]`을 ISR로 빌드+start → `/AAPL`이 200 + `DYNAMIC_SERVER_USAGE` 0 + `x-nextjs-cache` HIT인지 확인. 실패 시 대안 B로 전환 확정.
2. **정적화 헬퍼**: 확정된 방식을 `entities`/`shared`의 캐시 래퍼로 캡슐화(revalidate/tag 규약 포함).
3. **FactLayer 서버 분리 패턴**: `TechnicalFactsSummary`를 `useSearchParams` 밖 서버 렌더로 올리는 컴포넌트 경계 재배치 패턴 확립(default-tf bars 정적화 사용).

### Phase 1 — 차트 page (대표, 패턴 확립)
`app/[symbol]/page.tsx` + `layout.tsx` + `widgets/symbol-page`:
- assetInfo/bars/peek/skillCounts 정적화.
- FactLayer를 SSR로 분리(default-tf), ChartContent는 클라 유지.
- 실측(200 + FactLayer HTML + ISR HIT) + Happy/Worst 테스트.

### Phase 2 — 나머지 5라우트 (의존 단순 순)
2a. **overall** — assetInfo/peekOverall/bars 정적화 + 종합 fact SSR 분리(tf).
2b. **fear-greed** — assetInfo/bars 정적화(CSR bailout 없음).
2c. **options** — assetInfo/hasOptions/snapshot 정적화.
2d. **fundamental** — assetInfo + profile/metrics/ratios/peers/growth/health/future 정적화. 서버 섹션(이미 Suspense SSR)이라 데이터 정적화 위주.
2e. **news** — assetInfo/newsList/earnings/grades 정적화. `newsListJsonLd`(SEO 구조화) + 뉴스 요약 SSR.

### Phase 3 — SEO 감사 (구현 후)
`seo-audit` 스킬로 작업된 6라우트 전체 SEO를 감사하고 발견된 이슈를 수정한다. FactLayer SSR 전환으로 SEO 표면(크롤 가능 콘텐츠·h1 위계·구조화 데이터·메타/canonical)이 바뀌었으므로 종합 점검이 필요하다. 감사 결과 수정도 Happy/Worst 테스트 + 실측으로 검증한다.

### Phase 4 — 문서화 (구현 후)
ISR 설계를 프로젝트 문서에 반영한다:
- `src/app/CLAUDE.md`의 ISR/Route Segment Config 섹션 — `[symbol]` ISR이 redis 등 dynamic data와 충돌하지 않으려면 정적화 래퍼(축 1)를 거쳐야 한다는 규약, FactLayer를 `useSearchParams` 밖 서버 컴포넌트로 두는 패턴(축 2), "빌드 `●` 표시 ≠ 런타임 동작 — 런타임 `DYNAMIC_SERVER_USAGE` 확인" 교훈을 추가.
- 필요 시 `docs/ARCHITECTURE.md` 등 관련 문서에 ISR 데이터 흐름 반영.

각 Phase는 독립적으로 동작·실측·테스트 통과한다.

## 라우트별 작업 표

| 라우트 | 정적화 대상 | SSR SEO 콘텐츠 | CSR bailout 분리 |
|---|---|---|---|
| page | assetInfo, bars, peek, skillCounts | `TechnicalFactsSummary`(bars), 분석 fact(peek) | FactLayer를 tf 밖 서버로 |
| overall | assetInfo, peekOverall, bars | 종합 fact | 동상(tf 분리) |
| fear-greed | assetInfo, bars | FactLayer | 불필요 |
| options | assetInfo, hasOptions, snapshot | 옵션 요약 fact | 불필요 |
| fundamental | assetInfo, profile, metrics, ratios, peers, growth, health, future | 서버 섹션(이미 SSR) | 불필요 |
| news | assetInfo, newsList, earnings, grades | `newsListJsonLd` + 뉴스 요약 | 불필요 |

## 테스트 전략

- **Happy Path**: 정적화 cache hit → FactLayer/섹션 SSR 정상 렌더, canonical 정상.
- **Worst Case**:
  - 정적화 source 실패/빈 결과 → degrade(FactLayer 빈/null 시 렌더 안 깨짐, 페이지는 200).
  - bars 없음 → `buildTechnicalFacts` null → FactLayer 미렌더(크래시 없음).
  - peek MISS → 분석 fact 폴백.
  - 인프라 실패(getAssetInfo) → PR #545 `getAssetInfoResilient` 경로와 정합(인프라 실패 fallback + degraded noindex; `DYNAMIC_SERVER_USAGE`는 rethrow).
- **Integration(vitest)**: 각 page RSC를 호출해 반환 트리에 FactLayer/SSR 섹션이 정적화 데이터로 렌더되는지(=SSR HTML에 박히는지) 검증.
- **E2E**: prod build로 `[symbol]` 200 + SSR HTML에 FactLayer 텍스트 존재 + `x-nextjs-cache` 정적 HIT + 23 spec 통과 + 속도 회복(이전 `DYNAMIC_SERVER_USAGE` 폭주 제거).
- **커버리지**: 변경 파일 90%+.

## 실측 검증 (필수 통과 조건)

```
rm -rf .next && yarn build && yarn start
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL   # 200
grep -c "DYNAMIC_SERVER_USAGE" <start log>                          # 0
curl -s http://localhost:3000/AAPL | grep "기술적 지표 요약\|현재가"   # FactLayer 존재
curl -sI http://localhost:3000/AAPL | grep -i x-nextjs-cache         # ISR 캐시
```

## 미해결 / 구현 시 결정

- Phase 0 PoC 결과(unstable_cache vs source-direct fetch) — 전체 방식 확정.
- FactLayer 서버 분리 시 컴포넌트 경계(어디까지 서버 vs 클라) 정밀 배치 — Phase 1에서 확정 후 Phase 2에 적용.
- PR #545 머지 순서: 본 작업은 `getAssetInfoResilient`를 전제로 하므로, PR #545 머지 후 master 기반으로 rebase하거나 그 위에서 진행한다.
