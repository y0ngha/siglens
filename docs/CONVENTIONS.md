# Conventions

## 코딩 패러다임

Siglens는 **선언형(Declarative)** 코드와 **함수형 프로그래밍(Functional Programming)** 패러다임을 지향한다.

### 선언형 코드

"어떻게"가 아닌 "무엇을"에 집중한다.

```typescript
// ❌ 명령형 (어떻게)
const result = [];
for (let i = 0; i < closes.length; i++) {
    if (closes[i] > 0) {
        result.push(closes[i] * 2);
    }
}

// ✅ 선언형 (무엇을)
const result = closes
    .filter(close => close > 0)
    .map(close => close * 2);
```

```typescript
// ❌ 명령형 조건 분기
let label;
if (trend === 'bullish') {
    label = '상승';
} else if (trend === 'bearish') {
    label = '하락';
} else {
    label = '중립';
}

// ✅ 선언형 객체 맵
const TREND_LABEL: Record<Trend, string> = {
    bullish: '상승',
    bearish: '하락',
    neutral: '중립',
};
const label = TREND_LABEL[trend];
```

### 함수형 프로그래밍

```typescript
// ✅ 순수 함수 (동일 입력 → 동일 출력, 사이드 이펙트 없음)
function calculateRSI(closes: number[], period: number): (number | null)[] {
    // 외부 상태 읽기/쓰기 없음
    // fetch, console.log, Date.now() 등 금지
}

// ✅ 불변성 (원본 데이터 변경 금지)
// ❌ bars.push(newBar)         → 원본 변경
// ✅ [...bars, newBar]         → 새 배열 반환
// ❌ bar.close = 100           → 원본 변경
// ✅ { ...bar, close: 100 }   → 새 객체 반환

// ✅ 함수 합성 (pipe/compose 패턴)
const analyze = (bars: Bar[]) =>
    pipe(
        bars,
        extractCloses,
        closes => calculateRSI(closes, 14),
        filterNulls,
    );

// ✅ 고차 함수 활용
const withPeriodColor = (period: number) =>
    (series: ISeriesApi<'Line'>) => {
        series.applyOptions({ color: CHART_COLORS[`period${period}`] });
        return series;
    };
```

### 적용 우선순위

```
domain/         함수형 필수
                순수 함수, 불변성, 고차 함수

infrastructure/ 함수형 권장
                외부 API 호출 특성상 사이드 이펙트 불가피하나
                내부 로직은 순수 함수로 분리

components/     선언형 필수
                JSX는 본질적으로 선언형
                조건 분기는 객체 맵 또는 컴포넌트 분리로 처리

app/            선언형 권장
                RSC의 async/await 패턴과 자연스럽게 맞음
```

### 자주 하는 실수

```
1. for/while 루프 사용
   → map, filter, reduce, flatMap으로 대체

2. 변수 재할당 (let)
   → const로 선언, 새 값이 필요하면 새 변수

3. 원본 배열/객체 직접 변경
   → spread 연산자 또는 구조 분해로 새 값 반환

4. 조건문 중첩
   → 객체 맵, 얼리 리턴, 컴포넌트 분리로 대체

5. 클래스 기반 로직 (domain에서)
   → 순수 함수로 대체
   → 단, infrastructure의 Provider는 클래스 허용
```

---

## 파일 네이밍

```
컴포넌트 파일    PascalCase    StockChart.tsx
훅 파일          camelCase     useStockData.ts
유틸/함수 파일   camelCase     calculateRSI.ts
타입 파일        camelCase     types.ts
테스트 파일      원본명.test   rsi.test.ts
```

---

## 디렉토리 네이밍

```
모두 소문자 kebab-case

✅ indicators/
✅ stock-chart/
❌ Indicators/
❌ stockChart/
```

---

## TypeScript 규칙

### 타입 정의

```typescript
// ✅ interface 우선 사용
interface Bar {
    time: number;
    open: number;
}

// ✅ union type은 type alias
type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';

// ❌ any 사용 금지
const data: any = response; // 금지
```

### 함수 시그니처

```typescript
// ✅ 반환 타입 명시
function calculateRSI(closes: number[], period: number): (number | null)[] {
    // ...
}

// ❌ 반환 타입 생략 금지 (도메인 함수에서)
function calculateRSI(closes: number[], period: number) {
    // ...
}
```

### null 처리

```typescript
// ✅ 초기 구간은 null 반환
// ❌ 0 또는 NaN으로 채우지 않는다
// 이유: 차트에서 null은 렌더링 생략, 0은 잘못된 값으로 표시됨

function calculateRSI(closes: number[], period = 14): (number | null)[] {
    const result: (number | null)[] = new Array(period).fill(null);
    // ...
    return result;
}
```

---

## 컴포넌트 규칙

### 'use client' 표기

```typescript
// ✅ 파일 최상단에 명시
'use client';

import { useState } from 'react';

// ❌ 누락 금지 (useState, useEffect 사용 시 반드시 필요)
```

### Props 타입 정의

```typescript
// ✅ Props 인터페이스를 컴포넌트 바로 위에 정의
interface StockChartProps {
    initialBars: Bar[];
    symbol: string;
}

export function StockChart({ initialBars, symbol }: StockChartProps) {
    // ...
}

// ❌ inline type 금지
export function StockChart({ initialBars, symbol }: { initialBars: Bar[]; symbol: string }) {
    // ...
}
```

### default export vs named export

```typescript
// ✅ 컴포넌트는 named export
export function StockChart() {}

// ✅ Next.js page/layout은 default export (Next.js 규칙)
export default function Page() {}

// ❌ 컴포넌트에 default export 혼용 금지
```

---

## 도메인 함수 규칙

```typescript
// ✅ 순수 함수로 작성 (사이드 이펙트 없음)
// ✅ 동일 입력 → 동일 출력
// ✅ 외부 상태 읽기/쓰기 없음

// ❌ fetch, console.log, Date.now() 등 사이드 이펙트 금지
function calculateRSI(closes: number[], period = 14): (number | null)[] {
    // 순수 계산만
}
```

---

## 테스트 규칙

### 파일 위치

```
src/__tests__/domain/indicators/rsi.test.ts
src/__tests__/domain/indicators/macd.test.ts
src/__tests__/infrastructure/market/alpaca.test.ts
```

### 테스트 구조

```typescript
// ✅ describe → context → it 구조
describe('calculateRSI', () => {
    describe('입력 데이터가 period보다 적을 때', () => {
        it('null 배열을 반환한다', () => {
            const result = calculateRSI([100, 101], 14);
            expect(result).toEqual([null, null]);
        });
    });

    describe('정상 입력일 때', () => {
        it('0 ~ 100 사이 값을 반환한다', () => {
            // ...
        });
    });
});
```

### 커버리지 목표

```
domain/         100%
infrastructure/ 100%
components/     제외
app/            제외
```

### 외부 API 모킹

```typescript
// infrastructure 테스트에서 fetch 모킹
jest.mock('node-fetch');

// Alpaca API 응답 픽스처는 __tests__/fixtures/ 에 보관
import { mockAlpacaBarsResponse } from '@/__tests__/fixtures/alpaca';
```

---

## import 경로 규칙

```typescript
// ✅ path alias 사용
import { calculateRSI } from '@/domain/indicators/rsi';
import { AlpacaProvider } from '@/infrastructure/market/alpaca';

// ❌ 상대 경로 금지 (depth가 깊어질수록 가독성 저하)
import { calculateRSI } from '../../../domain/indicators/rsi';
```

**tsconfig.json paths 설정**

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 자주 하는 실수 (하지 말 것)

```
1. domain에서 외부 라이브러리 import
   → technicalindicators, lodash 등 일체 금지

2. components에서 infrastructure import
   → AlpacaProvider, claudeClient 등 금지

3. 인디케이터 초기 구간을 0 또는 NaN으로 채우기
   → 반드시 null로 채울 것

4. 'use client' 없이 useState/useEffect 사용
   → Next.js 16 App Router에서 빌드 에러 발생

5. Route Handler에서 인디케이터 계산 직접 작성
   → 반드시 domain/indicators에서 import해서 사용

6. 타임프레임을 URL 쿼리 파라미터로 관리
   → 클라이언트 상태로만 관리 (URL 변경 없음)

7. any 타입 사용
   → 컴파일 에러 수준으로 금지

8. 테스트 없이 구현 완료 선언
   → 구현과 테스트는 항상 함께 작성

9. Lightweight Charts를 components/chart/ 밖에서 import
   → domain, infrastructure, app에서 사용 금지

10. chart.remove() cleanup 누락
    → useEffect return에서 반드시 호출

11. 새 파일 생성 시 테스트 파일 동시 생성 누락
    → domain/, infrastructure/ 파일 생성과 테스트 파일은 항상 같은 커밋에 포함

12. 반환 타입 변경 시 테스트 미갱신
    → 함수 반환 타입이 바뀌면 반드시 대응하는 테스트도 함께 수정
    → 특히 nullable 변경(T[] → (T | null)[])은 초기 구간 null 케이스 테스트 필수
```

---

## Lightweight Charts 사용 규칙

공식 문서: https://tradingview.github.io/lightweight-charts/docs

### 사용 위치

```
✅ components/chart/ 에서만 사용
❌ app/, domain/, infrastructure/ 에서 import 금지
```

### 차트 초기화 및 정리

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

export function StockChart() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            // 옵션
        });

        const series = chart.addSeries(CandlestickSeries);
        series.setData(data);

        // ✅ 반드시 cleanup에서 chart.remove() 호출
        return () => {
            chart.remove();
        };
    }, []);

    return <div ref={containerRef} />;
}
```

### 시리즈 타입별 사용 규칙

```typescript
// ✅ 캔들 차트
const candleSeries = chart.addSeries(CandlestickSeries);

// ✅ 거래량 (별도 pane)
const volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
}, 1); // pane index 1

// ✅ 인디케이터 라인 (메인 pane 오버레이)
const emaSeries = chart.addSeries(LineSeries, {
    color: '#f59e0b',
    lineWidth: 1,
});

// ✅ RSI, MACD 등 별도 pane
const rsiSeries = chart.addSeries(LineSeries, {}, 2); // pane index 2
```

### 데이터 포맷

```typescript
// ✅ 캔들 데이터 — time은 'YYYY-MM-DD' 또는 Unix timestamp(초)
candleSeries.setData([
    { time: '2024-01-15', open: 185.2, high: 186.1, low: 184.9, close: 185.7 },
]);

// ✅ 라인 데이터
emaSeries.setData([
    { time: '2024-01-15', value: 183.5 },
]);

// ✅ null 값은 WhitespaceData로 처리 (초기 구간)
emaSeries.setData([
    { time: '2024-01-01' },        // WhitespaceData (렌더링 생략)
    { time: '2024-01-02', value: 183.5 },
]);
```

### 스크롤 과거 데이터 추가 로딩

```typescript
// ✅ 과거 데이터는 setData가 아닌 신규 setData(전체)로 교체
// 이유: Lightweight Charts는 prepend API가 없음
// 기존 데이터 + 새 데이터를 합쳐서 setData 재호출
const allBars = [...newOlderBars, ...existingBars];
candleSeries.setData(allBars);
```

### 자주 하는 실수

```
1. useEffect cleanup에서 chart.remove() 누락
   → 컴포넌트 재마운트 시 canvas 중복 생성

2. setData를 실시간 업데이트에 사용
   → 성능 저하. 실시간은 series.update() 사용

3. domain/indicators의 null을 그대로 setData에 전달
   → WhitespaceData 형식({ time })으로 변환 필요

4. pane index 없이 모든 시리즈를 메인 pane에 추가
   → 거래량, RSI 등은 반드시 별도 pane(index 1, 2...)에 추가
```

---

## Tailwind CSS 규칙

```typescript
// ✅ className에 Tailwind 클래스 직접 사용
<div className="flex items-center gap-4 p-4 bg-gray-900">

// ❌ 인라인 style 금지 (Tailwind로 표현 가능한 경우)
<div style={{ display: 'flex', padding: '16px' }}>

// ✅ 조건부 클래스는 clsx 또는 cn 유틸 사용
<div className={cn('base-class', isActive && 'active-class')}>
```

---

## 커밋 메시지

docs/GIT_CONVENTION.md 참고.