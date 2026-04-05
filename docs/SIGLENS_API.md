# Siglens 내부 API

Next.js Server Action으로 구현된 내부 서버-클라이언트 통신 명세.

외부 API(Alpaca, Claude)는 `docs/API.md` 참고.

---

## 개요

Route Handler 기반 HTTP 엔드포인트 대신 Next.js Server Action을 사용한다.
Server Action은 `'use server'` 지시어를 가진 함수로, 클라이언트에서 직접 호출하면
Next.js가 내부적으로 서버 요청으로 처리한다.

Server Action 파일은 `infrastructure/market/` 레이어에 위치하며,
hooks에서 `queryFn` / `mutationFn`으로 직접 import하여 사용한다.

---

## getBarsAction

타임프레임 전환 시 bars 데이터와 인디케이터를 함께 반환한다.

### 파일 위치

`src/infrastructure/market/getBarsAction.ts`

### 함수 시그니처

```typescript
async function getBarsAction(
    symbol: string,
    timeframe: Timeframe
): Promise<BarsData>
```

### 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `symbol` | string | ✅ | 종목 코드 (예: `AAPL`) |
| `timeframe` | Timeframe | ✅ | `1Min` \| `5Min` \| `15Min` \| `1Hour` \| `1Day` |

### 반환값

```typescript
interface BarsData {
    bars: Bar[];
    indicators: IndicatorResult;
}
```

### 처리 흐름

```
getBarsAction(symbol, timeframe)
  → fetchBarsWithIndicators (infrastructure/market/barsApi.ts)
    → AlpacaProvider.getBars() → Alpaca API
    → calculateIndicators (domain/indicators)
  → BarsData 반환
```

---

## analyzeAction

주어진 봉 데이터와 인디케이터를 바탕으로 AI 종합 분석 리포트를 생성한다.

### 파일 위치

`src/infrastructure/market/analyzeAction.ts`

### 함수 시그니처

```typescript
async function analyzeAction(
    variables: AnalyzeVariables
): Promise<AnalyzeRouteResponse>
```

### 파라미터

```typescript
interface AnalyzeVariables {
    symbol: string;
    bars: Bar[];
    indicators: IndicatorResult;
}
```

### 반환값

```typescript
// AnalysisResponse를 확장하며 skills 로딩 실패 여부를 추가로 포함
interface AnalyzeRouteResponse extends AnalysisResponse {
    skillsDegraded: boolean;
}
```

`AnalysisResponse` 전체 타입 정의는 `src/domain/types.ts` 참고.

### 처리 흐름

```
analyzeAction(variables)
  → postAnalyze (infrastructure/market/analysisApi.ts)
    → FileSkillsLoader.loadSkills() → skills/*.md 파일 로드 및 파싱
    → buildAnalysisPrompt (domain/analysis/prompt.ts) → 프롬프트 구성
    → createAIProvider().analyze() → AI API 호출
    → enrichAnalysisWithConfidence (domain/analysis/confidence.ts)
  → AnalyzeRouteResponse 반환
```

### skillsDegraded

Skills 파일 로딩에 실패한 경우 빈 `skills[]`로 분석을 계속하고 `skillsDegraded: true`를 반환한다.

---

## 타입 참조

전체 타입 정의는 `src/domain/types.ts` 참고.
