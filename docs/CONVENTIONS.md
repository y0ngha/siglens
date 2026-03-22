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

### ❌ 자주 하는 실수

```
1. for/while 루프 → map, filter, reduce, flatMap으로 대체
2. let 재할당 → const + 새 변수
3. 원본 배열/객체 직접 변경 → spread 연산자
4. 조건 중첩/삼항 중첩 → 객체 맵 또는 얼리 리턴
5. domain에서 클래스 사용 → 순수 함수로 대체 (infrastructure Provider는 예외)
6. reduce 콜백 안에서 외부 배열 push → accumulator에 spread로 처리
  ❌ result.push(ema)   ✅ return [...acc, ema]
7. 동일 알고리즘 중복 구현 → 새로운 함수 구현 전 기존 헬퍼 먼저 확인
  number[] 기반 헬퍼와 Bar[] 기반 래퍼를 분리해 재사용
8. Object.fromEntries 반환 타입 불일치 → Record<K, V>가 필요하면 타입 단언 필수
  Object.fromEntries의 TypeScript 반환 타입은 { [k: string]: T }이며 키 타입이 string으로 고정된다.
  Record<number, V> 등 구체적인 타입이 필요한 경우 as로 단언해야 한다.
  ❌ Object.fromEntries(pairs)
  ✅ Object.fromEntries(pairs) as Record<number, (number | null)[]>
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
```

```typescript
// ✅ interface 필드는 camelCase
interface Skill {
    confidenceWeight: number;  // ✅
    // confidence_weight: number; // ❌ snake_case 금지
}
// 외부 소스(YAML frontmatter 등) 값이 snake_case여도 domain 타입은 camelCase로 정의하고
// infrastructure 레이어에서 변환한다.
```

### ❌ 자주 하는 실수

```
1. any 타입 사용 → 컴파일 에러 수준으로 금지
2. 도메인 함수 반환 타입 생략 → 반드시 명시
3. 인디케이터 초기 구간을 0 또는 NaN으로 채우기 → null로 채울 것
4. 함수 내부에서 type 선언 → 파일 최상단으로 이동
  ❌ calculateRSI 내부의 type WilderState
  ✅ 파일 최상단에 선언해 다른 함수에서도 재사용 가능하게
5. 상수를 하드코딩하지 않기(매직 넘버에 이름 붙이기) (구현 코드 및 테스트 코드 모두 해당)
  ❌ period = 14
  ✅ RSI_DEFAULT_PERIOD = 14; period = RSI_DEFAULT_PERIOD; (domain/indicators/constants.ts)
  ❌ Array.from({ length: 10 }, ...)
  ✅ Array.from({ length: RSI_DEFAULT_PERIOD - 1 }, ...)
  → 세 가지 패턴 모두 매직 넘버다. 상수가 이미 import되어 있어도 숫자를 직접 쓰면 위반이다.
  [패턴 A] 새 숫자를 선언할 때
    ❌ period = 14   ✅ const period = RSI_DEFAULT_PERIOD;
  [패턴 B] import된 배열·Record 상수의 특정 값을 꺼내 쓸 때
    ❌ result.ma[20]               ✅ result.ma[MA_DEFAULT_PERIODS[0]]
    ❌ calculateMA(bars, 20)       ✅ calculateMA(bars, MA_DEFAULT_PERIODS[0])
    ❌ result.ema[9]               ✅ const period = EMA_DEFAULT_PERIODS[0]; result.ema[period]
  [패턴 C] 테스트 입력 크기(makeBars 인자 등)
    ❌ makeBars(100)               ✅ const TEST_BAR_COUNT = 100; makeBars(TEST_BAR_COUNT)
    → 왜: 100이 어떤 의미의 숫자인지 알 수 없다. 상수 이름이 의도를 설명한다.
6. 상수에서 파생한 포맷팅 결과를 문자열 리터럴로 다시 하드코딩
  상수를 정의했더라도, 그 값을 toFixed() 등으로 포맷팅한 결과를 문자열 리터럴로 쓰면 매직 넘버다.
  상수 값이 바뀌어도 문자열 리터럴은 자동으로 갱신되지 않아 테스트가 silent하게 깨진다.
  ❌ expect(result).toContain('150.00')  // TEST_CLOSE_PRICE = 150.0이 정의되어 있어도
  ✅ expect(result).toContain(TEST_CLOSE_PRICE.toFixed(2))
  계산이 필요한 파생 값은 상수에서 직접 계산해 상수로 추출한다.
  ❌ expect(result).toContain('10.00%')
  ✅ const TEST_CHANGE_RATE_FORMATTED = `${(((TEST_NEXT - TEST_PREV) / TEST_PREV) * 100).toFixed(2)}%`;
     expect(result).toContain(TEST_CHANGE_RATE_FORMATTED);
7. 구조적 위치를 나타내는 배열 인덱스 하드코딩
  배열을 split/slice 등으로 분해한 뒤 특정 위치를 숫자 리터럴로 참조하면 의미를 알 수 없다.
  ❌ result.split('\n\n')[1]
  ✅ const TEST_MARKET_SECTION_INDEX = 1; result.split('\n\n')[TEST_MARKET_SECTION_INDEX]
8. 브라우저/Node 전역 객체명을 변수명으로 사용 → 예약어 충돌 및 ESLint no-shadow 에러 발생
  ❌ const window = closes.slice(...)   ✅ const priceWindow = closes.slice(...)
  → 충돌 주의 대상: window, document, location, event, name, length, screen
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

### ❌ 자주 하는 실수

```
- 'use client' 누락 → Next.js 16 App Router에서 빌드 에러
- Props inline type → 별도 interface로 정의
- 타임프레임을 URL 쿼리 파라미터로 관리 → 클라이언트 상태로만 관리
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

### ❌ 자주 하는 실수

```
- 외부 라이브러리 import → technicalindicators, lodash 등 일체 금지
- Route Handler에서 인디케이터 계산 직접 작성 → domain/indicators에서 import해서 사용
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

### ❌ 자주 하는 실수

```
1. 구현 완료 후 테스트 작성 → 새 파일 생성과 테스트 파일은 항상 같은 커밋에 포함
  → domain/, infrastructure/ 파일 생성과 테스트 파일은 항상 같은 커밋에 포함
  → 기존 파일에서 새 함수를 export할 때도 해당 함수를 직접 테스트하는 케이스를 추가해야 한다
  → 리팩토링으로 추출된 함수라도 간접 검증(상위 래퍼 테스트)만으로는 부족하다
2. 반환 타입 변경 시 테스트 미갱신
  → 타입이 바뀌면 테스트도 반드시 함께 수정
  → nullable 변경(T[] → (T | null)[])은 초기 구간 null 케이스 테스트 필수
3. describe/it 설명을 코드 표현식으로 작성
  ❌ describe('closes.length < period', ...)
  ✅ describe('입력 배열 길이가 period 미만일 때', ...)
  ❌ it('null 반환')
  ✅ it('전부 null인 배열을 반환한다')
4. period 기반 인디케이터에서 초기 구간 null 테스트 케이스 누락
  → 스텁 단계에서 추가해두면 실제 구현 후 회귀 방어 가능
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
    return () => { chart.remove(); }; // ✅ 반드시 호출
}, []);

// ✅ 거래량, RSI 등 별도 pane
chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }, 1); // pane index 1
chart.addSeries(LineSeries, {}, 2); // pane index 2

// ✅ null 값은 WhitespaceData로 변환 (domain의 null을 그대로 전달 금지)
// ❌ { time: '2024-01-01', value: null }
// ✅ { time: '2024-01-01' }  ← WhitespaceData

// ✅ 과거 데이터 추가 로딩 (prepend API 없음)
candleSeries.setData([...newOlderBars, ...existingBars]);
```

### ❌ 자주 하는 실수

```
1. chart.remove() cleanup 누락 → 컴포넌트 재마운트 시 canvas 중복 생성
2. setData를 실시간 업데이트에 사용 → series.update() 사용
3. domain의 null을 그대로 setData에 전달 → WhitespaceData({ time })으로 변환
4. 거래량/RSI를 메인 pane에 추가 → 반드시 별도 pane(index 1, 2...)에 추가
```

---

## Tailwind CSS 규칙

```typescript
// ✅ Tailwind 클래스 사용
<div className="flex items-center gap-4 p-4 bg-gray-900">

// ❌ 인라인 style 금지 (Tailwind로 표현 가능한 경우)
<div style={{ display: 'flex', padding: '16px' }}>

// ✅ 조건부 클래스는 cn 유틸 사용
<div className={cn('base-class', isActive && 'active-class')}>
```

---

## ESLint 규칙

### import/first

모든 `import` 구문은 파일 최상단에 위치해야 한다. `export *` 또는 다른 구문 뒤에 `import`를 쓰면 `import/first` 규칙 위반이다.

```typescript
// ❌ export * 뒤에 import
export * from './rsi';
import { calculateRSI } from './rsi'; // 위반

// ✅ import를 모두 먼저, export는 그 다음
import { calculateRSI } from './rsi';
export * from './rsi';
```

### eol-last (EOF 개행)

모든 파일은 마지막 줄에 개행 문자로 끝나야 한다. Prettier와 ESLint `eol-last` 규칙이 함께 강제한다.

```
❌ 파일 끝에 개행 없음
✅ 파일 마지막 줄 뒤에 \n 한 줄
```

코드 파일뿐 아니라 `.md`, `.yml`, `.json` 등 모든 텍스트 파일에 동일하게 적용된다.

### ❌ 자주 하는 실수

```
1. import/first 위반 — barrel 파일(index.ts)에서 export *를 먼저 쓰고 import를 아래에 작성
   → import를 파일 최상단으로 이동한다
2. EOF 개행 누락 — 특히 수동으로 작성한 .md 파일에서 자주 발생
   → yarn format 실행으로 자동 교정된다
```

---

## 레이어 의존성 규칙

```
domain/         외부 라이브러리 import 금지 — 순수 TypeScript 함수만
infrastructure/ domain만 import 가능
components/     domain만 import 가능 — infrastructure 직접 import 금지
app/            infrastructure, domain 모두 import 가능
```

### ❌ 자주 하는 실수

```
1. domain에서 외부 라이브러리 import → technicalindicators, lodash 등 일체 금지
2. components에서 infrastructure import → AlpacaProvider, claudeClient 등 금지
3. Lightweight Charts를 components/chart/ 밖에서 import
```