# Frontend Fundamentals (FF)

Code quality principles from the Toss Frontend chapter.
Good frontend code is **code that is easy to modify**.

---

## 4 Principles Overview

```
Readability    Is it easy to read?
Predictability Can you predict the behavior?
Cohesion       Is code that should change together, kept together?
Coupling       Is the impact range of a change narrow?
```

It is hard to satisfy all 4 principles simultaneously.
The key is judging which principle to prioritize depending on the situation.

---

## 1. Readability

How easy the code is to read. You must understand it before you can modify it.
The fewer things the reader needs to hold in mind at once, and the more naturally it reads top to bottom, the better.

### 1-A. Separate code that doesn't run simultaneously

```typescript
// ❌ Different roles mixed in one component with branching
function SubmitButton({ isLoading, isSuccess }: Props) {
    if (isLoading) {
        return <LoadingButton />;
    }
    if (isSuccess) {
        return <SuccessButton />;
    }
    return <DefaultButton />;
}

// ✅ Separate states that don't run simultaneously into distinct components
function SubmitButton({ status }: { status: 'idle' | 'loading' | 'success' }) {
    const Button = {
        idle: DefaultButton,
        loading: LoadingButton,
        success: SuccessButton,
    }[status];

    return <Button />;
}
```

### 1-B. Abstract implementation details

```typescript
// ❌ Component knows all implementation details
function LoginStartPage() {
    const { data: user } = useQuery(['user'], fetchUser);
    const isLoggedIn = user !== null && user.token !== null;

    if (isLoggedIn) {
        return <Navigate to="/dashboard" />;
    }
    return <LoginForm />;
}

// ✅ Abstract details into a hook
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

### 1-C. Name complex conditions

```typescript
// ❌ Reader must mentally evaluate the condition to understand it
if (bars.length >= 14 && closes[closes.length - 1] !== null) {
    // ...
}

// ✅ Intent is revealed through the name
const hasEnoughDataForRSI = bars.length >= 14;
const hasLatestClose = closes[closes.length - 1] !== null;

if (hasEnoughDataForRSI && hasLatestClose) {
    // ...
}
```

### 1-D. Name magic numbers

```typescript
// ❌ No way to know what 14 means
const result = new Array(14).fill(null);

// ✅ Meaning is clear
const RSI_PERIOD = 14;
const result = new Array(RSI_PERIOD).fill(null);
```

### 1-E. Keep ternary operators simple

```typescript
// ❌ Nested ternaries are hard to read
const label = isLoading ? 'Loading...' : isError ? 'Error' : isSuccess ? 'Done' : 'Idle';

// ✅ Replace with early return or object map
const statusLabel: Record<Status, string> = {
    loading: 'Loading...',
    error: 'Error',
    success: 'Done',
    idle: 'Idle',
};
const label = statusLabel[status];
```

### 1-F. Write range conditions left to right

When checking whether a value falls within a range, write conditions in the same direction as mathematical notation (b ≤ a ≤ c) — left to right — so the reader can grasp the range at a glance.

```typescript
// ❌ The middle value appears first, causing unnecessary mental effort
if (a >= b && a <= c) { ... }
if (score >= 80 && score <= 100) { ... }

// ✅ Reads naturally left to right, like b ≤ a ≤ c
if (b <= a && a <= c) { ... }
if (80 <= score && score <= 100) { ... }
if (minPrice <= price && price <= maxPrice) { ... }
```

### 1-G. Minimize viewpoint shifts

Every time a reader has to jump between different parts of the code — up and down the file, or across functions and variables — that is a **viewpoint shift**. The more shifts required, the harder the code is to follow.

Write code so it can be read top to bottom, in a single function or file.

```typescript
// ❌ Understanding why Invite is disabled requires 3 jumps:
// policy.canInvite → getPolicyByRole → POLICY_SET
function Page() {
    const user = useUser();
    const policy = getPolicyByRole(user.role);
    return (
        <div>
            <Button disabled={!policy.canInvite}>Invite</Button>
            <Button disabled={!policy.canView}>View</Button>
        </div>
    );
}
function getPolicyByRole(role) { ... }
const POLICY_SET = { admin: ['invite', 'view'], viewer: ['view'] };

// ✅ All logic visible in one place — no jumping required
function Page() {
    const user = useUser();
    const policy = {
        admin:  { canInvite: true,  canView: true },
        viewer: { canInvite: false, canView: true },
    }[user.role];
    return (
        <div>
            <Button disabled={!policy.canInvite}>Invite</Button>
            <Button disabled={!policy.canView}>View</Button>
        </div>
    );
}
```

### 1-H. Don't group functions by logic type

Don't create a function or hook just because it handles the same *type* of logic (e.g. "all query params for this page"). A function whose responsibility is "everything of type X" will grow without bound and become hard to understand.

```typescript
// ❌ usePageState manages ALL query params — responsibility is unbounded
export function usePageState() {
    const [query, setQuery] = useQueryParams({
        cardId: NumberParam,
        statementId: NumberParam,
        dateFrom: DateParam,
        dateTo: DateParam,
        statusList: ArrayParam,
    });
    // grows every time a new query param is added
}

// ✅ Each hook owns exactly one concern — clear name, narrow scope
export function useCardIdQueryParam() {
    const [cardId, _setCardId] = useQueryParam('cardId', NumberParam);
    const setCardId = useCallback((cardId: number) => {
        _setCardId({ cardId }, 'replaceIn');
    }, []);
    return [cardId ?? undefined, setCardId] as const;
}

---

## 2. Predictability

How well you can predict behavior just from the name, parameters, and return value.
The more consistently rules are followed, the higher the predictability.

### 2-A. Avoid name collisions

```typescript
// ❌ Same name used in different contexts
// infrastructure/market/alpaca.ts
export const http = axios.create({ baseURL: 'https://data.alpaca.markets' });

// infrastructure/ai/claude.ts
export const http = axios.create({ baseURL: 'https://api.anthropic.com' });
// → import collision

// ✅ Include context in the name
export const alpacaHttp = axios.create({ baseURL: 'https://data.alpaca.markets' });
export const claudeHttp = axios.create({ baseURL: 'https://api.anthropic.com' });
```

### 2-B. Unify return types across functions of the same family

```typescript
// ❌ Same family of functions with different return types
function calculateRSI(closes: number[]): number[] { ... }
function calculateMACD(closes: number[]): MACDResult[] | null { ... }
function calculateBollinger(closes: number[]): BollingerResult[] | undefined { ... }

// ✅ All indicator calculation functions follow the same pattern
function calculateRSI(closes: number[], period: number): (number | null)[] { ... }
function calculateMACD(closes: number[]): (MACDResult | null)[] { ... }
function calculateBollinger(closes: number[]): (BollingerResult | null)[] { ... }
```

### 2-C. Expose hidden logic

```typescript
// ❌ Unexpected behavior occurs inside the function
function calculateIndicators(bars: Bar[]) {
    const closes = bars.map(b => b.close);
    const rsi = calculateRSI(closes);
    // Hidden API call → caller cannot predict this
    sendAnalyticsEvent('indicator_calculated');
    return { rsi };
}

// ✅ Caller explicitly controls side effects
function calculateIndicators(bars: Bar[]) {
    const closes = bars.map(b => b.close);
    return { rsi: calculateRSI(closes) };
}

// Caller handles side effects explicitly
const indicators = calculateIndicators(bars);
sendAnalyticsEvent('indicator_calculated');
```

---

## 3. Cohesion

How consistently code that needs to change together actually changes together.
High cohesion means modifying one place doesn't cause unexpected errors elsewhere.

### 3-A. Keep files that change together in the same directory

```
// ❌ Related files scattered across the project
src/
├── components/StockChart.tsx
├── hooks/useStockChart.ts
├── types/stockChart.ts
└── utils/stockChartHelpers.ts

// ✅ Files that change together placed in the same directory
src/
└── components/
    └── chart/
        ├── StockChart.tsx        ← component
        ├── useStockChart.ts      ← dedicated hook
        ├── types.ts              ← dedicated types
        └── helpers.ts            ← dedicated utils
```

### 3-B. Centralize magic numbers as constants

```typescript
// ❌ Same value scattered across files — changing one means missing the others
// rsi.ts
const result = new Array(14).fill(null);

// macd.ts
if (closes.length < 14) return null;

// ✅ Managed in one place
// domain/indicators/constants.ts
export const RSI_DEFAULT_PERIOD = 14;

// rsi.ts
const result = new Array(RSI_DEFAULT_PERIOD).fill(null);
```

### 3-C. Match form cohesion to the unit of change

When building forms, the right cohesion level depends on **what unit of change you expect**.

**Field-level cohesion** — each field owns its own validation logic independently.
Choose this when fields have unique validation rules, need async validation, or may be reused across forms.

```tsx
// Each field's validation lives with that field
<input {...register('email', { validate: value => isValidEmail(value) ? '' : 'Invalid email' })} />
```

**Form-level cohesion** — all fields are validated together in a single schema.
Choose this when all fields belong to one business unit (e.g. payment info), or fields are interdependent (e.g. password confirmation).

```tsx
// All validation centralized in a schema
const schema = z.object({
    name:  z.string().min(1, 'Required'),
    email: z.string().email('Invalid email'),
});
```

The key question: **does change happen field-by-field, or does the whole form change together?**

---

## 4. Coupling

The size of the impact range when code is modified.
Lower coupling means the scope of changes is easier to predict.

### 4-A. Manage one responsibility at a time

```typescript
// ❌ One hook carrying too many responsibilities
function useStockPage(symbol: string) {
    const [bars, setBars] = useState<Bar[]>([]);
    const [timeframe, setTimeframe] = useState('1Day');
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // data fetch + indicator calculation + AI analysis + error handling all here
    // → modifying one thing affects everything
}

// ✅ Separate responsibilities
function useBars(symbol: string, timeframe: string) { ... }
function useIndicators(bars: Bar[]) { ... }
function useAnalysis(bars: Bar[], indicators: IndicatorResult) { ... }
```

### 4-B. Allow duplicate code (connected to the AHA principle)

```typescript
// ❌ Premature abstraction increases coupling
function useChart(type: 'stock' | 'indicator' | 'volume') {
    // branching keeps growing with type
    // → changing one type's requirements affects all types
}

// ✅ Allow duplication until the pattern repeats three times
function useStockChart() { ... }
function useIndicatorChart() { ... }
function useVolumeChart() { ... }
// Abstract only after the common pattern becomes clear
```

### 4-C. Remove Props Drilling

```typescript
// ❌ Intermediate component passes props it doesn't use
function AnalysisPanel({ symbol, timeframe, bars, indicators, analysis, onReanalyze }) {
    return (
        <AnalysisHeader symbol={symbol} timeframe={timeframe} onReanalyze={onReanalyze} />
        // AnalysisHeader doesn't use bars or indicators but receives them anyway
    );
}

// ✅ Solve with Context or component composition
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

## Priority Judgment When Principles Conflict

All 4 principles are hard to satisfy simultaneously. Judge based on the situation.

```
Cohesion vs Readability
└── High risk of bugs if not changed together
    → Prioritize Cohesion (abstraction, grouping)
└── Low risk
    → Prioritize Readability (allow duplication)

Coupling vs Cohesion
└── Allowing duplicate code lowers coupling but also lowers cohesion
    → Judge based on change frequency and impact range
```

**Priority in the Siglens context**

```
domain/indicators   → Predictability first
                      (unified return types across same-family functions, consistent null handling)

components/         → Readability first
                      (chart components should be easy to read, minimize conditional branching)

infrastructure/     → Cohesion first
                      (replacing a Provider should require modifying only one file)
```