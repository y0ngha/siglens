# SSR 콘텐츠 주입 — chart·overall 종목 페이지 thin-content 해소

- **작성일**: 2026-05-29
- **상태**: Design (사용자 리뷰 대기)
- **유형**: SEO / 렌더 전략 (siglens) + 읽기 전용 캐시 getter (siglens-core)

---

## 1. 배경 & 문제

종목 페이지 6개 탭 중 서버에서 실제 고유 콘텐츠를 SSR하는 건 `fundamental`(회사 설명·PER·ROE·peers)과 `news`(뉴스 리스트·어닝·등급 변경)뿐이다. 나머지는 봇에게 thin/templated content로 노출된다:

- **chart (`[symbol]`)**: AI 분석을 `initialAnalysisFailed={true}` + `FALLBACK_ANALYSIS`로 클라이언트 마운트 후에만 트리거. 봇이 받는 SSR HTML은 템플릿 `sr-only` 문단 + 빈 차트 canvas뿐.
- **overall (`[symbol]/overall`)**: `OverallContent`가 전부 클라이언트 fetch. 서버는 `getAssetInfoCached`만 await. 봇은 템플릿 가이드 텍스트만 봄.

AI 분석 캐시는 존재하고 `submitAnalysis`가 HIT 시 즉시 반환하지만, 그 호출이 **클라이언트(`useAnalysis`)** 경로라 색인용 초기 HTML에는 들어가지 않는다. 봇은 (1) JS 미실행 크롤러(SNS·일부 검색봇)는 placeholder만 보고, (2) Googlebot도 캐시 읽기 경로가 Server Action(POST mutation)이라 렌더 중 실행하지 않으며, (3) cache miss 시 `skipEnqueueIfMiss = isBot()`로 생성 자체가 스킵된다.

수천 종목 × 5탭으로 확장되면 "거의 동일한 템플릿 문장만 다른 페이지 수천 개"가 되어 Google의 scaled content / thin content 품질 신호가 `fundamental`·`news` 같은 강한 페이지까지 사이트 전반으로 끌어내릴 수 있다(helpful content는 site-wide 신호).

### 감사 정정 — fear-greed는 이미 SSR된다

초기 진단과 달리 `fear-greed`는 이 문제 대상이 아니다. `fear-greed/page.tsx`가 bars를 서버에서 `await prefetchQuery` → `dehydrate` → `HydrationBoundary`로 주입하고, `useBars`가 `useSuspenseQuery`라 dehydrated 캐시를 **SSR 렌더 시점에 동기적으로** 읽으며, `useFearGreedFromSymbol`이 그 bars로 `computeFearGreedIndex`를 렌더 중 계산한다. `FearGreedPage`는 점수·라벨·그룹 breakdown·신뢰도 footer를 `isHydrated` 게이팅 없이 렌더하므로 이 텍스트가 이미 초기 HTML에 들어간다(canvas 차트만 제외). → **범위에서 제외**, 구현 단계에서 view-source 1회 실측 검증 task만 남긴다.

---

## 2. 목표 / 비목표

### 목표
- chart·overall 페이지가 봇에게 **진짜 고유 콘텐츠**를 SSR HTML로 노출하도록 한다.
- 캐시된 AI 분석이 있으면 그 결론을 서버 렌더에 주입한다(stale해도 진짜면 OK).
- cache miss(특히 long-tail cold cache)에도 chart 페이지가 thin하지 않도록, **결정적·실측 데이터**로 채운다.
- LLM 추가 비용 0: 봇은 어떤 경로로도 LLM 생성을 트리거하지 않는다.

### 비목표 (명시적 배제)
- ❌ **모킹/가짜 분석 생성 금지**. 캐시가 없다고 가짜 AI 서사를 만들어 박지 않는다 — 클로킹(봇/사용자 상이 콘텐츠) + YMYL(금융) 위반 + scaled content abuse로, thin보다 더 큰 페널티 위험.
- ❌ fear-greed·fundamental·news 변경(이미 실데이터 SSR).
- ❌ chart-first viewport jail 동작 변경(아래 §4 참조).
- ❌ AI 분석 로직·캐시 TTL·job lifecycle 변경(전부 siglens-core 소유 — 본 작업은 읽기 전용 접근만 추가).

---

## 3. 아키텍처 — 2층 구조

```
[chart RSC]  (이미 bars prefetch → indicators 보유)
 ├─ 사실 층:  useBars(hydrated) → <TechnicalFactsSummary/>   ← 항상 SSR, 결정적, LLM 무관
 └─ 서사 층:  peekAnalysisCache() → HIT? initialAnalysis=cached : FALLBACK
                                    → AnalysisPanel이 SSR 렌더(기존 analysis prop 경로)

[overall RSC]
 └─ 서사 층만: peekOverallAnalysisCache() → HIT? OverallContent initialAnalysis prop : 미전달(현행)
```

- **사실 층**(chart 전용): bars 기반 결정적 계산. 캐시 유무와 무관하게 항상 존재.
- **서사 층**(chart·overall): LLM 분석 캐시 read-only peek. HIT일 때만 주입.

### core 계약 (siglens-core 레포 — 사용자가 구현·publish)

```ts
// read-only. enqueue / LLM / market-data 호출 / 그 외 side-effect 없음. miss·손상 시 null.
// buildAnalysisCacheKey + cache provider get + deserialize + validate를 core가 캡슐화한다.
export function peekAnalysisCache(
  symbol: string,
  timeframe: Timeframe,
  fmpSymbol?: string,
  modelId?: ModelId,
): Promise<AnalysisResponse | null>;

export function peekOverallAnalysisCache(
  symbol: string,
  // submitOverallAnalysis가 캐시 키로 사용하는 입력과 동일하게 맞춘다.
): Promise<OverallAnalysisResponse | null>;
```

- 분석 캐시 키 생성·역직렬화·검증 지식은 core가 소유한다(SCOPE 가드: 분석 캐시 = core). siglens가 `buildAnalysisCacheKey`+`createCacheProvider`로 직접 읽으면 schema drift 위험이 있어 채택하지 않는다.
- **SSR peek는 `DEFAULT_MODEL_ID`로 조회**한다. 서버는 사용자 localStorage 모델을 알 수 없으므로 기본 모델 캐시가 canonical 콘텐츠다. 클라이언트는 hydration 후 사용자 모델로 재분석할 수 있다(현행 동작).

---

## 4. chart 페이지 설계

### 4.1 chart-first jail 제약 (반드시 준수)

`SymbolLayout`의 `SymbolLayoutJail`은 차트(index) 라우트에서 **고정 높이 `h-[calc(...)]` + `overflow-hidden`** 으로 chart + AI 패널을 첫 viewport에 가득 채운다. 차트 본문에 `CrossLinkCards`조차 두지 않는 이유가 "jail 안 flex 분배가 깨져 chart 가시 영역이 침범된다"는 것이다(`page.tsx` 주석). → **사실 층을 AI 패널 위에 새 블록으로 얹지 않는다.**

### 4.2 사실 층 — AI 패널 슬롯 안에 배치

`TechnicalFactsSummary`(신규 client 컴포넌트)를 **AI 분석 패널의 빈 상태(no-narrative) 자리**에 렌더한다. 새 블록을 추가하지 않으므로 jail은 불변이고, 같은 가시 슬롯이 항상 진짜 콘텐츠를 갖는다.

- 데이터 출처: `useBars(symbol, DEFAULT_TIMEFRAME, fmpSymbol)`. 차트 페이지가 이미 bars를 prefetch→hydrate하므로 `useSuspenseQuery`가 **SSR 렌더 시점에 동기적으로 읽어** 서버에서 계산·렌더된다(fear-greed와 동일 패턴, 추가 fetch 없음).
- 렌더 내용(실측·결정적): 현재가·등락률, RSI 값+구간, MACD 상태, 볼린저 위치, 52주 고저 대비 위치, core가 산출한 주요 지지·저항 레벨. 모두 크롤 가능한 텍스트.
- 데이터 부족(신규 상장 등) → 섹션 graceful 생략.

### 4.3 서사 층 — peek + seed

- RSC가 `peekAnalysisCache(ticker, initialTimeframe, assetInfo.fmpSymbol, DEFAULT_MODEL_ID)` 호출.
- HIT → `initialAnalysis={cached}`. MISS → `FALLBACK_ANALYSIS`(현행).
- `AnalysisPanel`은 이미 `analysis` prop으로부터 SSR 텍스트를 렌더(`MarkdownText`, `isHydrated` 게이팅 없음)하므로, seed만 채우면 SSR된다.

### 4.4 슬롯 표시 규칙

분석 영역은 `analysis = analysisResult ?? initialAnalysis` 기준으로, **AI 서사 보유 여부를 명시적 술어로 판정**한다(내용 문자열 sniffing 금지):
- `hasNarrative` = `analysis`가 `FALLBACK_ANALYSIS` 센티넬이 아님 (전용 `isFallbackAnalysis(analysis)` 술어 또는 peek-hit 플래그 사용).
- `hasNarrative === true`(HIT seed 또는 클라 재분석 완료) → **AI 서사** 렌더.
- `hasNarrative === false`(cold-miss, 재분석 진행 중 포함) → **`TechnicalFactsSummary`** 렌더. 스켈레톤으로 비우지 않는다.

### 4.5 클라이언트 동작 (순수 가산)

- `initialAnalysisFailed`는 **항상 `true` 유지** → 클라 자동 재분석 보존(현행과 동일 비용 프로파일).
- HIT일 때 백그라운드 재분석 중에도 seed된 서사를 계속 노출(스켈레톤 플래시 없음). cold-miss일 때는 §4.4에 따라 사실 층을 노출한 채 재분석.

---

## 5. overall 페이지 설계

- RSC가 `peekOverallAnalysisCache(...)` 호출. HIT → `OverallContent`에 신설 `initialAnalysis` prop 전달.
- `OverallContent`(client): `initialAnalysis?` prop 추가 → `useOverallAnalysis`가 그 값으로 초기 state를 seed(`useAnalysis`의 `initialAnalysis` 패턴 차용) → SSR에 결론 렌더.
- **cold-miss → 사실 층 없이 현행 템플릿 가이드 유지.** overall의 본질은 5축 종합 AI 결론이라 대체할 싸고 결정적인 사실이 마땅치 않다(가격·지표는 chart와 중복).
- 클라이언트 동작 계약은 chart와 동일(자동 재분석 유지, seed 노출 유지).

---

## 6. 동작 계약 (HIT/MISS × 봇/사람)

| 상황 | 봇 | 사람 |
|---|---|---|
| chart · HIT | 사실 층 + AI 서사 SSR 색인. 생성 없음 | 사실 층/서사 즉시. 클라 백그라운드 재분석 |
| chart · MISS | **사실 층만** 색인(thin 아님). 생성 없음 | 사실 층 즉시 + 클라가 분석 생성(현행) |
| overall · HIT | AI 서사 SSR 색인. 생성 없음 | AI 서사 즉시 + 백그라운드 재분석 |
| overall · MISS | 현행 템플릿 가이드. 생성 없음 | 현행 + 클라가 생성 |

**불변식**: 봇은 어떤 경로로도 LLM 생성을 트리거하지 않는다 — peek는 read-only, 클라 submit은 봇이 실행하지 않으며 실행해도 `skipEnqueueIfMiss=isBot` 가드.

---

## 7. 엣지 케이스 & 에러 처리

- 잘못된 ticker → 기존 `notFound()`(peek 도달 전).
- **peek 예외(Redis 다운 등)** → `try/catch`로 `null`(=MISS) 취급, 로깅, **렌더는 절대 깨지지 않는다**.
- stale 캐시 → 진짜 데이터이므로 그대로 주입(사람은 클라 새로고침으로 최신화).
- 모델 키 불일치 → peek는 `DEFAULT_MODEL_ID`. 사용자가 다른 모델이면 hydration 후 재분석(현행).
- **지연**: peek = Redis GET 1회. `assetInfo`·`bars prefetch`와 `Promise.all`로 병렬화해 직렬 TTFB 증가를 막는다.
- 사실 층: bars 부족 시 섹션 graceful 생략.

---

## 8. 테스트 전략

### siglens-core (해당 레포)
- `peekAnalysisCache` / `peekOverallAnalysisCache` 단위: HIT / MISS / 손상 JSON → null / **side-effect 없음**(enqueue·LLM 호출 0 검증).

### siglens
- chart page: peek HIT → `initialAnalysis` seed / MISS → `FALLBACK` / peek throw → `FALLBACK` & 크래시 없음.
- `TechnicalFactsSummary` 단위: indicators로 실제 수치 텍스트 렌더 / 데이터 부족 시 생략.
- 슬롯 규칙(§4.4): `analysis` 빈 값 → 사실 층, 내용 있음 → 서사 렌더.
- overall page: peek HIT → `initialAnalysis` prop 전달 / MISS → 미전달.
- **render(SSR) 테스트**: seed된 서사·사실 텍스트가 SSR 출력 문자열에 존재(크롤러 가시성 핵심 검증).
- HIT 시 백그라운드 재분석 중 seed 콘텐츠 유지(스켈레톤 비노출).
- peek는 core이므로 mock.

---

## 9. 작업 순서 & 크로스레포

```
Phase 0  [siglens-core, 사용자]  peekAnalysisCache / peekOverallAnalysisCache 구현 + publish
                                  └ chart 서사 층(Phase B)·overall(Phase C)을 블록

Phase A  [siglens, core 무관]    chart 사실 층 (TechnicalFactsSummary + 슬롯 규칙)
                                  └ cold-miss thin을 즉시 해소, core 릴리스 불필요 — 가장 먼저 착수

Phase B  [siglens, Phase 0 후]   chart 서사 층 seed (peekAnalysisCache)
Phase C  [siglens, Phase 0 후]   overall 서사 층 seed (+ OverallContent/useOverallAnalysis seeding)

검증     [siglens]               fear-greed가 실제 SSR되는지 view-source 1회 확인(안 되면 별도 이슈)
```

- siglens-core의 publish는 사용자가 직접 수행한다(Claude는 배포 명령 실행 안 함).
- fear-greed가 이미 SSR되므로, **core 없이 바로 가치를 내는 첫 작업은 chart 사실 층(Phase A)** 이다.

---

## 10. 영향 받는 파일 (예상)

### siglens-core (사용자)
- `peekAnalysisCache`, `peekOverallAnalysisCache` 신규 + barrel export.

### siglens
- `src/app/[symbol]/page.tsx` — peek 호출, `initialAnalysis` seed, Promise.all 병렬화.
- `src/app/[symbol]/overall/page.tsx` — peek 호출, `initialAnalysis` prop 전달.
- `src/widgets/symbol-page/...` — `TechnicalFactsSummary` 신규 + 슬롯 규칙(빈 값 시 사실 층).
- `src/widgets/overall/OverallContent.tsx` + `hooks/useOverallAnalysis.ts` — `initialAnalysis` prop + seed.
- 각 변경에 colocated 테스트.
