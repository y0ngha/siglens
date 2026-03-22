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

## 레이어 의존성 규칙

```
domain/         외부 라이브러리 import 금지 — 순수 TypeScript 함수만
infrastructure/ domain만 import 가능
components/     domain만 import 가능 — infrastructure 직접 import 금지
app/            infrastructure, domain 모두 import 가능
```