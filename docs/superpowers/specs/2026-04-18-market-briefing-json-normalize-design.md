# Market Briefing JSON 정규화 설계

**날짜:** 2026-04-18
**브랜치:** feature/issue-328-market-summary-panel

---

## 배경

현재 `buildMarketBriefingPrompt`는 "plain text only"를 요청하지만, worker(AI)는 구조화된 JSON을 반환한다. UI는 이를 raw 문자열로 그대로 출력 중이어서 JSON이 텍스트로 노출된다.

## 목표

1. 프롬프트를 JSON 스키마로 명시해 worker 응답을 표준화한다.
2. `RawAnalysisResponse` + `normalize.ts` 패턴을 동일하게 적용해 `unknown → MarketBriefingResponse`로 정규화한다.
3. UI에서 구조화된 필드를 표시한다.

---

## 도메인 타입

### `RawMarketBriefingResponse` (domain/types.ts)

worker에서 받은 raw 응답. 모든 필드를 `unknown`으로 선언해 LLM의 응답 불일치를 안전하게 처리한다.

```ts
export interface RawMarketBriefingResponse {
    summary?: unknown;
    dominantThemes?: unknown;
    sectorAnalysis?: unknown;
    volatilityAnalysis?: unknown;
    riskSentiment?: unknown;
}
```

### `MarketBriefingResponse` (domain/types.ts)

정규화 후 타입 확정된 응답. UI가 직접 소비한다.

```ts
export interface MarketBriefingSectorAnalysis {
    leadingSectors: string[];
    laggingSectors: string[];
    performanceDescription: string;
}

export interface MarketBriefingVolatilityAnalysis {
    vixLevel: number | undefined;
    description: string;
}

export interface MarketBriefingResponse {
    summary: string;
    dominantThemes: string[];
    sectorAnalysis: MarketBriefingSectorAnalysis;
    volatilityAnalysis: MarketBriefingVolatilityAnalysis;
    riskSentiment: string;
}
```

`SubmitBriefingResult` / `PollBriefingResult`의 `briefing` 필드를 `string` → `MarketBriefingResponse`로 교체한다.

---

## 정규화 함수

**파일:** `src/domain/analysis/normalizeMarketBriefing.ts`

`normalize.ts`의 `asString`, `asArray`, `asObject`, `asNumber` 헬퍼를 재사용한다.

```ts
export function normalizeMarketBriefing(raw: unknown): MarketBriefingResponse
```

- `summary`: `asString(o.summary, '')`
- `dominantThemes`: `asArray(o.dominantThemes).map(v => asString(v)).filter(Boolean)`
- `sectorAnalysis`:
  - `leadingSectors`, `laggingSectors`: string 배열 정규화
  - `performanceDescription`: `asString`
- `volatilityAnalysis`:
  - `vixLevel`: `asNumber(o.vixLevel)` (undefined 허용)
  - `description`: `asString`
- `riskSentiment`: `asString(o.riskSentiment, '')`

필드 누락 시 안전한 기본값(`''`, `[]`)을 반환해 UI가 조건부 렌더링 없이 동작한다.

---

## 프롬프트 수정

**파일:** `src/domain/analysis/marketBriefingPrompt.ts`

`description`, `basis` 필드 제거. JSON 스키마를 명시하고 few-shot 예시 1개를 추가한다.

요청 스키마:
```json
{
  "summary": "1문장 시장 요약",
  "dominantThemes": ["테마1", "테마2"],
  "sectorAnalysis": {
    "leadingSectors": ["XLK", "XLF"],
    "laggingSectors": ["XLE"],
    "performanceDescription": "..."
  },
  "volatilityAnalysis": {
    "vixLevel": 17.48,
    "description": "..."
  },
  "riskSentiment": "..."
}
```

---

## 데이터 흐름

```
Worker(AI)
  └─ JSON 응답 (RawMarketBriefingResponse)

pollBriefingAction.ts
  └─ normalizeMarketBriefing(raw)        // unknown → MarketBriefingResponse
  └─ cache.set(key, { briefing, generatedAt })  // MarketBriefingResponse 저장

submitBriefingAction.ts
  └─ cache.get<{ briefing: MarketBriefingResponse; generatedAt: string }>()
  └─ return { status: 'cached', briefing, generatedAt }

useBriefing.ts
  └─ briefing: MarketBriefingResponse | null

MarketSummaryPanel.tsx
  └─ <BriefingCard briefing={briefing} generatedAt={generatedAt} />
```

---

## UI 컴포넌트

### `BriefingCard` (신규, src/components/dashboard/BriefingCard.tsx)

`MarketSummaryPanel`의 브리핑 블록을 별도 컴포넌트로 분리한다.

| 필드 | 표시 방식 |
|---|---|
| `summary` | 메인 텍스트 (`<p>`) |
| `dominantThemes` | 태그 chips (`<span>` 목록) |
| `sectorAnalysis.leadingSectors` | 초록색 텍스트 (`text-chart-bullish`) |
| `sectorAnalysis.laggingSectors` | 빨간색 텍스트 (`text-chart-bearish`) |
| `sectorAnalysis.performanceDescription` | 보조 텍스트 |
| `volatilityAnalysis.vixLevel` + `description` | "VIX 17.48 — ..." 형태 |
| `riskSentiment` | 작은 보조 텍스트 |
| `generatedAt` | 기존 "X월 X일 HH:MM 기준 분석" |

`isLoading`, `error` 상태도 `BriefingCard`로 이동시켜 `MarketSummaryPanel`을 단순화한다.

---

## 에러 처리

- `normalizeMarketBriefing` 실패(예: raw가 객체가 아님): 모든 필드를 기본값으로 채운 `MarketBriefingResponse` 반환. 예외를 던지지 않는다.
- `summary`가 빈 문자열: `BriefingCard`에서 브리핑 없음 상태로 표시.

---

## 테스트

- `src/__tests__/domain/analysis/normalizeMarketBriefing.test.ts` (신규)
  - 완전한 입력 → 정상 정규화
  - 누락 필드 → 기본값
  - null/비객체 입력 → 기본값
- `src/__tests__/infrastructure/market/pollBriefingAction.test.ts` (수정)
  - `normalizeMarketBriefing` 호출 확인
  - 캐시에 `MarketBriefingResponse` 저장 확인
- `src/__tests__/infrastructure/market/submitBriefingAction.test.ts` (수정)
  - 캐시 히트 시 `MarketBriefingResponse` 반환 확인
