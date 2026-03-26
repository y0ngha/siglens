# Code Review Guidelines

All review comments must be written in **Korean**.

---

## Coding Paradigm

### Prohibited Patterns
- No `for` / `while` loops → use `map`, `filter`, `reduce`, `flatMap`
- No `let` reassignment → use `const` + new variable
- No direct mutation of arrays/objects → use spread operator
  - ❌ `bars.push(newBar)` → ✅ `[...bars, newBar]`
- No nested conditionals / nested ternaries → use object map or early return
- No classes in domain layer → use pure functions (infrastructure Provider is the exception)
- No pushing to external array inside `reduce` callback → spread into accumulator
  - ❌ `result.push(ema)` → ✅ `return [...acc, ema]`
- No reimplementing the same algorithm → check for existing helpers first
  - Separate `number[]`-based helpers from `Bar[]`-based wrappers for reuse

---

## TypeScript

### Type Rules
- `any` type is prohibited (compile-error level)
- Return types on domain functions must always be declared explicitly
- No type declarations inside functions → move to top of file
  - ❌ `type WilderState` inside `calculateRSI`
  - ✅ Declare at the top of the file
- No inlining union literals with 2+ members in interface fields → extract to a separate type alias
  - ❌ `interface Signal { strength: 'strong' | 'moderate' | 'weak'; }`
  - ✅ `type SignalStrength = 'strong' | 'moderate' | 'weak';`

### Initial Value Rules
- Never fill indicator initial period with `0` or `NaN` → use `null`

### Constants Rules
- No hardcoded literals in implementation code → extract to `domain/indicators/constants.ts`
  - ❌ `period = 14` → ✅ `period = RSI_DEFAULT_PERIOD`
  - ❌ `result.ma[20]` → ✅ `result.ma[MA_DEFAULT_PERIODS[0]]`
  - ❌ `calculateMA(bars, 20)` → ✅ `calculateMA(bars, MA_DEFAULT_PERIODS[0])`
  - Exception: `expect()` values in tests may use literals
- No rewriting constant-derived values as literals in implementation code → they won't update when the constant changes
  - ❌ (impl) `if (label === '150.00') { ... }`
  - ✅ (test) `expect(result).toContain('150.00')`
- No hardcoding array indices that represent structural positions
  - ❌ `result.split('\n\n')[1]`
  - ✅ `const MARKET_SECTION_INDEX = 1; result.split('\n\n')[MARKET_SECTION_INDEX]`

### Naming Rules
- No using browser/Node global object names as variable names (ESLint `no-shadow`)
  - ❌ `const window = closes.slice(...)`
  - ✅ `const priceWindow = closes.slice(...)`
  - Watch out for: `window`, `document`, `location`, `event`, `name`, `length`, `screen`

### Object.fromEntries
- Type assertion required when `Record<K, V>` is needed
  - ❌ `Object.fromEntries(pairs)`
  - ✅ `Object.fromEntries(pairs) as Record<number, (number | null)[]>`

---

## Components

- `'use client'` declaration is required when using `useState` / `useEffect` (missing causes Next.js build error)
- No inline prop types → declare as a separate `type Props = ...` or `interface Props`
- No managing timeframe as a URL query parameter → manage as client state only
- No domain logic directly inside components → extract to hook or domain function
- No default exports → named exports only

---

## Domain Functions

- No importing external libraries (`technicalindicators`, `lodash`, etc. are all prohibited)
- No writing indicator calculations directly in Route Handlers → import from `domain/indicators`
- Domain functions must be pure (no side effects)
- No returning `null` / `undefined` → use Option type or explicit exception handling

---

## Tests

- No missing test file when creating a new file
  - `domain/` and `infrastructure/` files must always be committed with their test files
  - Adding a new exported function to an existing file also requires direct test cases
  - Indirect verification alone is insufficient, even for refactored functions
  - `components/` and `app/` are explicitly excluded — do NOT request or write test files for them
- Tests must be updated whenever return types change
  - Nullable changes (`T[]` → `(T | null)[]`) require a null initial-period test case
- No writing `describe` / `it` descriptions as code expressions
  - ❌ `describe('closes.length < period', ...)`
  - ✅ `describe('입력 배열 길이가 period 미만일 때', ...)`
  - ❌ `it('null 반환')`
  - ✅ `it('전부 null인 배열을 반환한다')`
- No missing initial-period null test case for period-based indicators
  - Adding it at the stub stage guards against regressions after real implementation
- If `jest.setup.ts` exists, do not flag missing environment variables as a bug

---

## Lightweight Charts

- No missing `chart.remove()` cleanup → causes duplicate canvas on component remount
- No using `setData()` for real-time updates → use `series.update()` instead
- No passing domain `null` values directly to `setData()` → convert to `WhitespaceData({ time })`
- No adding volume / RSI to the main pane → always add to a separate pane (index 1, 2, ...)
- Chart logic must be extracted to a dedicated hook outside the component
- No importing Lightweight Charts outside `components/chart/`

---

## Layer Dependencies

Dependency direction: `UI → Application → Domain → Infrastructure`

- No importing external libraries in domain (`technicalindicators`, `lodash`, etc.)
- No importing infrastructure directly in components (`AlpacaProvider`, `claudeClient`, etc.)
- No importing Lightweight Charts outside `components/chart/`
- `@/lib/*` imports are allowed in components (external UI utility wrapper layer — unlike infrastructure)
- Any violation of the dependency direction must be reported as CRITICAL

---

## ESLint

- No writing `export *` before `import` in barrel files (`index.ts`) → move imports to the top
- Missing EOF newline → auto-fixed by running `yarn format`

---

## FF Principles

### Readability
- Function and variable names must clearly describe their behavior
- Magic numbers must be extracted to named constants

### Predictability
- Same input must always produce the same output
- No implicit dependency on global state

### Cohesion
- Code that changes together must live in the same file/module
- No mixing unrelated logic in a single hook or function

### Coupling
- Components must communicate via props / context, not direct dependency
- No sharing types directly across layers → use per-layer DTOs
