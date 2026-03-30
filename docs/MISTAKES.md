# Common Mistakes

Mistakes that Claude Code repeatedly makes.
Review before implementation and ensure these are not repeated.

(When adding content to this document, please be sure to write it in English.)

---

## Coding Paradigm

```
1. Using for/while/forEach loops for data transformation
   → Replace with map, filter, reduce, flatMap
   → Exception: side-effect-only iteration (e.g. calling a chart API on each element
     with no return value) may use forEach or for...of
   → Prefer for...of over forEach when the loop body is non-trivial or has multiple statements
   ❌ for (let i = 0; i < closes.length; i++) result.push(closes[i] * 2)
   ✅ closes.map(c => c * 2)
   ✅ periodsToRemove.forEach(p => chart.removeSeries(seriesRef.current[p]))  // side-effect only
   ✅ for (const p of periodsToRemove) { chart.removeSeries(seriesRef.current[p]); }  // preferred for multi-statement

2. Using reduce for side-effect-only iteration (no accumulator)
   → reduce<void> with an unused accumulator is semantically misleading
   → Use forEach or for...of instead
   ❌ items.reduce<void>((_acc, item) => { sideEffect(item); }, undefined)
   ✅ for (const item of items) { sideEffect(item); }

3. let reassignment
   → Use const + new variable

4. Directly mutating original arrays/objects
   → Use spread operator
   ❌ bars.push(newBar)     ✅ [...bars, newBar]

5. Nested conditionals / nested ternaries
   → Use object map or early return

6. Using classes in domain
   → Replace with pure functions (infrastructure Provider is the exception)

7. Pushing to external array inside reduce callback
   → Spread into accumulator instead
   ❌ result.push(ema)      ✅ return [...acc, ema]

8. Reimplementing the same algorithm
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

11. Missing fields in domain interface that exist in the data source (e.g. YAML frontmatter)
    → Rule: CONVENTIONS.md TypeScript Rules — interface fields must faithfully represent the data structure
    → When a new field is parsed in infrastructure (e.g. pattern, display), add it to the domain interface immediately
    ❌ interface Skill { id: string; type: string; }  // missing pattern?, display?
    ✅ interface Skill { id: string; type: string; pattern?: string; display?: SkillDisplay; }

12. Related interfaces with shared fields not linked by extends
    → Rule: FF.md Cohesion 3-A — code that changes together must stay together
    → If interface B contains all fields of interface A plus extras, declare B extends A
    ❌ interface PatternResult { patternName: string; skillName: string; ...; renderConfig: ... }
    ✅ interface PatternResult extends PatternSummary { renderConfig: ... }

13. Type or schema defined in the wrong layer, or duplicated without compile-time enforcement
    → Rule: FF.md Cohesion 3-A — code that changes together must stay together
    → If a type in layer A is structurally identical to a type in layer B, do not redefine it; import and reuse it
    → If a string array or object must stay in sync with an interface, use Record<keyof Interface, ...> to enforce the relationship at compile time
    → If a field belongs to a specific layer's concern (e.g. route-level degradation flag), do not put it on a shared domain type; extend the domain type in that layer instead
    ❌ interface AnalyzeRequest { bars: Bar[]; timeframe: string }  // duplicates AnalyzeVariables in app layer
    ❌ const ANALYSIS_REQUEST = ['patterns', 'skills', ...]         // manually synced string array
    ❌ interface AnalysisResponse { skillsDegraded?: boolean }      // route-layer concern on a domain type
    ✅ use AnalyzeVariables directly in route.ts
    ✅ const ANALYSIS_RESPONSE_SCHEMA: Record<keyof AnalysisResponse, string> = { ... }
    ✅ interface AnalyzeRouteResponse extends AnalysisResponse { skillsDegraded?: boolean }
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

4. Using new Date() directly in a Server Component
   → Server renders at request time; client hydrates later — year/time can mismatch
   → Extract into a 'use client' component (e.g. <CurrentYear />) so the value is
     always read on the client, or add suppressHydrationWarning to the wrapper element
   ❌ (RSC) <span>{new Date().getFullYear()}</span>
   ✅ (client component) export default function CurrentYear() { return <>{new Date().getFullYear()}</>; }

5. Calling side effects inside setState updater functions
   → Updaters run twice in React Strict Mode; side effects must be placed outside the updater
   → Rule: FF.md Predictability 2-C — updater functions must be pure
   ❌ setVisiblePatterns(prev => { onCallback?.(); return next; })
   ✅ const willBeVisible = !visiblePatterns.has(id);
      setVisiblePatterns(prev => { ... return next; });
      onCallback?.(willBeVisible);

6. Reading stale closure state instead of using functional setState
   → Deriving next state from a closed-over variable risks stale state on rapid updates
   → Rule: Vercel React Best Practices — rerender-functional-setstate
   → Also ensure willBeVisible / derived values are computed before the setState call
   ❌ const next = new Set(visiblePatterns); setVisiblePatterns(next);
   ✅ setVisiblePatterns(prev => { const next = new Set(prev); ...; return next; });

7. Nesting interactive elements (button-in-button / interactive-in-interactive)
   → HTML spec: interactive content cannot be placed inside <button>
   → WAI-ARIA: an element with an interactive role cannot contain other interactive elements
   → Browser auto-corrects the DOM, causing unexpected event behavior
   → Fix: make the outer wrapper a non-interactive container (e.g. flex div) and place
     each interactive element (accordion toggle, eye icon) as siblings
   ❌ <button onClick={handleToggle}><button onClick={handleEye}>...</button></button>
   ❌ <div role="button" onClick={handleToggle}><button onClick={handleEye}>...</button></div>
   ✅ <div className="flex"><button onClick={handleToggle}>...</button><button onClick={handleEye}>...</button></div>
```

---

## Domain Functions

```
1. Importing external libraries
   → technicalindicators, lodash, etc. are all prohibited

2. Writing indicator calculations directly in Route Handlers
   → Import and use from domain/indicators

3. Hidden selection/filtering rules left implicit in specs or comments
   → FF.md Predictability 2-C: expose hidden logic explicitly
   → If a constant (e.g. EMA_DEFAULT_PERIODS) is a superset and only a subset
     is used per timeframe, state that rule in the spec
   → If a comment describes when/why code runs, it must match the actual runtime
     behavior (e.g. do not say "may still be loading" when the data is guaranteed loaded)
   ❌ EMA_DEFAULT_PERIODS = [9, 20, 21, 60] with no note on per-timeframe filtering
   ✅ Spec explicitly states: 1Min uses [9, 21]; 5Min–1Day uses [20, 60]
   ❌ // bars may still be loading  (written inside a Suspense-guaranteed mount)
   ✅ // bars are guaranteed loaded because this component only mounts after useSuspenseQuery resolves
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

3. Adding a new field to a type/interface without a corresponding test case
   → Every new field must have at least one it() case that verifies its presence or value
   → Applies to both domain types and API response types
   ❌ Add patternSummaries/skillResults to AnalysisResponse with no array-verification test
   ❌ Add riskLevel to ANALYSIS_REQUEST schema with no field-inclusion test
   ✅ it('patternSummaries 배열을 반환한다', () => { expect(Array.isArray(result.patternSummaries)).toBe(true); })

4. Writing describe/it descriptions as code expressions
   ❌ describe('closes.length < period', ...)
   ✅ describe('입력 배열 길이가 period 미만일 때', ...)
   ❌ it('null 반환')
   ✅ it('전부 null인 배열을 반환한다')

5. Missing initial-period null test case for period-based indicators
   → Adding it at the stub stage guards against regressions after real implementation

6. Test file uses only 2-level structure (describe → it) instead of required 3 levels
   → Rule: CONVENTIONS.md Test Structure — describe(subject) → describe(context) → it(behavior) is mandatory
   → Add an intermediate context describe block between the top-level describe and its it() cases
   ❌ describe('GeminiProvider — API 키 미설정', () => { it('throws', ...) })
   ✅ describe('GeminiProvider', () => { describe('API 키 미설정 상태에서', () => { it('throws', ...) }) })

7. Provider pair has asymmetric error handling or logging behavior
   → Rule: FF.md Predictability 2-B — sibling functions/classes in the same family must behave consistently
   → When one Provider adds error detail (cause, console.error), apply the same change to all Providers
   ❌ GeminiProvider: catch (error) { throw new Error('...', { cause: error }); console.error(...) }
      ClaudeProvider: catch { throw new Error('...') }  // cause and console.error missing
   ✅ Both Providers use identical catch patterns with cause and console.error
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