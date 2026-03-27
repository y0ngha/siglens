# Conventions

## 코딩 패러다임

Siglens는 **선언형(Declarative)** 코드와 **함수형 프로그래밍(Functional Programming)** 패러다임을 지향한다.

### 선언형 코드

"어떻게"가 아닌 "무엇을"에 집중한다.

```typescript
// ❌ 명령형
const result = [];
for (let i = 0; i < closes.length; i++) {
    if (closes[i] > 0) result.push(closes[i] * 2);
}

// ✅ 선언형
const result = closes.filter(c => c > 0).map(c => c * 2);
```

```typescript
// ❌ 조건 분기 중첩
let label;
if (trend === 'bullish') label = '상승';
else if (trend === 'bearish') label = '하락';
else label = '중립';

// ✅ 객체 맵
const TREND_LABEL: Record<Trend, string> = {
    bullish: '상승',
    bearish: '하락',
    neutral: '중립',
};
const label = TREND_LABEL[trend];
```

### 함수형 프로그래밍

```typescript
// ✅ 순수 함수 — 동일 입력 → 동일 출력, 사이드 이펙트 없음
function calculateRSI(closes: number[], period: number): (number | null)[] { ... }

// ✅ 불변성
// ❌ bars.push(newBar)       ✅ [...bars, newBar]
// ❌ bar.close = 100         ✅ { ...bar, close: 100 }
```

### 적용 우선순위

```
domain/         함수형 필수 — 순수 함수, 불변성, 고차 함수
infrastructure/ 함수형 권장 — 내부 로직은 순수 함수로 분리
components/     선언형 필수 — 조건 분기는 객체 맵 또는 컴포넌트 분리
app/            선언형 권장 — RSC async/await 패턴과 자연스럽게 맞음
```

---

## 파일 / 디렉토리 네이밍

```
컴포넌트 파일    PascalCase      StockChart.tsx
훅 파일          camelCase       useStockData.ts
유틸/함수 파일   camelCase       calculateRSI.ts
타입 파일        camelCase       types.ts
테스트 파일      원본명.test     rsi.test.ts
디렉토리         소문자 kebab    indicators/, stock-chart/
```

---

## TypeScript 규칙

```typescript
// ✅ interface 우선, union은 type alias
interface Bar { time: number; open: number; }
type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';

// ❌ any 금지
const data: any = response;

// ✅ 도메인 함수 반환 타입 명시 필수
function calculateRSI(closes: number[], period: number): (number | null)[] { ... }

// ✅ 초기 구간은 null (0, NaN 금지 — 차트에서 null은 렌더링 생략, 0은 잘못된 값으로 표시)
const result: (number | null)[] = new Array(period - 1).fill(null);

// ✅ interface 필드는 camelCase
// 외부 소스(YAML frontmatter 등) 값이 snake_case여도 domain 타입은 camelCase로 정의하고
// infrastructure 레이어에서 변환한다.
interface Skill { confidenceWeight: number; }

// ✅ interface 필드에 union 리터럴 2개 이상이면 type alias로 분리
type SignalStrength = 'strong' | 'moderate' | 'weak';
interface Signal { strength: SignalStrength; }

// ✅ 리터럴 하드코딩 금지 — 상수로 추출
// ❌ period = 14
// ✅ period = RSI_DEFAULT_PERIOD  (domain/indicators/constants.ts)
```

---

## 커스텀 훅 내부 선언 순서

커스텀 훅 내부는 다음 순서로 선언한다. `useState`는 로컬 상태가 필요한 경우에만 포함하며, 불필요하면 생략한다.

1. `useState` — 로컬 상태 (필요 시)
2. `useRef` — ref 선언
3. `useQuery` / `useMutation` 등 외부 훅 — 서버 상태 및 비동기 작업
4. 파생 변수(derived variables) — `mutation.data` 등에서 계산된 값
5. 이벤트 핸들러 및 함수 — `handle*`, 내부 유틸 함수
6. `useLayoutEffect` — `useEffect`보다 먼저 실행되므로 바로 앞에 위치 (필요 시)
7. `useEffect` — 모두 한 곳에 모음. 책임별로 분리하되 Effects 블록 안에 순서대로 나열
8. `return`

같은 종류끼리 묶어서 선언한다. 종류 경계는 주석으로 구분할 수 있다.

```typescript
export function useExample(props: ExampleOptions): ExampleResult {
    // Refs
    const ref = useRef<HTMLDivElement>(null);

    // Query hooks
    const mutation = useMutation({ mutationFn: postSomething });

    // Derived variables
    const value = mutation.data ?? initialValue;
    const error = mutation.error?.message ?? null;

    // Handlers
    const handleSubmit = (): void => {
        mutation.mutate(ref.current);
    };

    // Effects
    useLayoutEffect(() => {
        ref.current = someValue;
    });

    useEffect(() => {
        mutation.reset();
    }, [dep, mutation]);

    return { value, error, handleSubmit };
}
```

---

## 컴포넌트 폴더 구조 규칙

컴포넌트 폴더 내 커스텀 훅은 반드시 `hooks/` 서브폴더에 위치해야 한다.
컴포넌트 파일과 훅 파일을 같은 레벨에 혼재하지 않는다.

```
# ✅ 올바른 구조
src/components/
├── chart/
│   ├── hooks/
│   │   ├── useBollingerOverlay.ts
│   │   └── useChartData.ts
│   └── StockChart.tsx
└── symbol-page/
    ├── hooks/
    │   ├── useAnalysis.ts
    │   └── useBars.ts
    └── SymbolPageClient.tsx

# ❌ 잘못된 구조 — 훅이 컴포넌트와 같은 레벨에 위치
src/components/symbol-page/
├── SymbolPageClient.tsx
├── useAnalysis.ts  ← 금지
└── useBars.ts      ← 금지
```

---

## 컴포넌트 규칙

```typescript
// ✅ 'use client' — 파일 최상단, useState/useEffect 사용 시 필수
'use client';

// ✅ Props 인터페이스를 컴포넌트 바로 위에 정의
interface StockChartProps { initialBars: Bar[]; symbol: string; }
export function StockChart({ initialBars, symbol }: StockChartProps) { ... }

// ❌ inline type 금지
export function StockChart({ initialBars, symbol }: { initialBars: Bar[]; symbol: string }) { ... }

// ✅ named export (page/layout만 default export)
export function StockChart() {}
export default function Page() {}
```

---

## 도메인 함수 규칙

```typescript
// ✅ 순수 함수만 허용
// ❌ fetch, console.log, Date.now() 등 사이드 이펙트 금지
function calculateRSI(closes: number[], period = RSI_DEFAULT_PERIOD): (number | null)[] {
    // 순수 계산만
}
```

---

## 테스트 규칙

### 파일 위치

```
src/__tests__/domain/indicators/rsi.test.ts
src/__tests__/infrastructure/market/alpaca.test.ts
```

### 커버리지 목표

```
domain/         100%
infrastructure/ 100%
components/     제외
app/            제외
```

**`components/` and `app/` are intentionally excluded from test coverage.**
Do not request or write test files for files under `components/` or `app/`.
UI rendering logic is verified manually or via integration tests, not unit tests.
Test files exist only for `domain/` and `infrastructure/`.

### 테스트 구조

```typescript
// ✅ describe → describe(context) → it
describe('calculateRSI', () => {
    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            expect(calculateRSI([100, 101], 14)).toEqual([null, null]);
        });
    });
    describe('정상 입력일 때', () => {
        it('처음 period - 1개의 값은 null이다', () => { ... });
        it('0 ~ 100 사이 값을 반환한다', () => { ... });
    });
});
```

### period 기반 인디케이터 필수 테스트 케이스

| 케이스 | it 설명 |
|--------|---------|
| 빈 배열 | 빈 배열을 반환한다 |
| period 미만 입력 | 전부 null인 배열을 반환한다 |
| 초기 null 구간 | 처음 period - 1개의 값은 null이다 |
| 정상값 구간 | period번째 이후 값은 null이 아닌 숫자다 |
| 계산 정확성 | 첫 번째 값이 명세와 일치한다 |

### 외부 API 모킹

```typescript
jest.mock('node-fetch');
import { mockAlpacaBarsResponse } from '@/__tests__/fixtures/alpaca';
```

---

## import 경로 규칙

```typescript
// ✅ path alias 사용
import { calculateRSI } from '@/domain/indicators/rsi';

// ❌ 상대 경로 금지
import { calculateRSI } from '../../../domain/indicators/rsi';
```

---

## useEffect 사이드이펙트 격리

`useEffect` 안에서 발생하는 사이드이펙트는 **책임별로 분리**한다.
하나의 `useEffect`에 초기화 로직과 데이터 동기화 로직을 혼재시키지 않는다.

```typescript
// ❌ 초기화 + 데이터 세팅을 하나의 useEffect에 혼재
useEffect(() => {
    const chart = createChart(containerRef.current, { ... });
    const series = chart.addSeries(CandlestickSeries, { ... });
    series.setData(bars); // 데이터 변경 시 차트 전체 재생성
    return () => { chart.remove(); };
}, [bars]);

// ✅ 초기화([]): 마운트 시 1회만 실행, ref에 인스턴스 보관
useEffect(() => {
    const chart = createChart(containerRef.current, { ... });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, { ... });
    return () => {
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
    };
}, []);

// ✅ 데이터 동기화([deps]): 데이터 변경 시 인스턴스 재사용
useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(mappedBars);
    chartRef.current.timeScale().fitContent();
}, [bars]);
```

**원칙**
- 외부 라이브러리 인스턴스 생성/파괴(`[]`) 와 데이터 동기화(`[deps]`)는 별도 `useEffect`로 분리
- 초기화 `useEffect`의 cleanup에서 ref를 `null`로 초기화하여 다음 데이터 effect가 stale 인스턴스에 접근하지 않도록 보호

---

## Lightweight Charts 규칙

공식 문서: https://tradingview.github.io/lightweight-charts/docs

```
✅ components/chart/ 에서만 사용
❌ app/, domain/, infrastructure/ 에서 import 금지
```

```typescript
// ✅ 차트 초기화 + cleanup 필수
useEffect(() => {
    const chart = createChart(containerRef.current, { ... });
    const series = chart.addSeries(CandlestickSeries);
    series.setData(data);
    return () => { chart.remove(); };
}, []);

// ✅ 거래량, RSI 등 별도 pane
chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }, 1);
chart.addSeries(LineSeries, {}, 2);

// ✅ null 값은 WhitespaceData로 변환
// ❌ { time: '2024-01-01', value: null }
// ✅ { time: '2024-01-01' }

// ✅ 과거 데이터 추가 로딩
candleSeries.setData([...newOlderBars, ...existingBars]);
```

---

## Tailwind CSS 규칙

```typescript
// ✅ Tailwind 클래스 사용
<div className="flex items-center gap-4 p-4 bg-gray-900">

// ❌ 인라인 style 금지
<div style={{ display: 'flex', padding: '16px' }}>

// ✅ 조건부 클래스는 cn 유틸 사용
<div className={cn('base-class', isActive && 'active-class')}>
```

---

## ESLint 규칙

`eslint-disable`, `eslint-disable-next-line` 주석은 사용하지 않는다. eslint 규칙이 경고를 발생시키는 경우, 규칙을 끄는 대신 근본 원인을 해결하는 방식으로 코드를 수정해야 한다.

```typescript
// ✅ import/first — import는 파일 최상단에
import { calculateRSI } from './rsi';
export * from './rsi';

// ❌ export * 뒤에 import 금지
export * from './rsi';
import { calculateRSI } from './rsi';
```

EOF 개행: 모든 파일은 마지막 줄에 `\n`으로 끝나야 한다. `yarn format`으로 자동 교정.

---

## HTTP 상태 코드

```typescript
// ✅ node:http2 내장 상수 사용 — 외부 패키지 불필요, Node.js 공식 모듈
import { constants } from 'node:http2';
const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_NOT_FOUND } = constants;

// ❌ 로컬 상수 재정의 금지 — node:http2가 이미 표준 상수를 제공함
const HTTP_STATUS = { BAD_REQUEST: 400 };

// ❌ 리터럴 하드코딩 금지
return NextResponse.json({ error: '...' }, { status: 400 });
```

---

## 레이어 의존성 규칙

```
domain/         외부 라이브러리 import 금지 — 순수 TypeScript 함수만
infrastructure/ domain만 import 가능
components/     domain, lib import 가능
                컴포넌트 파일(.tsx): infrastructure 직접 import 금지
                훅 파일(hooks/): infrastructure의 fetch 함수만 import 가능
                  → useQuery/useMutation의 queryFn/mutationFn 연결 목적에 한함
app/            infrastructure, domain, lib 모두 import 가능
lib/            외부 UI 유틸리티 래퍼 (clsx, tailwind-merge 등)
                domain에 넣을 수 없는 외부 패키지 wrapping 전용
                순수 함수 형태로 작성 — 사이드 이펙트 없음
                React Query 키 팩토리(QUERY_KEYS 등) 포함 — 앱 전역에서 공유되는
                React Query 관련 설정 파일도 lib/에 위치할 수 있다
                domain 타입(Timeframe 등) import 허용 — 키 팩토리 타입 안전성 확보 목적
```

---

## React Query와 서버 상태 관리 규칙

클라이언트에서는 React Query를 이용해 서버 상태를 관리하고, 서버 데이터를 fetch하는 로직은 반드시 infrastructure layer에 위치해야 한다. component hooks는 infrastructure의 fetch 함수를 useQuery/useMutation의 queryFn/mutationFn으로 연결하는 역할만 담당한다.

```typescript
// ✅ infrastructure layer — fetch 로직
// src/infrastructure/market/barsApi.ts
export async function fetchBarsWithIndicators(
    symbol: string,
    timeframe: Timeframe,
    signal?: AbortSignal
): Promise<BarsData> {
    const res = await fetch(`/api/bars?symbol=${symbol}&timeframe=${timeframe}`);
    // ...
}

// ✅ component hook — queryFn 연결 역할만
// src/components/symbol-page/hooks/useBars.ts
const { data } = useQuery({
    queryKey: QUERY_KEYS.bars(symbol, timeframe),
    queryFn: ({ signal }) => fetchBarsWithIndicators(symbol, timeframe, signal),
});

// ❌ component hook 내부에 fetch 로직 인라인 금지
const { data: barsData } = useQuery({
    queryKey: QUERY_KEYS.bars(symbol, timeframe),
    queryFn: async ({ signal }) => {
        const res = await fetch(`/api/bars?symbol=${symbol}`); // 금지
        return res.json();
    },
});
```
