# Frontend Fundamentals (FF)

Toss 프론트엔드 챕터의 코드 품질 원칙.
좋은 프론트엔드 코드란 **수정하기 쉬운 코드**다.

원문: https://frontend-fundamentals.com/code-quality/en/code/

---

## 4원칙 개요

```
Readability    읽기 쉬운가
Predictability 동작을 예측할 수 있는가
Cohesion       함께 수정되어야 할 코드가 함께 있는가
Coupling       수정 시 영향 범위가 좁은가
```

4원칙을 동시에 만족하기는 어렵다.
상황에 따라 어떤 원칙을 우선할지 판단하는 것이 핵심이다.

---

## 1. Readability (가독성)

코드를 읽기 쉬운 정도. 수정하려면 먼저 이해해야 한다.
읽는 사람이 한 번에 고려해야 할 컨텍스트가 적을수록, 위에서 아래로 자연스럽게 읽힐수록 좋다.

### 1-A. 동시에 실행되지 않는 코드는 분리한다

```typescript
// ❌ 한 컴포넌트에 서로 다른 역할의 분기가 섞여 있음
function SubmitButton({ isLoading, isSuccess }: Props) {
    if (isLoading) {
        return <LoadingButton />;
    }
    if (isSuccess) {
        return <SuccessButton />;
    }
    return <DefaultButton />;
}

// ✅ 동시에 실행되지 않는 상태를 별도 컴포넌트로 분리
function SubmitButton({ status }: { status: 'idle' | 'loading' | 'success' }) {
    const Button = {
        idle: DefaultButton,
        loading: LoadingButton,
        success: SuccessButton,
    }[status];

    return <Button />;
}
```

### 1-B. 구현 세부사항을 추상화한다

```typescript
// ❌ 컴포넌트가 구현 세부사항을 모두 알고 있음
function LoginStartPage() {
    const { data: user } = useQuery(['user'], fetchUser);
    const isLoggedIn = user !== null && user.token !== null;

    if (isLoggedIn) {
        return <Navigate to="/dashboard" />;
    }
    return <LoginForm />;
}

// ✅ 세부사항을 훅으로 추상화
function useIsLoggedIn() {
    const { data: user } = useQuery(['user'], fetchUser);
    return user !== null && user.token !== null;
}

function LoginStartPage() {
    const isLoggedIn = useIsLoggedIn();

    if (isLoggedIn) {
        return <Navigate to="/dashboard" />;
    }
    return <LoginForm />;
}
```

### 1-C. 복잡한 조건은 이름을 붙인다

```typescript
// ❌ 조건의 의미를 파악하려면 머릿속으로 계산해야 함
if (bars.length >= 14 && closes[closes.length - 1] !== null) {
    // ...
}

// ✅ 조건의 의도가 이름으로 드러남
const hasEnoughDataForRSI = bars.length >= 14;
const hasLatestClose = closes[closes.length - 1] !== null;

if (hasEnoughDataForRSI && hasLatestClose) {
    // ...
}
```

### 1-D. 매직 넘버에 이름을 붙인다

```typescript
// ❌ 14가 무엇을 의미하는지 알 수 없음
const result = new Array(14).fill(null);

// ✅ 의미가 명확함
const RSI_PERIOD = 14;
const result = new Array(RSI_PERIOD).fill(null);
```

### 1-E. 삼항 연산자를 단순하게 유지한다

```typescript
// ❌ 중첩 삼항 연산자는 읽기 어려움
const label = isLoading ? 'Loading...' : isError ? 'Error' : isSuccess ? 'Done' : 'Idle';

// ✅ 조기 반환 또는 객체 맵으로 대체
const statusLabel: Record<Status, string> = {
    loading: 'Loading...',
    error: 'Error',
    success: 'Done',
    idle: 'Idle',
};
const label = statusLabel[status];
```

---

## 2. Predictability (예측 가능성)

이름, 파라미터, 반환값만 보고도 동작을 예측할 수 있는 정도.
일관된 규칙을 따를수록 예측 가능성이 높다.

### 2-A. 이름이 겹치지 않게 관리한다

```typescript
// ❌ 같은 이름이 다른 맥락에서 사용됨
// infrastructure/market/alpaca.ts
export const http = axios.create({ baseURL: 'https://data.alpaca.markets' });

// infrastructure/ai/claude.ts
export const http = axios.create({ baseURL: 'https://api.anthropic.com' });
// → import 시 충돌 발생

// ✅ 맥락을 이름에 포함
export const alpacaHttp = axios.create({ baseURL: 'https://data.alpaca.markets' });
export const claudeHttp = axios.create({ baseURL: 'https://api.anthropic.com' });
```

### 2-B. 같은 종류의 함수는 반환 타입을 통일한다

```typescript
// ❌ 같은 계열의 함수가 반환 타입이 다름
function calculateRSI(closes: number[]): number[] { ... }
function calculateMACD(closes: number[]): MACDResult[] | null { ... }
function calculateBollinger(closes: number[]): BollingerResult[] | undefined { ... }

// ✅ 모든 인디케이터 계산 함수가 동일한 패턴 사용
function calculateRSI(closes: number[], period: number): (number | null)[] { ... }
function calculateMACD(closes: number[]): (MACDResult | null)[] { ... }
function calculateBollinger(closes: number[]): (BollingerResult | null)[] { ... }
```

### 2-C. 숨은 로직을 드러낸다

```typescript
// ❌ 함수 내부에서 예상치 못한 동작이 발생
function calculateIndicators(bars: Bar[]) {
    const closes = bars.map(b => b.close);
    const rsi = calculateRSI(closes);
    // 내부에서 몰래 API 호출 → 호출자가 예측 불가
    sendAnalyticsEvent('indicator_calculated');
    return { rsi };
}

// ✅ 부수효과를 호출자가 명시적으로 제어
function calculateIndicators(bars: Bar[]) {
    const closes = bars.map(b => b.close);
    return { rsi: calculateRSI(closes) };
}

// 호출하는 쪽에서 명시적으로 처리
const indicators = calculateIndicators(bars);
sendAnalyticsEvent('indicator_calculated');
```

---

## 3. Cohesion (응집도)

수정되어야 할 코드가 항상 함께 수정되는 정도.
응집도가 높으면 한 곳을 수정할 때 다른 곳에서 의도치 않은 오류가 발생하지 않는다.

### 3-A. 함께 수정되는 파일은 같은 디렉토리에 둔다

```
// ❌ 관련 파일이 흩어져 있음
src/
├── components/StockChart.tsx
├── hooks/useStockChart.ts
├── types/stockChart.ts
└── utils/stockChartHelpers.ts

// ✅ 함께 수정되는 파일을 같은 디렉토리에 배치
src/
└── components/
    └── chart/
        ├── StockChart.tsx        ← 컴포넌트
        ├── useStockChart.ts      ← 전용 훅
        ├── types.ts              ← 전용 타입
        └── helpers.ts            ← 전용 유틸
```

### 3-B. 매직 넘버를 상수로 응집시킨다

```typescript
// ❌ 같은 값이 여러 곳에 흩어져 있어 하나를 바꾸면 나머지를 놓침
// rsi.ts
const result = new Array(14).fill(null);

// macd.ts
if (closes.length < 14) return null;

// ✅ 한 곳에서 관리
// domain/indicators/constants.ts
export const RSI_DEFAULT_PERIOD = 14;

// rsi.ts
const result = new Array(RSI_DEFAULT_PERIOD).fill(null);
```

---

## 4. Coupling (결합도)

코드를 수정했을 때 영향 범위의 크기.
결합도가 낮을수록 수정 범위를 예측하기 쉽다.

### 4-A. 책임을 하나씩 관리한다

```typescript
// ❌ 하나의 훅이 너무 많은 책임을 가짐
function useStockPage(symbol: string) {
    const [bars, setBars] = useState<Bar[]>([]);
    const [timeframe, setTimeframe] = useState('1Day');
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // 데이터 fetch + 인디케이터 계산 + AI 분석 + 에러 처리 모두 여기서
    // → 하나를 수정하면 전체에 영향
}

// ✅ 책임을 분리
function useBars(symbol: string, timeframe: string) { ... }
function useIndicators(bars: Bar[]) { ... }
function useAnalysis(bars: Bar[], indicators: IndicatorResult) { ... }
```

### 4-B. 중복 코드를 허용한다 (AHA 원칙과 연결)

```typescript
// ❌ 섣부른 추상화로 결합도가 높아진 경우
function useChart(type: 'stock' | 'indicator' | 'volume') {
    // type에 따라 분기가 계속 늘어남
    // → 한 타입의 요구사항이 변경되면 모든 타입에 영향
}

// ✅ 세 번 반복되기 전까지는 중복을 허용
function useStockChart() { ... }
function useIndicatorChart() { ... }
function useVolumeChart() { ... }
// 공통 패턴이 명확해진 후에 추상화
```

### 4-C. Props Drilling을 제거한다

```typescript
// ❌ 중간 컴포넌트가 사용하지 않는 props를 전달만 함
function AnalysisPanel({ symbol, timeframe, bars, indicators, analysis, onReanalyze }) {
    return (
        <AnalysisHeader symbol={symbol} timeframe={timeframe} onReanalyze={onReanalyze} />
        // AnalysisHeader가 bars, indicators를 쓰지 않는데 받아서 전달
    );
}

// ✅ Context 또는 컴포넌트 합성으로 해결
const AnalysisContext = createContext<AnalysisContextValue>(null);

function AnalysisPanel({ children }) {
    return (
        <AnalysisContext.Provider value={...}>
            {children}
        </AnalysisContext.Provider>
    );
}
```

---

## 원칙 간 충돌 시 우선순위 판단

4원칙은 동시에 만족하기 어렵다. 상황에 따라 판단한다.

```
Cohesion vs Readability
└── 함께 수정하지 않으면 버그가 날 가능성이 높다
    → Cohesion 우선 (추상화, 응집)
└── 위험도가 낮다
    → Readability 우선 (중복 허용)

Coupling vs Cohesion
└── 중복 코드를 허용하면 결합도가 낮아지지만 응집도도 낮아짐
    → 변경 빈도와 영향 범위를 고려해서 판단
```

**Siglens 컨텍스트에서의 우선순위**

```
domain/indicators   → Predictability 최우선
                      (같은 계열 함수의 반환 타입 통일, 일관된 null 처리)

components/         → Readability 최우선
                      (차트 컴포넌트는 읽기 쉽게, 조건 분기 최소화)

infrastructure/     → Cohesion 최우선
                      (Provider 교체 시 한 파일만 수정하면 되도록)
```