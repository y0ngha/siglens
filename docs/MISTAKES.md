# Common Mistakes

Mistakes that Claude Code repeatedly makes.
Review before implementation and ensure these are not repeated.

(When adding content to this document, please be sure to write it in English.)

---

## Coding Paradigm

```
0. Repeating hardcoded literals and values in multiple locations
   → Extract to a single const and reference it in all places
   → Rule: FF.md Cohesion 3-B — same values defined in multiple places create maintenance risk
   → Common pattern: min/max values, array indices, magic numbers, CSS custom property defaults
   ❌ aria-valuemin={240} in component A, aria-valuemin={240} in component B, but PANEL_MIN_WIDTH = 240 in utils
   ✅ export const PANEL_MIN_WIDTH = 240; import and use in both places
   ❌ const arr = [1, 2, 3]; const first = arr[0]; const last = arr[2];  // indices hardcoded
   ✅ const INDEX_FIRST = 0; const INDEX_LAST = 2; const first = arr[INDEX_FIRST]; const last = arr[INDEX_LAST];

1. Using for/while/forEach loops for data transformation
   → Prefer map, filter, reduce, flatMap for simple data transformation
   → Exception: side-effect-only iteration (e.g. calling a chart API on each element
     with no return value) may use forEach or for...of
   → Prefer for...of over forEach when the loop body is non-trivial or has multiple statements
   → Avoid imperative loops with index reassignment (let i = 0; while (i < length) i++) even when building complex state machines
   → Exception: for (let i = 0; ...) is acceptable when it provides a clear advantage in time complexity,
     performance, or readability — e.g. sliding window algorithms where .slice() inside .map() produces O(n²),
     or algorithms where index arithmetic is central to the logic
   → Recurring issue: seen at least 2 times in PR #154 (Ichimoku useIchimokuOverlay.ts) and PR #162 (buildUniqueIds in confidence.ts)
   ❌ for (let i = 0; i < closes.length; i++) result.push(closes[i] * 2)
   ✅ closes.map(c => c * 2)
   ❌ let i = 0; while (i < lines.length) { ... i++; }
   ✅ lines.reduce((acc, line, idx) => { ... }, initialState)
   ❌ futureCloudData.forEach((point, j) => { ... })  // multiple const declarations, conditionals inside — prefer for...of
   ✅ for (const point of futureCloudData) { ... }
   ❌ items.map((item) => { mutatingCounter[itemId]++; return transformed(item); })  // side effect mutating closure — prefer for...of
   ✅ const ids = []; for (const item of items) { ids[itemId]++; } return ids;
   ✅ periodsToRemove.forEach(p => chart.removeSeries(seriesRef.current[p]))  // side-effect only
   ✅ for (const p of periodsToRemove) { chart.removeSeries(seriesRef.current[p]); }  // preferred for multi-statement
   ✅ for (let i = 0; i + period <= values.length; i++) { ... }  // sliding window — O(n) preferred over O(n²) with .slice() in .map()

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
   → Across provider pairs (ClaudeProvider, GeminiProvider): Extract shared logic to infrastructure/ai/utils.ts
   ❌ MARKDOWN_CODE_BLOCK_PATTERN defined in both claude.ts and gemini.ts
   ✅ Define once in infrastructure/ai/utils.ts and import in both providers

8.5. Identical values queried or computed multiple times in a single function
   → Extract to a local const or assign once before using repeatedly
   → Rule: FF.md Readability 1-A — computing the same value twice reduces readability and adds unnecessary expense
   → Common pattern: map.get(key) called twice, function called twice, selector result reused
   ❌ const skill1 = skillByName.get(p.skillName); ... ; const skill2 = skillByName.get(p.skillName); // same key, two calls
   ✅ const skill = skillByName.get(p.skillName); ... ; // one call, reused
   ❌ items.map(item => { const val = compute(item); return val || compute(item); })  // compute called twice
   ✅ items.map(item => { const val = compute(item); return val || fallback; })
   ❌ map callback computing `senkouA !== null && senkouB !== null` check on every element when identical 3+ times in the same function
   ✅ const hasValues = senkouA !== null && senkouB !== null; then reference hasValues in all places

9. Discarding the callback parameter and re-accessing the same element via external array index
   → Rule: FF.md Readability 1-G — viewpoint shift forces the reader to track two locations simultaneously
   → map/filter/reduce callbacks already receive the current element as a parameter; use it directly
   → Also applies to addEventListener callbacks: avoid iterating over external array with index when the callback param already provides the element
   ❌ lines.reduce((acc, _line, idx) => { const line = lines[idx]; ... })
   ❌ items.filter((_, ci) => { const item = outerArray[offset + ci]; ... })
   ❌ newElements.forEach((_, idx) => { const label = labels[idx]; ... })  // ResizeObserver callback
   ✅ lines.reduce((acc, line) => { ... })
   ✅ items.filter(item => { ... })
   ✅ for (const [label, element] of labelPairs) { ... }  // pre-zip arrays and use for...of

9.5. Leaving logic that has no effect
   → Rule: FF.md Readability 1-B — logic with no practical effect adds noise and obscures intent
   → Common pattern: filter/map operations that don't change the result, catch-all conditions that never execute, redundant assignments
   → Each code layer should contribute meaningful logic; remove anything that has no functional impact
   ❌ const results = data.flatMap(...).filter(x => x.id === uniqueId);  // uniqueId is guaranteed from flatMap
   ✅ const results = data.flatMap(...)  // remove the .filter() that never filters
   ❌ try { ... } catch (e) { logError(e); }  // error is never expected and catch adds confusion
   ✅ Remove the catch block if it doesn't serve error recovery
   ❌ if (bars.length < period) return null; // then below in map: sma(tpSlice, period) always succeeds so null check is dead code
   ✅ Remove the early return if the computation that follows guarantees the condition is impossible

9.6. Range condition written with variable on left and boundary on right (e.g. bar.low >= bucketLow)
   → Rule: FF.md 1-F — range conditions must follow mathematical notation: smaller value on left, larger on right
   → Order value comparisons to match number line: value <= item <= value (left to right, increasing)
   → This makes the code self-documenting and parallels mathematical notation (a ≤ x ≤ b)
   ❌ bar.low >= bucketLow          // variable on left, boundary on right
   ✅ bucketLow <= bar.low          // boundary on left, variable on right
   ❌ row.price >= result.val       // value on left, boundary on right
   ✅ result.val <= row.price       // boundary on left, value on right
   ❌ if (bar.close < minPrice || bar.close > maxPrice) {}  // mixed order
   ✅ if (minPrice > bar.close || bar.close > maxPrice) {}  // consistent order

9.7. Nested functions inside larger functions that implicitly capture parent scope variables
   → Rule: FF.md Predictability 2-C — hidden dependencies should be explicit parameters
   → Extract nested functions to module-level and pass captured variables as explicit parameters so dependencies are visible at call site
   ❌ function calculateVolumeProfile(...) { function expandValueArea(...) { use bucketVolumes, rowSize, targetVolume from parent scope } ... expandValueArea() }
   ✅ function expandValueArea(bucketVolumes, rowSize, targetVolume, state) { ... }  // extracted to module level, explicit params
   ✅ function calculateVolumeProfile(...) { ... expandValueArea(bucketVolumes, rowSize, targetVolume, state) }

10. Repeating identical filtering/calculation logic across multiple blocks
    → Rule: FF.md Cohesion 3-B — same values computed in multiple places must be extracted to single source of truth
    → When the same filter, map, or computation appears 2+ times, extract to useMemo (hooks) or const (regular code)
    ❌ useEffect(() => { const filtered = items.filter(x => x.active); ... }, []);
       useEffect(() => { const filtered = items.filter(x => x.active); setOther(filtered); }, []);
    ✅ const filtered = useMemo(() => items.filter(x => x.active), [items]);
       useEffect(() => { ... filtered ... }, [filtered]);
       useEffect(() => { setOther(filtered); }, [filtered]);

11. Repeating identical className ternary or computed styles across multiple elements
    → Rule: FF.md Readability 1-A — identical results computed multiple times should be extracted
    → When the same cn() or style computation appears 3+ times, extract to a helper function
    ❌ <button className={active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}>MA</button>
       <button className={active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}>EMA</button>
       <button className={active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}>BB</button>
    ✅ const buttonClass = (active: boolean) => cn(active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black');
       <button className={buttonClass(active)}>MA</button>
       <button className={buttonClass(active)}>EMA</button>
       <button className={buttonClass(active)}>BB</button>

11.4. Pure utility functions (non-hook helpers) defined in hook files instead of utils/ subfolder
    → Rule: CONVENTIONS.md Component Folder Structure — hooks/ contain React hooks only; pure functions belong in utils/
    → When a pure function (map callback, build function, transform helper) is defined alongside a hook in the same file, move it to utils/
    → This enables reuse in other files and maintains clear layer separation: hooks call utils, components import from both
    → Recurring issue: seen at least 3 times across PR #122 (Ichimoku), PR #121 (VolumeProfile), and PR #124 (SkillPanel) — pure functions always belong in utils/ subfolder
    ❌ useIchimokuOverlay.ts defines buildCloudData (pure function) alongside hook logic
    ❌ useVolumeProfileOverlay.ts defines extendWithFutureCloud (non-hook helper) and FutureCloudBase type
    ❌ AnalysisPanel.tsx defines parseStructuredSummary (pure function) inside component file
    ✅ Extract buildCloudData, extendWithFutureCloud, and related types to src/components/chart/utils/ichimokuUtils.ts
    ✅ Extract parseStructuredSummary to src/components/analysis/utils/parseStructuredSummary.ts
    ✅ useIchimokuOverlay.ts imports and calls these utils without defining them

11.5. Tight coupling between interface props and dependent files due to repeated props pattern
    → Rule: FF.md Coupling 4-A — when adding a feature, 2+ files must be updated simultaneously
    → Extract tightly-coupled prop pairs into a single grouped type
    → Example: Each new indicator required adding 2 props (xyzVisible, onXyzToggle) to IndicatorToolbarProps and updating StockChart.tsx call site; creates maintenance burden where indicator + UI + parent call sites are tightly bonded
    ❌ IndicatorToolbarProps = { bollingerVisible, onBollingerToggle, macdVisible, onMacdToggle, rsiVisible, onRsiToggle, dmiVisible, onDmiToggle, ... }  // 12 props, 6 pairs
    ✅ Group into IndicatorToggleGroup = { visible, onToggle }; then IndicatorToolbarProps = { bollinger: IndicatorToggleGroup, macd, rsi, dmi }  // 4 props total

11.6. Extracting complex anonymous expressions into simple named helpers
    → Rule: FF.md Readability 1-E — extracting an IIFE or complex multi-statement ternary to a named function improves predictability
    → When computation of final value involves multiple statements, intermediate variables, or conditional branches in a ternary/IIFE, extract to a named helper
    ❌ const value = (() => { const x = compute1(); const y = compute2(); return x + y; })()  // IIFE: reader must parse multiple lines to understand result
    ✅ const value = computeValue()  // named function
    ❌ render = condition ? (() => { ... 10 lines of computation ... })() : null  // IIFE in ternary: hard to scan
    ✅ render = condition ? renderComplexContent() : null
```

12. Using template literals with inline ternary for conditional classes instead of cn()
    → Rule: CONVENTIONS.md — conditional classNames must use cn() utility
    → Rule: FF.md Predictability 2-A — consistent pattern for all conditional styling
    → Mixing `` `... ${condition ? '...' : '...'}` `` and cn() patterns creates inconsistency
    ❌ className={`flex ... ${period === 20 ? 'bg-blue' : 'bg-gray'}`}
    ✅ className={cn('flex ...', period === 20 ? 'bg-blue' : 'bg-gray')}

13. Derived constants (objects, maps) recreated on every render without memoization
    → Rule: FF.md Cohesion 3-B — constants that never change should be extracted or memoized
    → If a value is derived from props/state but its identity doesn't need to change (only content does),
      wrap with useMemo to avoid unnecessary re-creation and triggering dependent effects
    ❌ const buttonRefMap = { indicator1: useRef(), indicator2: useRef() };  // recreated every render
    ✅ const buttonRefMap = useMemo(() => ({ indicator1: useRef(), indicator2: useRef() }), [])
    ❌ const handlers = { onClick: handleClick, onChange: handleChange };  // recreated every render
    ✅ const handlers = useMemo(() => ({ onClick: handleClick, onChange: handleChange }), [])
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

5.5. Using `as` type assertions instead of type guards
   → Rule: CONVENTIONS.md — type assertions bypass type safety and hide assumptions
   → Use narrowing with `typeof`, `in`, `instanceof`, or discriminated unions instead
   → Exception: DOM element types where runtime narrowing is infeasible (e.g. HTMLCanvasElement)
   → Exception: Third-party library return types where a generic parameter is missing from the library's type
     definition and runtime narrowing is therefore impossible
     (e.g. lightweight-charts addSeries() omits the UTCTimestamp generic parameter in its return type —
      as ISeriesApi<'Candlestick', UTCTimestamp> is acceptable here; add a comment explaining the reason)
   ❌ (CANDLE_PATTERN_LABELS as Record<string, string>)[patternName]  // assertion bypasses type safety
   ✅ findCandlePatternLabel(patternName) with `in` operator checks for single/multi pattern membership
   ❌ const label = map as Map<string, string>  // assertion without verification
   ✅ if (map instanceof Map) { ... use map as Map ... }  // type guard + usage together

5.7. Indicator result types defined in indicator files instead of domain/types.ts
   → Rule: CONVENTIONS.md type co-location — all indicator result types belong in domain/types.ts for consistency
   → Indicator files should import types from domain/types, not define their own
   ❌ IchimokuFuturePoint defined in ichimoku.ts
   ✅ IchimokuFuturePoint moved to domain/types.ts; ichimoku.ts imports from domain/types

6. Hardcoding literals in implementation code
   → Extract to constants (domain/indicators/constants.ts or @/components/chart/constants)
   ❌ period = 14
   ✅ period = RSI_DEFAULT_PERIOD

   [Pattern A] Declaring a new value
   ❌ period = 14                    ✅ const period = RSI_DEFAULT_PERIOD
   ❌ const MIN_CONFIDENCE = 0.5     ✅ const MIN_CONFIDENCE_WEIGHT = 0.5  // at module level in utils.ts, not local to function

   [Pattern B] Referencing a specific value from an array or Record constant
   ❌ result.ma[20]                  ✅ result.ma[MA_DEFAULT_PERIODS[0]]
   ❌ calculateMA(bars, 20)          ✅ calculateMA(bars, MA_DEFAULT_PERIODS[0])

   [Pattern C] Chart styling constants
   ❌ lineWidth: 1                   ✅ lineWidth: DEFAULT_LINE_WIDTH  // import from @/components/chart/constants

   [Pattern D] Test input values (only extract constants when context matters)
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

11.5. Object shapes declared as type instead of interface
     → Rule: CONVENTIONS.md TypeScript Rules — object shapes must use interface
     → interface is structural and extensible; type is nominal and rigid
     → When describing an object shape (even a simple one), use interface
     ❌ type CandlePatternEntry = { patternType: 'single' | 'multi'; barIndex: number; ... }
     ✅ interface CandlePatternEntry { patternType: 'single' | 'multi'; barIndex: number; ... }

11.7. Unused type imports and missing type imports
     → Rule: TypeScript — imports must match actual usage
     → Type that is declared in import but never used in code triggers TS6196 (unused import)
     → Type that is used in annotation but not imported triggers TS2304 (not found) or TS7044 (implicit any)
     → When using explicit type annotations in callbacks or variables, the type must be imported
     → When a type is imported but TypeScript infers the type automatically, remove the unnecessary import
     ❌ import type { VolumeProfileResult } from '...'; // declared but never used in variable/parameter annotations
     ✅ Remove the unused import
     ❌ const result: VolumeProfileResult | null  // but VolumeProfileResult not imported
     ✅ import type { VolumeProfileResult } from '@/domain/...'

11.8. Missing type import for types used in annotations
     → Rule: TypeScript — all types used in explicit annotations must be imported
     → When a callback's implicit type matches the parameter, the import is unnecessary (TypeScript infers automatically)
     → When forcing explicit type annotations on a variable or parameter, the type must be imported
     ❌ const result: VolumeProfileResult | null  // TS2304: VolumeProfileResult not found
     ✅ import type { VolumeProfileResult } from '@/domain/indicators/volume-profile';
        const result: VolumeProfileResult | null = calculateVolumeProfile(bars);

12. Implementation and documentation changes not synchronized
    → Rule: CONVENTIONS.md — when implementation changes structure/counts, update docs/DOMAIN.md and docs/DESIGN.md accordingly
    → When new constants are added (colors, dimensions, etc.), verify they are documented in the relevant design docs
    → When function signatures, return types, or component props change, update DOMAIN.md descriptions immediately
    ❌ Ichimoku indicator implementation uses 5 LineSeries but DOMAIN.md documents 3
    ✅ Update DOMAIN.md to reflect actual implementation: 5 series (Tenkan/Kijun/Senkou A/Senkou B/Chikou)
    ❌ Add new color constants for an indicator but forget to list them in DESIGN.md's indicator color reference
    ✅ Update DESIGN.md indicator color section immediately after adding colors.ts constants

14. Related interfaces with shared fields not linked by extends
    → Rule: FF.md Cohesion 3-A — code that changes together must stay together
    → If interface B contains all fields of interface A plus extras, declare B extends A
    ❌ interface PatternResult { patternName: string; skillName: string; ...; renderConfig: ... }
    ✅ interface PatternResult extends PatternSummary { renderConfig: ... }

15. Callback parameter type annotations missing when TypeScript cannot infer from context
    → Rule: CONVENTIONS.md TypeScript Rules — explicit type annotation is required when TypeScript cannot infer the callback parameter type from context
    → When the array element type is a plain named type already in scope, TypeScript infers it — annotation is optional
    → When the element type is a derived type (Omit<...>, Pick<...>, intersection, etc.), TypeScript cannot infer it — annotation is required
    → The index parameter must also be annotated (`: number`) when it is used alongside a non-inferrable element type
    ❌ analysis.patternSummaries.map((p, index): PatternResult => { ... })  // p not inferrable — annotation required
    ❌ analysis.skillResults.map((r, index) => ({ ... }))                  // r not inferrable — annotation required
    ✅ analysis.patternSummaries.map((p: Omit<PatternSummary, 'confidenceWeight' | 'id'>, index: number): PatternResult => { ... })
    ✅ analysis.skillResults.map((r: Omit<SkillResult, 'confidenceWeight' | 'id'>, index: number): SkillResult => ({ ... }))

16. Type or schema defined in the wrong layer, or duplicated without compile-time enforcement
    → Rule: FF.md Cohesion 3-A — code that changes together must stay together
    → If a type in layer A is structurally identical to a type in layer B, do not redefine it; import and reuse it
    → If a string array or object must stay in sync with an interface, use Record<keyof Interface, ...> to enforce the relationship at compile time
    → If a field belongs to a specific layer's concern (e.g. route-level degradation flag), do not put it on a shared domain type; extend the domain type in that layer instead
    → When domain types have raw vs. enriched variants (e.g. AnalysisResponse with/without confidence), use separate types to reflect actual API contracts
    ❌ interface AnalyzeRequest { bars: Bar[]; timeframe: string }  // duplicates AnalyzeVariables in app layer
    ❌ const ANALYSIS_REQUEST = ['patterns', 'skills', ...]         // manually synced string array
    ❌ interface AnalysisResponse { skillsDegraded?: boolean }      // route-layer concern on a domain type
    ❌ interface AIProvider { analyze(): AnalysisResponse }         // AI returns raw response without confidenceWeight
    ✅ use AnalyzeVariables directly in route.ts
    ✅ const ANALYSIS_RESPONSE_SCHEMA: Record<keyof AnalysisResponse, string> = { ... }
    ✅ interface AnalyzeRouteResponse extends AnalysisResponse { skillsDegraded?: boolean }
    ✅ type RawAnalysisResponse = Omit<AnalysisResponse, 'confidenceWeight'>
       interface AIProvider { analyze(): RawAnalysisResponse }
```

---

## Components

```
1. Missing 'use client'
   → Next.js 16 build error when useState/useEffect is used

2. Inline prop types
   → Define as a separate interface
   → Props interface must be placed directly above the component function
   → Rule: CONVENTIONS.md — maintains viewpoint locality; FF.md 1-G
   ❌ type Props = {...}; function ComponentA() {...} function ComponentB() {...} function MyComponent(props: Props) {...}
   ✅ type Props = {...}; function MyComponent(props: Props) {...}

3. Props interface separated from component by other definitions (type aliases, helpers, sub-components)
   → Props interface must be immediately above the component function it describes
   → Rule: FF.md 1-G — viewpoint shift when readers must jump past intermediate definitions to find component
   → Rule: CONVENTIONS.md — all supporting types/helpers go above the Props interface, not between Props and component
   ❌ type PropsType = {...}; function Helper() {...} function MyComponent(props: PropsType) {...}  // Helper interrupts the Props-Component relationship
   ✅ function Helper() {...}; type PropsType = {...}; function MyComponent(props: PropsType) {...}  // Props immediately precedes component

4. Managing timeframe as a URL query parameter
   → Manage as client state only

5. Using new Date() directly in a Server Component
   → Server renders at request time; client hydrates later — year/time can mismatch
   → Extract into a 'use client' component (e.g. <CurrentYear />) so the value is
     always read on the client, or add suppressHydrationWarning to the wrapper element
   ❌ (RSC) <span>{new Date().getFullYear()}</span>
   ✅ (client component) export default function CurrentYear() { return <>{new Date().getFullYear()}</>; }

6. Calling side effects inside setState updater functions
   → Updaters run twice in React Strict Mode; side effects must be placed outside the updater
   → Rule: FF.md Predictability 2-C — updater functions must be pure
   ❌ setVisiblePatterns(prev => { onCallback?.(); return next; })
   ✅ const willBeVisible = !visiblePatterns.has(id);
      setVisiblePatterns(prev => { ... return next; });
      onCallback?.(willBeVisible);

7. Reading stale closure state instead of using functional setState
   → Deriving next state from a closed-over variable risks stale state on rapid updates
   → Rule: Vercel React Best Practices — rerender-functional-setstate
   → Also ensure willBeVisible / derived values are computed before the setState call
   ❌ const next = new Set(visiblePatterns); setVisiblePatterns(next);
   ✅ setVisiblePatterns(prev => { const next = new Set(prev); ...; return next; });

8. Nesting interactive elements (button-in-button / interactive-in-interactive)
   → HTML spec: interactive content cannot be placed inside <button>
   → WAI-ARIA: an element with an interactive role cannot contain other interactive elements
   → Browser auto-corrects the DOM, causing unexpected event behavior
   → Fix: make the outer wrapper a non-interactive container (e.g. flex div) and place
     each interactive element (accordion toggle, eye icon) as siblings
   ❌ <button onClick={handleToggle}><button onClick={handleEye}>...</button></button>
   ❌ <div role="button" onClick={handleToggle}><button onClick={handleEye}>...</button></div>
   ✅ <div className="flex"><button onClick={handleToggle}>...</button><button onClick={handleEye}>...</button></div>

9. External callback prop in useEffect dependency array causes infinite loops
   → useEffectEvent is required to prevent re-execution when callback reference changes
   → Rule: FF.md Predictability 2-C — hidden behavior (infinite loop on callback change) must be explicit
   → Rule: CONVENTIONS.md Custom Hook Rules — callback props must be wrapped in useEffectEvent
   ❌ const StockChart = ({ onPatternOverlay }) => {
         useEffect(() => { onPatternOverlay(...); }, [onPatternOverlay]); // loop if caller passes inline function
      };
   ✅ const StockChart = ({ onPatternOverlay }) => {
         const notifyPatternOverlay = useEffectEvent((info) => onPatternOverlay?.(info));
         useEffect(() => { notifyPatternOverlay(...); }, [visiblePatterns]); // callback excluded
      };

10. useState lazy initializer derives value from props
   → Initializer only runs once; prop changes are not reflected in state
   → Use useEffect to synchronize state when prop-derived initial values are needed
   → Rule: FF.md Predictability 2-C — state should match props after prop update
   ❌ const [visible, setVisible] = useState(() => computeFromProps(props.items));
      // if props.items changes, visible remains stale
   ✅ const [visible, setVisible] = useState<Set<string>>(new Set());
      useEffect(() => {
        setVisible(new Set(props.items.filter(item => item.detected).map(item => item.id)));
      }, [props.items]);
      // or use useReducer with dispatch({ type: 'reset', payload: newItems })

11. Missing aria-expanded attribute on accordion triggers
    → Accordion toggle elements (role="button" or <button>) must declare aria-expanded when managing hidden content
    → Rule: ARIA spec — interactive controls that toggle visibility must expose state to screen readers
    → Applies to both custom div[role="button"] and native <button> accordion triggers
    ❌ <div role="button" onClick={toggle}>Trigger</div><div className={isOpen ? '' : 'hidden'}>Content</div>
    ✅ <div role="button" onClick={toggle} aria-expanded={isOpen}>Trigger</div><div hidden={!isOpen}>Content</div>
    ❌ <button onClick={toggle}>Trigger</button><div className={isOpen ? '' : 'hidden'}>Content</div>
    ✅ <button onClick={toggle} aria-expanded={isOpen}>Trigger</button><div hidden={!isOpen}>Content</div>

12. Component managing its own external margin or parent depending on child's internal layout
    → Components must not hardcode their own external margins (margin, mb-2, etc.)
    → Parents must not depend on children's internal structure or layout direction
    → Rule: DESIGN.md — each component is responsible for its own internal layout; external spacing belongs to the caller
    → Rule: FF.md Coupling 4-A — components should not create tight coupling through layout expectations
    ❌ export function DetectedBadge() { return <div className="mb-2">...</div>; }  // hardcodes external margin
    ❌ <div className="flex-col md:flex-row"><ChartContent /></div>  // parent controls child's internal layout
    ✅ export function DetectedBadge() { return <div>...</div>; }  // layout is caller's responsibility
    ✅ export function ChartContent() { return <div className="flex-col md:flex-row">...</div>; }  // child owns its layout
       <SymbolPageClient />  // caller adds margin as needed

12.5. Unused Tailwind classes (dead CSS)
    → Remove classes that have no effect in the current DOM context
    → Rule: CONVENTIONS.md — unnecessary classes clutter code and reduce readability
    → grid classes (col-span-2, grid-cols-3, etc.) have no effect on flex containers
    → Always verify the parent container's layout model before applying layout-specific classes
    ❌ <div className="flex flex-col"><div className="col-span-2">Content</div></div>  // col-span-2 has no effect on flex
    ✅ <div className="flex flex-col"><div>Content</div></div>  // remove grid-specific classes from flex children

12.6. Repeated cursor/interaction styling classes across components
    → Extract repeated cursor and interaction patterns to global styles
    → Rule: CONVENTIONS.md — repeated patterns must be globalized (AHA principle: 2+ repetitions = extract)
    → Rule: FF.md Cohesion 3-B — same styling logic defined in multiple places creates maintenance burden
    ❌ AnalysisPanel: className="cursor-pointer"
       TimeframeSelector: className="cursor-pointer"
       SymbolSearch: className="cursor-pointer"
    ✅ (globals.css) @layer base { button { @apply cursor-pointer disabled:cursor-not-allowed; } }
       Remove cursor-pointer from individual components

12.7. Props declared but not connected to callbacks (latent bugs)
    → Rule: FF.md Coupling 4-A — if a callback prop exists, it must actually be connected and invoked
    → When props are declared but callbacks are not chained together, the feature is dead code and will confuse maintainers
    → Recurring issue: seen at least 2 times (PR #144 pattern visibility toggles not wired, PR #128 prompt builder skill coupling)
    ❌ Component declares onPatternVisibilityChange prop but never calls it anywhere
    ❌ StockChart accepts onPatternOverlayChange but Parent component doesn't pass it
    ✅ Declare prop, pass callback from parent, and invoke callback when state changes
    ❌ prompt.ts includes skill-specific trend instructions hardcoded instead of delegating to skill definitions
    ✅ prompt.ts includes range-generic instruction; each skill's instructions in skill frontmatter is the source of truth

13. Repeating identical JSX structure across multiple render blocks
    → Rule: FF.md Readability 1-A — identical JSX repeated 2+ times should be data-driven
    → Extract to a data array + .map() pattern instead of hardcoding duplicates
    → Rule: FF.md Cohesion 3-B — related JSX structures belong in single rendering logic
    ❌ <div>{dropdownA && <Dropdown config={configA} />}</div>
       <div>{dropdownB && <Dropdown config={configB} />}</div>
       <div>{dropdownC && <Dropdown config={configC} />}</div>
    ✅ const dropdowns = [configA, configB, configC];
       {dropdowns.map(config => <div key={config.id}>{config.visible && <Dropdown config={config} />}</div>)}

14. Implementing DOM event listener logic directly in useEffect instead of extracting to custom hook
    → Rule: FF.md Cohesion 3-A — reusable patterns must be extracted to custom hooks
    → Rule: CONVENTIONS.md Custom Hook Rules — event listener patterns (click outside, escape key, etc.) must be custom hooks
    → useOnClickOutside, useEscapeKey, etc. are common abstractions that belong in hooks/
    ❌ useEffect(() => {
         const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target)) close(); };
         document.addEventListener('mousedown', handler);
         return () => document.removeEventListener('mousedown', handler);
       }, []);
    ✅ const useOnClickOutside = (ref: RefObject<HTMLElement>, callback: () => void) => {
         useEffect(() => {
           const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target)) callback(); };
           document.addEventListener('mousedown', handler);
           return () => document.removeEventListener('mousedown', handler);
         }, [callback]);
       };
       // Usage: useOnClickOutside(ref, onClose);

15. Inline styles used for dynamic runtime values without CSS custom properties
    → Rule: DESIGN.md and CONVENTIONS.md — inline styles are prohibited unless for dynamic domain values impossible to express in Tailwind
    → For runtime-determined pixel values or chart colors (CHART_COLORS), use CSS custom properties with Tailwind arbitrary-value syntax
    → Always add a comment explaining why the exception is necessary
    ❌ <aside style={{ width: `${panelWidth}px` }} />
    ✅ <aside style={{ '--panel-width': `${panelWidth}px` } as React.CSSProperties} className="md:w-[var(--panel-width)]">
       // width is runtime-determined from drag state, cannot be expressed as static Tailwind class

16. Custom hook hook declaration order violation in component files
    → Rule: CONVENTIONS.md Custom Hook Declaration Order — hooks must be called in this order:
       1. useState / useReducer
       2. useRef
       3. useCallback / useMemo
       4. External custom hooks (useQuery, useOnClickOutside, etc.)
       5. useEffect
    → When external custom hooks are called after useState/useCallback, their dependencies on state become implicit and order-dependent
    → Common violation: usePanelResize() called after getAnalysisStatus() derived value calculation
    ❌ const status = getAnalysisStatus(); const { ... } = usePanelResize();  // derived calc before custom hook
    ✅ const { ... } = usePanelResize(); const status = getAnalysisStatus();  // custom hook first, then derivations
    ❌ const state = useState(...); const handler = useCallback(...); useDragListener(...); useEffect(...)  // listener hook order wrong
    ✅ const state = useState(...); useDragListener(...); const handler = useCallback(...); useEffect(...)  // listener hook before useCallback

16.5. Custom hook params missing optional properties that are used in composition
     → Rule: CONVENTIONS.md Custom Hook Rules — all overlay and chart interaction hooks must accept consistent parameter patterns
     → When multiple hooks in the same family (e.g. overlay hooks: useMAOverlay, useBollingerOverlay, useVolumeProfileOverlay)
       accept the same optional parameters (e.g. lineWidth), all hooks must declare the parameter in their interface
     → Absence of a parameter in one hook while present in others breaks DRY and creates inconsistent API
     ❌ UseBollingerOverlayParams { lineWidth?: LineWidth } but UseVolumeProfileOverlayParams { } (missing lineWidth)
     ✅ All overlay hook params include lineWidth?: LineWidth with DEFAULT_LINE_WIDTH as function default
     ❌ useMAOverlay receives { lineWidth?: LineWidth } param
        useVolumeProfileOverlay hardcodes DEFAULT_LINE_WIDTH without accepting param
     ✅ useVolumeProfileOverlay({ ..., lineWidth = DEFAULT_LINE_WIDTH }) matches useMAOverlay pattern

17. Builder or helper functions tightly coupled to specific domain implementations
    → Rule: FF.md Coupling 4-A — high-level functions must not hard-code domain-specific values or terminology
    → When a utility function (prompt builder, configuration builder, etc.) contains hard-coded terminology
      or logic specific to one domain concept (e.g. Elliott Wave wave assessment, specific skill instructions),
      extract that domain-specific logic to the source (e.g. skill frontmatter) instead
    → Each domain concept should be the single source of truth (SSOT) for its own rules and terminology
    ❌ buildAnalysisRequest hardcodes Elliott Wave-specific instructions ("motive wave", "corrective wave")
    ✅ Each skill's ## AI Analysis Instructions section is the SSOT; builder uses generic approach
    ❌ IndicatorToolbarProps lists all indicator prop pairs (bollingerVisible/onBollingerToggle, macdVisible/onMacdToggle, ...)
       adding a new indicator requires changes in 4+ places (interface, component, parent caller, constant arrays)
    ✅ Group related props: IndicatorToggleGroup { visible, onToggle } then map over indicator list
```

---

## Domain Functions

```
0.5. Using const arrow functions for domain exports instead of function declarations
     → Rule: domain/CLAUDE.md — Always use `export function` (named function declaration)
     → Arrow function expressions lack hoisting and violate domain layer convention
     → Applies to both public exports and private module-level helpers
     ❌ export const buildPatternIds = <T, K extends keyof T>(items: T[], key: K): string[] => { ... }
     ✅ export function buildPatternIds<T, K extends keyof T>(items: T[], key: K): string[] { ... }
     ❌ const expandValueArea = (state: State) => { ... }  // private helper with arrow syntax
     ✅ function expandValueArea(state: State) { ... }    // private helper with declaration

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

4. Silent fallback without exposing degradation to caller
   → Rule: FF.md Predictability 2-C — hidden failures must be explicit
   → If a critical operation fails silently (e.g. skills loading, provider instantiation),
     caller must be informed via response field or error thrown
   → .catch(() => []) hides the failure; caller has no way to know degraded state occurred
   ❌ skillsLoader.loadSkills().catch(() => [])  // caller doesn't know skills failed to load
   ✅ .catch((error) => { console.error('Skills load failed', error); return []; })
      + include skillsDegraded: true in response for route handlers
   ❌ new ClaudeProvider() directly instantiated when AI_PROVIDER env says to use Gemini
   ✅ createAIProvider() helper that respects environment variable

5. Multi-candle and single-candle patterns both shown for the same bar
   → Rule: FF.md Cohesion 3-B — related data should use consistent filtering rules
   → When a multi-candle pattern (bullish_engulfing, morning_star, etc.) is detected on a bar,
     single-candle patterns (hammer, doji, etc.) on the same bar or bars involved in the multi-candle should be suppressed
   → This prevents visual/text clutter where one bar is annotated with both pattern types
   ❌ buildCandlePatternEntries returns entries where barsAgo=0 has both singlePattern ('hammer') and multiPattern ('bullish_engulfing')
   ✅ Filter out single-candle entries whose barsAgo matches any bar involved in a detected multi-candle pattern

6. Ichimoku Cloud future projection missing or bullish/bearish distinction ignored
   → Rule: DOMAIN.md Ichimoku Cloud spec — Kumo (cloud) consists of SenkouA/B projected 26 bars forward (displacement)
   → Bullish cloud (SenkouA >= SenkouB) and bearish cloud (SenkouA < SenkouB) must be rendered with distinct colors
   → When adding Ichimoku overlay, ensure both conditions are met:
     1. Future cloud: append displacement (26) additional points beyond the current bar for forward projection
     2. Cloud color: filter bullish/bearish segments separately and use distinct fill colors for each
   ❌ calculateIchimoku returns only bars.length data points; no future cloud rendered
   ❌ Cloud color defined but never applied to bullish/bearish segments; all cloud rendered same color
   ✅ calculateIchimokuFutureCloud extends results with displacement (26) future points
   ✅ useIchimokuOverlay separates bullish/bearish AreaSeries with ichimokuCloudBullish/Bearish colors

7. Skill markdown files using invalid `type: indicator_guide` instead of omitting the field
   → Rule: DOMAIN.md Skill File Format — `type` field is only valid when set to 'pattern'; no other types are defined
   → When type is not 'pattern', omit the `type` field entirely instead of adding a custom value
   → Invalid type values cause the loader to treat type as undefined, creating confusion and potential future bugs
   ❌ skills/strategies/ma-cycle.md: `type: indicator_guide` in frontmatter (undefined behavior)
   ❌ skills/indicators/*.md (13 files): `type: indicator_guide` in frontmatter (batch inconsistency)
   ✅ Remove the `type: indicator_guide` line; omit type field when not 'pattern'

7.5. Missing mandatory fields in skill markdown files
     → Rule: DOMAIN.md Skill File Format — all required interface fields must be declared in frontmatter and body
     → When a domain type declares a field as mandatory (not optional), that field must be present in all instances
     → Skill markdown sections (e.g. `## AI Analysis Instructions`) must include all required fields for nested types
     ❌ Signal instructions in markdown omit `strength: SignalStrength` field even though Signal interface requires it
     ✅ Every Signal instruction includes all 3+ fields: signal, direction, strength (and any other mandatory fields)
     ❌ Pattern type enum accepts only ['pattern'] but instructions use invalid values like 'strategy'
     ✅ Verify skill type field matches SkillType enum: either 'pattern' or omit the field entirely
```

---

## Tests

```
1. Missing test file when creating a new file
   → domain/ and infrastructure/ files must always be committed with their test files
   → Add direct test cases when exporting a new function from an existing file
   → Indirect verification alone is insufficient even for refactored functions
   → components/ and app/ are not required to have tests, but writing tests for them is allowed

2. Not updating tests when return type changes
   → Tests must be updated whenever types change
   → Nullable changes (T[] → (T | null)[]) require a null initial-period test case

3. Adding a new field to a type/interface without a corresponding test case
   → Every new field must have at least one it() case that verifies its presence or value
   → Applies to both domain types and API response types
   → When a field is optional, explicitly verify both the presence and absence cases
   ❌ Add patternSummaries/skillResults to AnalysisResponse with no array-verification test
   ❌ Add riskLevel to ANALYSIS_REQUEST schema with no field-inclusion test
   ❌ interface Skill { pattern?: string }  // added but test only checks populated case, not undefined case
   ✅ it('patternSummaries 배열을 반환한다', () => { expect(Array.isArray(result.patternSummaries)).toBe(true); })
   ✅ it('pattern: 미존재 시 undefined를 반환한다', () => { expect(result.pattern).toBeUndefined(); })

3.5. New indicator or feature added without corresponding test cases for all calculation/formatting methods
   → When adding a new domain/infrastructure indicator (e.g. Stochastic), all related functions must have test coverage
   → Applies to both the calculation function (e.g. calculateStochastic) and integration tests (e.g. formatIndicatorSection)
   → Rule: CONVENTIONS.md and MISTAKES.md — 100% coverage target for domain and infrastructure
   ❌ Add calculateStochastic to domain/indicators but no test cases in stochastic.test.ts
   ❌ Add formatIndicatorSection support for stochastic but no test case in prompt.test.ts for stochastic formatting
   ✅ When adding a new indicator, write test cases for the calculation function AND any integration points (formatting, pane labeling, etc.)

4. Writing describe/it descriptions as code expressions
   ❌ describe('closes.length < period', ...)
   ✅ describe('입력 배열 길이가 period 미만일 때', ...)
   ❌ it('null 반환')
   ✅ it('전부 null인 배열을 반환한다')

5. Missing initial-period null test case for period-based indicators
   → Adding it at the stub stage guards against regressions after real implementation

5.5. Test structure not following describe(subject) → describe(context) → it(behavior) nesting
   → Rule: CONVENTIONS.md Test Rules — each test file must use exactly 3 levels of describe blocks before it()
   → subject (module/function name) at level 1, context (condition/scenario) at level 2, behavior (expected outcome) at level 3
   → Fewer levels (subject → behavior, skipping context) requires adding a context layer
   → Additional intermediate wrappers (e.g. describe('buildAnalysisPrompt') between subject and context) must be removed
   ❌ describe('prompt') { describe('buildAnalysisPrompt') { describe(context) { it(...) } } }  // 4 levels, intermediate wrapper
   ✅ describe('prompt') { describe(context) { it(...) } }  // 3 levels: subject implicit in file, context explicit, behavior
   ❌ describe('subject') { it('behavior') }  // 2 levels, missing context layer
   ✅ describe('subject') { describe('when context') { it('behavior') } }  // 3 levels

6. [REMOVED — no longer a violation. Test structure allows 2–5 levels per CONVENTIONS.md]

7. beforeEach/beforeAll placed at module level instead of inside describe block
   → Rule: CONVENTIONS.md Test Rules — all setup code must be inside the relevant describe block for consistency
   → Module-level setup (outside describe) is invisible to readers scanning the test structure
   → Violates test cohesion principle: setup should be near its corresponding test cases
   ❌ beforeEach(() => { mockFetch.mockReset(); });
      describe('postAnalyze 함수는', () => { it('...', ...) })
   ✅ describe('postAnalyze 함수는', () => {
        beforeEach(() => { mockFetch.mockReset(); });
        it('...', ...)
      })

8. [REMOVED — no longer a violation. Test structure allows 2–5 levels per CONVENTIONS.md]

9. Test file exceeds 5-level describe nesting
   → Rule: CONVENTIONS.md Test Structure — 2 to 5 levels allowed, 6+ levels prohibited
   → Excessive nesting obscures test intent
   → When context is tightly coupled with subject, merge into describe text instead of adding a separate layer
   ❌ describe('a') { describe('b') { describe('c') { describe('d') { describe('e') { describe('f') { it('...') } } } } } }  // 6 levels
   ✅ Keep at 5 levels or fewer by merging context into describe text

10. Boundary test constant redefined locally instead of imported from source
   → Rule: MISTAKES.md TypeScript Rule 6 — hardcoded boundary values must be extracted to constants.ts
   → When a test file uses a boundary value (e.g. RSI_DEFAULT_PERIOD = 14, HIGH_CONFIDENCE_WEIGHT = 0.8),
     it must import the constant from domain, not redeclare it locally
   → Local redeclaration breaks when the constant changes; importing ensures test stays in sync
   ❌ (confidence.test.ts) const TEST_HIGH_CONFIDENCE = 0.8; // then expect(result.confidence >= TEST_HIGH_CONFIDENCE)
   ✅ (confidence.test.ts) import { HIGH_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants'; expect(result.confidence >= HIGH_CONFIDENCE_WEIGHT)

11. Missing edge case test coverage when refactoring or moving functions
   → Rule: Tests Rule 1 — domain/ and infrastructure/ code must always have direct test coverage
   → When a function is refactored or moved to a different file, all edge cases tested upstream must also be verified directly in its new test file
   → Indirect testing through upstream consumers is insufficient; each module must test its own edge cases
   → Common patterns: function moved from module A to module B, but edge case tests remain only in A.test.ts
   ❌ stripMarkdownCodeBlock moved to utils.ts, but text-before/after edge case only tested in claude.test.ts
   ❌ readFile rejection path in Promise.all context, but rejection case not tested in loader.test.ts
   ✅ (utils.test.ts) it('코드 블록 앞뒤의 텍스트를 제거한다', () => { expect(stripMarkdownCodeBlock('text```code```text')).toBe('code'); })
   ✅ (loader.test.ts) describe('readFile 에러 발생 시', () => { it('에러를 전파한다', () => { ... expect(loadSkills()).rejects.toThrow() }) })

11.7. Unconditional assertion in test when expected data is guaranteed to be detected
   → Rule: FF.md Predictability 2-C — each it block must verify its behavior unconditionally
   → When test data is constructed to guarantee a specific outcome (e.g. bullish_engulfing pattern formation),
     assertion should not be wrapped in a conditional that allows the test to pass without verification
   → If statement guards hide incomplete test execution; the test should fail if the expected behavior doesn't occur
   ❌ if (result.includes('Multi-candle pattern:')) { expect(result).toMatch('bullish_engulfing'); }  // test passes without assertion if pattern not detected
   ✅ expect(result).toMatch('bullish_engulfing');  // unconditional assertion; test fails if pattern missing

12. Test duplication or incomplete coverage of edge cases
   → Rule: Test Layer Rules — each it() block must test exactly one behavior; avoid duplicate assertion blocks
   → Rule: CONVENTIONS.md — domain/ layer requires 100% branch coverage, including all edge cases
   → When a function has multiple branches or boundary conditions, each branch must be tested directly
   → Duplicate tests that verify identical behavior consume coverage budget and obscure intent
   ❌ describe('기본 파라미터') { 
        it('profile 길이는 기본 rowSize와 같다', () => { expect(result).toHaveLength(VP_DEFAULT_ROW_SIZE); });
        it('rowSize 미지정 시 기본값 반환', () => { expect(result).toHaveLength(VP_DEFAULT_ROW_SIZE); });  // identical assertion
      }
   ✅ describe('기본 파라미터') {
        it('rowSize 미지정 시 VP_DEFAULT_ROW_SIZE 크기의 profile을 반환한다', () => { expect(result).toHaveLength(VP_DEFAULT_ROW_SIZE); });
      }
   ❌ Branch with priceRange === 0 has no test coverage despite existing in implementation
   ✅ describe('모든 bars의 high와 low가 동일할 때') {
        it('null을 반환한다', () => { expect(calculateVolumeProfile(...)).toBeNull(); });
      }

13. Provider pair has asymmetric error handling or logging behavior
   → Rule: FF.md Predictability 2-B — sibling functions/classes in the same family must behave consistently
   → When one Provider adds error detail (cause, console.error), apply the same change to all Providers
   ❌ GeminiProvider: catch (error) { throw new Error('...', { cause: error }); console.error(...) }
      ClaudeProvider: catch { throw new Error('...') }  // cause and console.error missing
   ✅ Both Providers use identical catch patterns with cause and console.error

14. New Provider implementation missing test cases that exist in sibling Provider
   → Rule: FF.md Predictability 2-B — sibling classes in the same family must have symmetric test coverage
   → When a new Provider is added, all it() cases present in the existing Provider must be replicated
   → Applies to field-presence checks (e.g. 'skillsDegraded' in result), error cases, and structural assertions
   → Common gap: markdown code block stripping edge cases (text before/after the block)
   ❌ ClaudeProvider: it('skillsDegraded 필드를 포함하지 않는다', ...)
      GeminiProvider: (missing)
   ✅ Both Providers have identical test cases covering the same behaviors and field assertions

15. Provider pair has inconsistent naming conventions
   → Rule: FF.md Predictability 2-A — sibling classes must use consistent terminology
   → When two Providers define the same concept (e.g. system instructions), use identical naming
   ❌ claude.ts: const CLAUDE_SYSTEM_PROMPT
      gemini.ts: const GEMINI_SYSTEM_INSTRUCTION  // different term ("PROMPT" vs "INSTRUCTION")
   ✅ claude.ts: const CLAUDE_SYSTEM_PROMPT
      gemini.ts: const GEMINI_SYSTEM_PROMPT  // consistent term
   ❌ Define identical string in both files
   ✅ Extract to infrastructure/ai/utils.ts as AI_SYSTEM_PROMPT and import in both

16. Repeated identical parameter object passed to multiple function calls
   → Rule: FF.md Readability 1-A — identical values computed multiple times should be extracted
   → Rule: FF.md Cohesion 3-B — shared parameters should be a single source of truth
   → When the same parameter object is passed to 2+ functions, extract to const (regular code) or useMemo (hooks)
   ❌ useMAOverlay({ chartRef, bars, indicators, lineWidth })
      useEMAOverlay({ chartRef, bars, indicators, lineWidth })
      useBollingerOverlay({ chartRef, bars, indicators, lineWidth })
   ✅ const commonHookParams = { chartRef, bars, indicators, lineWidth };
      useMAOverlay(commonHookParams)
      useEMAOverlay(commonHookParams)
      useBollingerOverlay(commonHookParams)

17. Mixing imperative for loops and functional transforms in same function
   → Rule: FF.md Readability 1-A — consistent paradigm reduces cognitive load
   → When a function performs data transformation, use map/filter/reduce throughout; do not mix with imperative loops
   → Exception: separate setup phase (object construction for side effects) from transform phase (data mapping)
   ❌ const multiEntryMap = {}; for (const entry of entries) { multiEntryMap[key] = value; }  // then extends.map()
   ✅ const multiEntryMap = extendedBars.reduce((acc, bar, idx) => { ... }, {})  // consistent transform

17. Test describe text promises assertions that are not verified
   → Rule: FF.md Predictability 2-C — each describe's implied contract must be honored by all its it() cases
   → When a describe block name asserts an expectation (e.g. "관련 봉의 단봉 패턴도 함께 포함된다"),
     every it() case inside must verify that exact behavior
   → If an it() tests a different behavior, move it to a new describe block or correct the describe text
   ❌ describe('다봉 패턴이 있을 때 해당 봉의 단봉 패턴도 함께 포함된다', () => {
        it('결과를 반환한다', () => { expect(result).toBeDefined(); })  // not testing single-pattern inclusion
      })
   ✅ describe('다봉 패턴이 있을 때', () => {
        describe('해당 봉의 단봉 패턴도 함께 포함되는 경우', () => {
          it('단봉 패턴이 제외된다', () => { expect(result.singlePatterns).toBeUndefined(); })
        })
      })

18. Circular dependency between modules
   → Rule: FF.md Coupling 4-A — circular dependencies create initialization order brittleness and hidden coupling
   → When module A imports from B and B imports from A, refactor to break the cycle:
     1. Extract shared constant to a third file
     2. Move one dependency to infrastructure/utils layer
     3. Defer import to function call time (only as last resort)
   ❌ candle-detection.ts imports CANDLE_PATTERN_DETECTION_BARS from prompt.ts
      prompt.ts imports { detectCandlePatternEntries } from candle-detection.ts
   ✅ Move CANDLE_PATTERN_DETECTION_BARS to candle-detection.ts; prompt.ts imports from there
   ❌ indexA.ts imports { funcA } from indexB.ts and exports it; indexB.ts imports { funcB } from indexA.ts
   ✅ Extract shared definitions to common.ts; both import from common.ts

19. Type field added but test mock objects not updated
   → Rule: CONVENTIONS.md — when adding a field to a type/interface, all mock objects and fixtures used in tests must include that field
   → Test fixture objects must remain structurally compatible with the updated type signature
   → TypeScript compilation errors (TS error code) indicate incomplete fixture updates
   ❌ Add volumeProfile field to IndicatorResult interface; test fixtures in prompt.test.ts use old IndicatorResult mock without volumeProfile field
   ✅ Update all IndicatorResult mock objects in test fixtures to include volumeProfile: null (or appropriate test value)
   ❌ TypeScript compiler error when running tests: "Property 'volumeProfile' is missing in type ... but required in type 'IndicatorResult'"
   ✅ Compile succeeds after all test fixtures are updated to match the new interface shape
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