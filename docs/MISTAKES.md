# Common Mistakes

Mistakes that Claude Code repeatedly makes.
Review before implementation and ensure these are not repeated.

(When adding content to this document, please be sure to write it in English.)

---

## Coding Paradigm

```
1. Using for/while loops
   → Replace with map, filter, reduce, flatMap

2. let reassignment
   → Use const + new variable

3. Directly mutating original arrays/objects
   → Use spread operator
   ❌ bars.push(newBar)     ✅ [...bars, newBar]

4. Nested conditionals / nested ternaries
   → Use object map or early return

5. Using classes in domain
   → Replace with pure functions (infrastructure Provider is the exception)

6. Pushing to external array inside reduce callback
   → Spread into accumulator instead
   ❌ result.push(ema)      ✅ return [...acc, ema]

7. Reimplementing the same algorithm
   → Check for existing helpers before writing a new function
   → Separate number[]-based helpers from Bar[]-based wrappers for reuse
```

---

## TypeScript

```
1. Using any type
   → Prohibited at compile-error level

2. Omitting return types on domain functions
   → Always declare explicitly

3. Filling indicator initial period with 0 or NaN
   → Use null

4. Declaring types inside functions
   → Move to top of file
   ❌ type WilderState inside calculateRSI
   ✅ Declare at the top of the file

5. Inlining union literals with 2+ members in interface fields
   → Extract to a separate type alias
   ❌ interface Signal { strength: 'strong' | 'moderate' | 'weak'; }
   ✅ type SignalStrength = 'strong' | 'moderate' | 'weak';
      interface Signal { strength: SignalStrength; }

6. Hardcoding literals in implementation code
   → Extract to constants (domain/indicators/constants.ts)
   ❌ period = 14
   ✅ period = RSI_DEFAULT_PERIOD

   [Pattern A] Declaring a new value
   ❌ period = 14                    ✅ const period = RSI_DEFAULT_PERIOD

   [Pattern B] Referencing a specific value from an array or Record constant
   ❌ result.ma[20]                  ✅ result.ma[MA_DEFAULT_PERIODS[0]]
   ❌ calculateMA(bars, 20)          ✅ calculateMA(bars, MA_DEFAULT_PERIODS[0])

   [Pattern C] Test input values (only extract constants when context matters)
   ❌ makeBars(100)                  ✅ const TEST_BAR_COUNT = 100; makeBars(TEST_BAR_COUNT)
   ✅ provider.analyze('test prompt') // meaningless scaffolding → literal allowed

7. Rewriting constant-derived values as literals in implementation code
   → They won't update when the constant changes
   → expect() values in tests may use literals
   ❌ (impl) if (label === '150.00') { ... }
   ✅ (test) expect(result).toContain('150.00')

8. Hardcoding array indices that represent structural positions
   ❌ result.split('\n\n')[1]
   ✅ const MARKET_SECTION_INDEX = 1; result.split('\n\n')[MARKET_SECTION_INDEX]

9. Using browser/Node global object names as variable names
   → ESLint no-shadow error
   ❌ const window = closes.slice(...)
   ✅ const priceWindow = closes.slice(...)
   Watch out for: window, document, location, event, name, length, screen

10. Return type mismatch with Object.fromEntries
    → Type assertion required when Record<K, V> is needed
    ❌ Object.fromEntries(pairs)
    ✅ Object.fromEntries(pairs) as Record<number, (number | null)[]>
```

---

## Components

```
1. Missing 'use client'
   → Next.js 16 build error when useState/useEffect is used

2. Inline prop types
   → Define as a separate interface

3. Managing timeframe as a URL query parameter
   → Manage as client state only
```

---

## Domain Functions

```
1. Importing external libraries
   → technicalindicators, lodash, etc. are all prohibited

2. Writing indicator calculations directly in Route Handlers
   → Import and use from domain/indicators
```

---

## Tests

```
1. Missing test file when creating a new file
   → domain/ and infrastructure/ files must always be committed with their test files
   → Add direct test cases when exporting a new function from an existing file
   → Indirect verification alone is insufficient even for refactored functions
   → components/ and app/ are explicitly excluded — do NOT request or write test files for them

2. Not updating tests when return type changes
   → Tests must be updated whenever types change
   → Nullable changes (T[] → (T | null)[]) require a null initial-period test case

3. Writing describe/it descriptions as code expressions
   ❌ describe('closes.length < period', ...)
   ✅ describe('입력 배열 길이가 period 미만일 때', ...)
   ❌ it('null 반환')
   ✅ it('전부 null인 배열을 반환한다')

4. Missing initial-period null test case for period-based indicators
   → Adding it at the stub stage guards against regressions after real implementation
```

---

## Lightweight Charts

```
1. Missing chart.remove() cleanup
   → Duplicate canvas on component remount

2. Using setData for real-time updates
   → Use series.update() instead

3. Passing domain null values directly to setData
   → Convert to WhitespaceData({ time })

4. Adding volume/RSI to the main pane
   → Always add to a separate pane (index 1, 2, ...)
```

---

## ESLint

```
1. import/first violation
   → Writing export * before import in barrel files (index.ts)
   → Move imports to the top of the file

2. Missing EOF newline
   → Auto-fixed by running yarn format
```

---

## Layer Dependencies

```
1. Importing external libraries in domain
   → technicalindicators, lodash, etc. are all prohibited

2. Importing infrastructure in components
   → AlpacaProvider, claudeClient, etc. are prohibited

3. Importing Lightweight Charts outside components/chart/

4. Importing @/lib/* in components is allowed
   → lib/ is the external UI utility wrapper layer (cn, etc.)
   → Unlike infrastructure, components may import from lib/
```