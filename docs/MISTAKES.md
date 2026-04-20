# Common Mistakes

Mistakes that Claude Code repeatedly makes.
Review before implementation and ensure these are not repeated.

Rules already documented in CONVENTIONS.md, FF.md, ARCHITECTURE.md, DOMAIN.md, or layer CLAUDE.md files are NOT repeated here.
This file contains only **recurring gotchas** that agents keep missing despite existing documentation.

---

## Coding Paradigm

```
1. Reimplementing the same algorithm
   → Check for existing helpers before writing a new function
   → Separate number[]-based helpers from Bar[]-based wrappers for reuse
   → Across provider pairs: extract shared logic to infrastructure/ai/utils.ts

2. Identical values queried or computed multiple times in a single function
   → Extract to a local const or assign once before using repeatedly
   → Applies to loop boundaries, array calculations, and function returns
   ❌ map.get(key) called twice with the same key
   ❌ for (let i = 0; i < array.length; i++) with length queried each iteration
   ❌ computeBbWidth(lastBB) called in loop setup and inside loop body (when checking lastIdx)
   ✅ const value = map.get(key); reuse value
   ✅ for (let i = 0; i < lastIdx; i++) { ... }; widthLast = computeBbWidth(lastBB) after loop
   ✅ const length = array.length; for (let i = 0; i < length; i++)

3. Discarding the callback parameter and re-accessing via external array index
   ❌ lines.reduce((acc, _line, idx) => { const line = lines[idx]; ... })
   ✅ lines.reduce((acc, line) => { ... })

4. Leaving logic that has no effect
   → filter/map that doesn't change the result, catch-all conditions that never execute
   ❌ data.flatMap(...).filter(x => x.id === uniqueId)  // uniqueId guaranteed from flatMap
   ✅ data.flatMap(...)

5. Array/object mutation via push/splice or direct property assignment
   → Use spread syntax for arrays; destructure and spread for objects
   ❌ keywords.push(value)  // direct mutation
   ❌ obj.property = newValue  // direct mutation of object created moments before
   ✅ const keywords = [...keywordList, value]
   ✅ const obj = { ...source, property: newValue }

6. Repeating identical filtering/calculation logic across multiple useEffect/useMemo blocks
   → Extract to useMemo (hooks) or const (regular code)

6.5. State/function/documentation divergence — parts of the system not synchronized when requirements change
   → When reset() is called, all related state (useState + useMutation) must be reset together
   → When function implementation changes, all related functions in the same module must use consistent approach
   → When prompt/instruction fields are updated, all field lists and documentation must stay synchronized
   ❌ reset() clears useMutation data but leaves separate useState stale
   ❌ collectMdFiles uses recursion but countSkillFiles uses non-recursive readdir
   ❌ Prompt field added to first list but omitted from second list in same instruction block
   ✅ reset() clears both useMutation and all related useState state together
   ✅ countSkillFiles reuses collectMdFiles for consistency
   ✅ All field lists synchronized when new fields are added

7. Repeating identical className ternary 3+ times
   → Extract to a helper function

8. Tight coupling between interface props and dependent files
   → Group related prop pairs into a single type (e.g. IndicatorToggleGroup { visible, onToggle })

9. Complex anonymous expressions (IIFE, multi-statement ternary)
   → Extract to a named helper function

10. Derived constants recreated on every render without memoization
    → Wrap with useMemo for objects/maps derived from props/state

11. Function/interface names become inaccurate after architectural changes
    → When replacing HTTP calls with Server Actions, renaming patterns, or moving code, update the names
    ❌ fetchBars (no longer a fetch — now a Server Action)
    ✅ getBarsAction (accurate to new implementation)

12. Using .sort() instead of .toSorted()
    → .sort() mutates the original array and violates immutability
    ❌ arr.sort() // in-place mutation
    ✅ arr.toSorted() // returns new sorted array

13. eslint-disable suppresses lint warnings instead of fixing root cause
    → Never suppress warnings with eslint-disable-next-line or inline comments
    → Always restructure the code to fix the actual issue (e.g., exhaustive-deps warnings → fix closure captures, remove unstable references)
    ❌ // eslint-disable-next-line react-hooks/exhaustive-deps
    ✅ Restructure deps, use useEffectEvent, use useRef for stable references

14. Using let + if for conditional assignment instead of declarative const expressions
    → Prefer ternary/conditional expressions (const) over imperative reassignment (let)
    → Improves code clarity and follows functional programming principles
    ❌ let result = value; if (condition) result = newValue; return result;
    ✅ const result = condition ? newValue : value; return result;

15. Hardcoded literals in function names or calculations
    → All magic numbers and constant values must be extracted to module-level constants
    → Function names must remain accurate when the underlying constant value changes
    ❌ function computeSecondsUntilKst17() { ... } where 17 is hardcoded; renaming breaks if constant changes
    ❌ Math.round(rawPrice * 100) / 100 with no constant for decimal factor
    ✅ const CACHE_EXPIRY_HOUR_KST = 17; function computeSecondsUntilCacheExpiry() { ... }
    ✅ const PRICE_DECIMAL_FACTOR = 100; Math.round(rawPrice * PRICE_DECIMAL_FACTOR) / PRICE_DECIMAL_FACTOR

21. Domain functions using imperative for-loop + push instead of higher-order functions
    → Domain functions must use map, filter, flatMap, reduce — never direct mutation with push/splice
    → Applies to all domain/ implementations; violation of functional programming paradigm
    ❌ const result = []; for (const item of data) { result.push(transform(item)); } return result;
    ✅ const result = data.map(transform); return result;
    ❌ const lines = []; for (const rec of reconciled) { lines.push(...extractLines(rec)); } return lines;
    ✅ const lines = reconciled.flatMap(extractLines); return lines;

22. Domain functions incomplete test coverage — missing unit tests entirely or covering <100% branches
    → Every new domain function must have dedicated unit tests with 100% branch coverage
    → Test infrastructure functions similarly; coverage checks catch missing edge cases
    ❌ callGeminiWithKeyFallback added to infrastructure/ai/gemini.ts without src/__tests__/infrastructure/ test file
    ❌ extractReconciledActionLines added to domain/analysis/ without corresponding unit tests for 8+ cases
    ✅ src/__tests__/domain/analysis/actionRecommendation.test.ts with cases: undefined rec, missing levels, duplicates, zero values, empty result
    ✅ New infrastructure functions tested in parallel src/__tests__/infrastructure/ test file with all branches covered

23. Domain functions inadequate defensive checks on financial data (division by zero, negative values, bounds)
    → Financial values require explicit guards before use — null/undefined checks insufficient
    → takeProfit, entryPrice, stoploss must be validated for sensible ranges (>0, within bounds)
    → Prevent negative R:R, invalid leverage, or meaningless outputs
    ❌ Number.isFinite(tp) only; allows tp = 0 or tp < 0 which breaks logic downstream
    ❌ const reward = tp - entryPrice; no guard for tp <= entryPrice, can yield negative R:R
    ✅ Number.isFinite(tp) && tp > 0 && tp !== entryPrice; return early if invalid
    ✅ if (tp <= entryPrice) return ''; // meaningless result, prevent display

16. Shared constants duplicated across module boundaries without documentation
    → When a module cannot import shared constants (environment constraints), duplicate with explicit JSDoc linking to the source
    → Every duplicate must reference the original constant and document the sync requirement
    ❌ worker/src/index.ts: JOB_TTL_SECONDS = 3600  // matches queue.ts but no link or comment
    ✅ worker/src/index.ts: // Matches JOB_TTL_SECONDS in queue.ts; update both if changed
             const JOB_TTL_SECONDS = 3600;
    → Redis key schemas duplicated across files must include a JSDoc block documenting the schema origin and dependency chain

17. Custom hooks declared after derived variables in component/hook code
    → All hook calls must be declared before derived variables (const x = ...), handlers, or effects
    ❌ const timeframe = computeTimeframe(); useQuery(...)
    ✅ useQuery(...); const timeframe = computeTimeframe();
    → Ordering: useState/useRef → useQuery/useMutation → derived variables → handlers → useEffect

17.5. for loop with .push() inside useMemo, reduce, or other functional expressions
    → Loop accumulation must use spread, map, filter, flatMap, or reduce — never direct mutation
    ❌ useMemo(() => { for (let i = 0; i < data.length; i++) { result.push(...) } }, [])
    ✅ useMemo(() => data.map(...).filter(...), [])
    ✅ useMemo(() => data.reduce((acc, item) => [...acc, ...], []), [])
    → Applies to all functional/declarative contexts, not just loops

18. Non-hook utility functions defined inside hook files
    → Pure utilities like sleep() belong in utils/ subfolders, not inside hook files
    ❌ useAnalysis.ts: const sleep = (ms) => new Promise(...)
    ✅ symbol-page/utils/sleep.ts

19. Inline styles in JSX when Tailwind classes are available
    → Always use Tailwind; never inline style={{ ... }} for layout or styling
    ❌ <ins style={{ display: 'block' }} />
    ✅ <ins className="block" />

20. Nested functions without explicit parameters extracted to module level
    → When extracting a function from a parent function scope, make all parent variables explicit parameters
    ❌ function searchAction() { function toResult(x) { ... parent var ... } }
    ✅ function toResult(x, parentVar) { ... }; function searchAction() { toResult(..., parentVar); }
```

---

## TypeScript

```
1. Object.fromEntries return type mismatch
   → Type assertion required: Object.fromEntries(pairs) as Record<K, V>

2. Missing fields in domain interface that exist in data source
   → When parsing new fields in infrastructure, add them to the domain interface immediately

3. Unused/missing type imports
   → Remove unused type imports; add missing ones for explicit annotations
   → When TypeScript infers automatically, the import is unnecessary

4. Interface field declaration does not match runtime behavior
   → Required fields marked `?` in the interface or absent fields declared as required
   → When tests and implementation show a field is optional, update interface to `fieldName?`
   ❌ interface Bars { bars: BarData[] }  // but implementation checks bars ?? []
   ✅ interface Bars { bars?: BarData[] }  // interface reflects runtime reality

5. Inline type annotations used instead of named type aliases
   → Extract repeated or reusable type patterns to named type aliases
   → Applies to union literals, object shapes, and field patterns used in component props or constants
   ❌ interface Props { size?: 'sm' | 'lg'; fields: readonly { label: string; key: string }[] }
   ✅ type ButtonSize = 'sm' | 'lg'; interface FieldDef { label: string; key: string }; interface Props { size?: ButtonSize; fields: readonly FieldDef[] }

6. Union literals with 3+ occurrences in different files → not extracted to named type
   → Domain indicators frequently repeat trend/direction unions across result types
   → When a union appears in 2+ result types, extract to domain/types.ts
   ❌ ParabolicSARResult { trend: 'up' | 'down' | null }; SupertrendResult { trend: 'up' | 'down' | null }
   ✅ type TrendDirection = 'up' | 'down' | null; ParabolicSARResult { trend: TrendDirection }; SupertrendResult { trend: TrendDirection }

7. Using `as` type assertions instead of type guards or non-null assertion operators
   → Prefer type guards, `!` operator, or satisfies keyword over `as` casts
   → Prefer `!` operator when null is logically impossible, or narrowing guards for conditional paths
   → `as` casts hide type safety problems; explicit guards expose intent
   ❌ const value = getValue() as number;  // hides null check
   ✅ const value = getValue()!;  // non-null assertion when null is logically impossible
   ✅ const value: number = getValue() ?? 0;  // type guard with fallback
   ❌ atrValues[idx] as number  // null never occurs due to prior check
   ✅ atrValues[idx]!  // non-null assertion operator

8. `as` type assertions without explanatory comments
   → When `as` must be used (e.g., external API response parsing), document why with a comment
   → Comment should explain the reason for the assertion (e.g., "FMP API response shape guaranteed by provider")
   ❌ const data = response as ApiResult;
   ✅ const data = response as ApiResult; // API response shape enforced by external provider schema
```

---

## Components

```
1. External callback prop in useEffect dependency array → infinite loops
   → Use useEffectEvent to wrap callback props

2. useState lazy initializer derives value from props
   → Initializer runs only once; use useEffect to sync when props change

3. Missing aria-expanded on accordion triggers

4. Unused Tailwind classes (e.g. grid classes on flex containers)
   → Verify parent layout model before applying layout-specific classes

5. Props declared but not connected to callbacks (latent bugs)
   → If a callback prop exists, it must actually be invoked

6. Repeating identical JSX structure 2+ times
   → Extract to a data array + .map() pattern

7. DOM event listener in useEffect instead of custom hook
   → Extract to useOnClickOutside, useEscapeKey, etc.

8. Custom hook params missing optional properties present in sibling hooks
   → All hooks in the same family must accept consistent parameter patterns

9. Custom hooks in components/ without 'use client' directive
   → Every hook file under components/ must declare 'use client' at the top
   → Hooks are Client Components and will fail without the directive when parent is async Server Component

10. setState called directly in useEffect body (react-hooks/set-state-in-effect)
    → If the state being reset logically belongs to "mutation starts", move it to useMutation's onMutate callback
    → onMutate fires synchronously before the mutationFn, satisfies the linter, and centralizes reset logic
    ❌ useEffect(() => { setPollError(null); setAnalysisResult(null); mutate(...); }, [deps])
    ✅ useMutation({ onMutate: () => { setPollError(null); setAnalysisResult(null); }, ... })
    → For state that must reset on every mutate call site, onMutate is the single source of truth
    → Note: useCallback does NOT help — the linter traces into useCallback bodies and still flags setState

11. URL synchronization using initial props instead of current local state
    → RSC pending states can cause initial props to be stale during concurrent updates
    → Always derive URL from local state (useState) that reflects current user action
    ❌ handleSectorChange() { updateUrl(initialTimeframe); }  // prop is stale during RSC pending
    ✅ const [activeTimeframe, setActiveTimeframe] = useState(initialTimeframe); handleSectorChange() { updateUrl(activeTimeframe); }

12. Internal flags affecting render state managed with useState instead of useRef
    → Flags that do not influence JSX output should use useRef to prevent unnecessary re-renders and effect re-runs
    → useState causes render cycles: setState → rerender → effect re-executes → immediate guard return
    ❌ const [isPushed, setIsPushed] = useState(false); handlePush() { setIsPushed(true); }
    ✅ const isPushedRef = useRef(false); handlePush() { isPushedRef.current = true; }
```

---

## Domain Functions

```
1. Hidden selection/filtering rules left implicit
   → Expose explicitly (e.g. per-timeframe EMA selection)

2. Silent fallback without exposing degradation to caller
   ❌ skillsLoader.loadSkills().catch(() => [])
   ✅ .catch(error => { console.error(...); return []; }) + skillsDegraded in response

3. Module-level constants frozen at load time instead of computed per mount
   → Data freshness requires per-component timestamps, not frozen module-load values
   ❌ const MODULE_LOAD_TIME = Date.now();  // SPA nav: all mounts see the same old timestamp
   ✅ const time = useState(() => Date.now())[0];  // each mount captures its own timestamp

4. Sentinel values wrapped in functions that silently break the contract
   → Sentinel values (-1, null, undefined) must propagate unchanged through call chains
   ❌ Math.max(0, sentinel ?? fallback)  // Math.max converts -1 to 0, breaking sentinel behavior
   ✅ sentinel === -1 ? -1 : Math.max(0, sentinel)  // explicit guard before wrapping
```

---

## Tests

```
1. Not updating tests when return type changes
   → Nullable changes (T[] → (T | null)[]) require a null test case

2. New field/indicator without corresponding test cases
   → Every new field needs at least one it() verifying its presence

3. beforeEach/beforeAll at module level instead of inside describe block

4. Boundary test constant redefined locally instead of imported from source
   ❌ const TEST_PERIOD = 14;
   ✅ import { RSI_DEFAULT_PERIOD } from '@/domain/indicators/constants';

5. Missing edge case coverage when refactoring or moving functions
   → Each module must test its own edge cases directly

6. Test duplication — each it() must test exactly one unique behavior

7. Provider pair must have symmetric error handling, test coverage, and naming
   → When one Provider changes, apply the same change to all Providers

8. Repeated identical parameter object passed to multiple function calls
   → Extract to const (regular code) or useMemo (hooks)

9. Test describe text promises assertions not verified by its it() cases

10. Type field added but test mock objects not updated
    → All mock/fixture objects must match the updated interface

11. External dependencies in production code without corresponding test mocks
    → When adding external packages (e.g., @vercel/functions) to infrastructure files, mock them in all corresponding test files
    → jest.mock('@package-name', ...) must be added to every test file that tests the module with the external dependency

12. Period-based indicator tests only verify sign (positive/negative) without toBeCloseTo reference values
    → Every period-based indicator test must include toBeCloseTo checks against manually-calculated expected values
    → Warming-up period constants must be imported from source, not manually redefined in tests
    → Boundary constants must account for full algorithm dependency chains (e.g. nested window calculations)
    ❌ test('trend is positive', () => expect(values[idx]).toBeGreaterThan(0))  // no actual value verification
    ✅ test('first value matches reference', () => expect(values[minBarsIdx]).toBeCloseTo(expectedValue))  // precise reference comparison

13. Redefining production functions/constants locally in tests
    → Tests must import and verify production code directly; local redefinitions become tautological
    ❌ test('shouldShowAd', () => { const shouldShowAd = (x) => x.enabled; expect(shouldShowAd(mock)).toBe(true); })
    ✅ import { shouldShowAd } from '@/domain/ads'; test('shouldShowAd', () => { expect(shouldShowAd(mock)).toBe(true); })
    → Expected values from module exports must also be imported, not hardcoded
    ❌ expect(label).toBe('STRONG'); // STRONG_LABEL imported from same module as function
    ✅ import { SIGNAL_STRENGTH_LABEL } from '@/utils'; expect(label).toBe(SIGNAL_STRENGTH_LABEL.strong);

14. Time-dependent functions in tests must be explicitly mocked
    → Functions using Date.now(), new Date() must be mocked in test files
    → Hard-coded expected values (e.g., TTL seconds) without mocking time sources cause flaky tests
    ❌ analyzeAction test: expect(ttl).toBe(86400); without mocking new Date()
    ✅ jest.mock('@/infrastructure/cache/config', ...); mock Date to fixed timestamp before assertions
```

---

## Accessibility (WAI-ARIA)

```
1. Overwriting native ARIA role of semantic elements
   → Native roles (paragraph, complementary) must not be replaced with role attributes
   → Use <div role="note"> instead of <p role="note"> or <aside role="note">
   → Use semantic elements without explicit role unless the role fundamentally differs

2. ARIA tablist pattern incomplete (missing roving tabindex or arrow key handlers)
   → tablist requires both roving tabindex AND arrow key navigation to be fully accessible
   → Active tab: tabIndex={0}; Inactive tabs: tabIndex={-1}
   → Implement onKeyDown handler for ArrowLeft/ArrowRight to move focus between tabs
   ❌ aria-selected set but tabIndex not set; no arrow key handlers
   ✅ tabIndex={isActive ? 0 : -1} + handleTablistKeyDown(ArrowLeft/Right)

3. Missing accessible name on ARIA roles
   → All role attributes must have either aria-label, aria-labelledby, or accessible text content
   → tooltip: requires aria-describedby connection to trigger element
   → note: requires aria-label with descriptive text
   ❌ <div role="tooltip">  // no aria-describedby
   ✅ <div role="tooltip" id="tooltip-1">; <button aria-describedby="tooltip-1">
   ❌ <div role="note">  // no aria-label
   ✅ <div role="note" aria-label="Additional information">

4. Interactive info icons using <span title="..."> only — not keyboard accessible
   → Tooltips must be keyboard-accessible; title attribute ignored by keyboard users and screen readers
   → Replace <span> with <button>, add aria-describedby + role="tooltip" pattern
   ❌ <span title="Information">ⓘ</span>  // title-only, no keyboard access
   ✅ <button aria-describedby="tooltip-id" className="focus-visible:ring"><span id="tooltip-id" role="tooltip">Information</span></button>
```

---

## UX & Rendering

```
1. Portal-based tooltips render at initial position (0,0) before calculation, causing visible flicker
   → Add visibility: hidden state during position calculation, reveal only after positioned
   → Use useEffect with calculated position callback to show element only when ready

2. Tooltip position calculated without viewport boundary checks
   → If trigger is near viewport edge, tooltip may overflow screen bounds
   → Add viewport padding checks: if (aboveTop < TOOLTIP_VIEWPORT_PADDING) render below instead
```

---

## Lightweight Charts

1. Missing chart.remove() cleanup or listener unsubscribe before chart.remove()
   → Always call unsubscribeVisibleLogicalRangeChange before chart.remove() to prevent "Object is disposed" errors
   → Use a ref pattern for onChartRemove callback to capture cleanup logic and guard chartRef.current in ResizeObserver
   → When effect cleanup order is non-deterministic (chart dispose may run first), use try-catch on the unsubscribe call
      rather than re-reading chartRef.current in cleanup (which triggers react-hooks/exhaustive-deps warnings)
   ❌ chartRef.current?.unsubscribeCrosshairMove(handler)  // eslint-disable required, ref read in cleanup
   ✅ try { chart.unsubscribeCrosshairMove(handler); } catch { /* already disposed */ }

2. Passing domain null values directly to setData
   → Convert to WhitespaceData({ time })

3. Adding volume/RSI to the main pane
   → Always add to a separate pane (index 1, 2, ...)

4. Derived className or style objects recreated on every render without memoization
   → Props-derived objects (inputClass, buttonClass computed from size prop) must use useMemo to prevent recreation
   → Prevents unnecessary re-renders when object identity is compared

---

## Next.js Build & Caching

```
1. Uncached data (Date.now(), new Date()) called in Provider constructors during prerender
   → When cacheComponents: true is enabled, all prerendered data must be static
   → Wrap QueryClient creation or dynamic providers in <Suspense> to defer execution to request time
   → Do not call uncached functions in module-level code or provider constructors

2. Client Component with new Date() in strict cacheComponents mode
   → Remove 'use client' and convert to 'use cache' async functions instead
   → Client Components cannot use Date.now() during prerender; use Cache Components for time-dependent logic

3. Missing 'use cache' directive on infrastructure functions
   → infrastructure/ functions accessed during prerender must include 'use cache' directive
   → Explicitly marks the function as safe to cache and enables caching at build time
```

## Documentation Sync

```
1. Skill document metadata and body content out of sync
   → Frontmatter indicators list must include all indicators referenced in the document body
   → AI instructions must reflect the system's actual capabilities, not idealized requirements
   ❌ mean-reversion.md body uses 2×ATR but frontmatter indicators omits atr
   ✅ Frontmatter includes all body references; update AI instructions to match actual RECENT_BARS_COUNT=30

2. API endpoint or parameter changes not reflected in docs/API.md
   → When external API schema or timeframe/parameter options change, update docs/API.md reference tables
   → Include all provider names, endpoint paths, and parameter enums in documentation
   ❌ FMP_INTRADAY_TIMEFRAME_MAP extended to include 30min, 4hour; docs/API.md still lists only 1Min-1Hour
   ✅ docs/API.md Timeframe table updated to include all current mappings
```

---

## Infrastructure Functions

```
1. Conditional logic branches must all update shared data consistently
   → Background jobs and retry paths must produce same data shape as main path
   → When caching results, all code paths must store the same fields
   ❌ Main path: cache.set(symbol, { symbol, name, koreanName, fmpSymbol })
      Background job: cache.set(symbol, { symbol, name, koreanName })  // fmpSymbol missing
   ✅ Both paths: cache.set(symbol, { symbol, name, koreanName, fmpSymbol })

2. Infrastructure functions must have 100% branch coverage
   → All if/else, optional chaining (?.), nullish coalescing (??) paths tested
   → Test edge cases like subsecond boundaries, zero values, Math.max guard behavior
   ❌ Math.max(1, Math.floor(diffMs / 1000)) guard that converts 0→1 untested
   ✅ Add test case: diffMs = 500ms covers the Math.max(1, 0) = 1 path

3. No debug artifacts (console.log) in infrastructure files
   → Infrastructure functions are utilities; logging belongs in higher layers
   ❌ getBars() { console.log(...timing...); return bars; }
   ✅ Remove logging; expose metrics via return type if needed
```

---

## Fire-and-Forget Operations

```
1. Fire-and-forget fetch requests must have timeouts
   → fetch() without timeout can block indefinitely on network delay
   → Apply AbortSignal.timeout(ms) to prevent client-side blocking
   ❌ fetch('/cancel', { method: 'POST' })  // no timeout
   ✅ fetch('/cancel', { method: 'POST', signal: AbortSignal.timeout(5000) })

2. Fire-and-forget Server Actions must swallow errors
   → Error propagation from background actions blocks the caller
   → Wrap in try-catch, log warning, and return normally
   ❌ async function cancelAction() { await fetch('/cancel'); }  // throws to caller if fetch fails
   ✅ async function cancelAction() { try { await fetch(...); } catch (e) { console.warn('Background action failed', e); } }
```

---

## Predictability

```
1. Including unrelated changes in a PR without documented justification
   → Each commit/PR should focus on a single concern
   → Unrelated changes must be moved to separate PRs or reverted
   → If a related change is necessary, document the reason in a comment or commit message

2. Conditional checks that duplicate type system guarantees
   → If a type system guarantees a field is present, do not add optional chaining or truthiness checks
   ❌ !!assetInfo?.name  // when AssetInfo.name is required
   ✅ !!assetInfo  // sufficient when name is guaranteed

3. useEffect dependency array missing dynamic variables or including stable refs
   → All variables from outer scope used in useEffect body must be in deps array
   → Stable refs and useEffectEvent-wrapped functions should not be in deps array
   → Missing deps cause stale closures; unnecessary deps cause redundant re-runs
   ❌ useEffect(() => { ... slot ... }, [isFullSnap])  // slot prop used but not in deps
   ❌ useEffect(() => { ... snapToPoint ... }, [isFullSnap, snapToPoint])  // snapToPoint from useEffectEvent is stable
   ✅ useEffect(() => { ... slot ... }, [isFullSnap, slot])  // all dynamic deps included
   ✅ useEffect(() => { ... snapToPoint ... }, [isFullSnap])  // useEffectEvent results excluded

4. Documentation examples contradict actual business logic
   → Skill documents must reflect actual system capabilities and conditions
   → Example scenarios must match the signal conditions they describe
   ❌ Example shows "current price 166, support 167" to illustrate long entry when support would be broken
   ❌ Description says "UTAD confirms buying" when UTAD actually signals distribution completion
   ✅ Example: "current price 168, support 167" to show support holding for long entry
   ✅ Description: "UTAD signals distribution complete; defer entry (downside risk)"
```

---

## Design & Cohesion

```
1. Related data with shared keys/dependencies scattered into multiple constants
   → Data that must be updated together should live in a single object/constant
   ❌ const CONFIG = { level: [...], icon: [...] };  const TOOLTIP = { level: [...], text: [...] };
   ✅ const BADGE_DATA = { level: [{ icon, tooltip }, ...] };
   → When a new level is added, only one constant needs updating

2. Same resource created multiple times when a single instance would suffice
   → Cache resource creation or check for duplicates before creating
   ❌ const reader = new Redis(config); const writer = new Redis(config);
   ✅ const writer = new Redis(config); const reader = !token ? writer : new Redis(altConfig);

3. Implicit divergence between ref initialization and state lazy initializer
   → useState lazy initializer and useRef initial value must share same source of truth
   ❌ useRef(getDefaultValue()) eager call vs useState(() => getDefaultValue()) lazy call diverges if getDefaultValue() returns different results
   ✅ If ref is overwritten before read, initialize to null; if read first, share source with useState

4. Deleting code marked with TODO without updating all references
   → TODO comments indicate intentional preservation for future references
   → Removing such code breaks commented-out code that still references it; restore or update all references first

5. Domain logic conditions differ between server and client
   → When the same business rule applies in both layers, ensure identical conditions on both sides
   → Example: if client uses `name !== ticker` guard, server `buildDisplayName` must use the same guard

6. Unrelated data mixed in a single constant
   → Constants with different purposes/domains should be in separate modules
   ❌ src/lib/seo.ts contains both SEO metadata (ogTitle, ogDescription) and legal disclaimers
   ✅ Separate: src/lib/seo.ts for SEO, src/lib/legal.ts for legal constants

7. Business domain constants placed in lib/ (violation of lib/CLAUDE.md scope)
   → lib/ may contain only utility wrappers, React Query key factories, config constants, chart colors
   → Business domain knowledge (POPULAR_TICKERS, legal disclaimers) must go to domain/ or sitemap-specific modules
   ❌ POPULAR_TICKERS defined in src/lib/seo.ts
   ✅ Inline at usage site (src/app/sitemap.ts) or domain-specific module

8. Chart indicator color tokens applied to UI components
   → Chart-specific tokens (chart-rsi, chart-period10, chart-bollinger, chart-period60, chart-period5) are semantic colors for indicator lines only
   → UI components must use primary-*, secondary-*, chart-bullish, chart-bearish, or ui-warning
   ❌ CATEGORY_STYLES = { fintech: 'chart-period10', healthcare: 'chart-rsi', ... }
   ✅ CATEGORY_STYLES = { fintech: 'primary-500', healthcare: 'secondary-400', ... }

9. Repeated literal values in the same page or component across multiple locations
   → Extract to a named constant; prevents silent divergence when updating
   → Applies to descriptions, messages, configuration values, and metadata strings
   ❌ generateMetadata() { ... description: 'exact same text' }; buildJsonLd() { ... description: 'exact same text' }
   ✅ const SYMBOL_DESCRIPTION = '...'; generateMetadata() uses SYMBOL_DESCRIPTION; buildJsonLd() uses SYMBOL_DESCRIPTION
   ❌ metadata.description uses MARKET_DESCRIPTION; openGraph.description uses separate hardcoded string
   ✅ Both metadata.description and openGraph.description reference MARKET_DESCRIPTION constant
```

---

## Architecture

```
1. Type interfaces defined in implementation files instead of domain/types.ts
   → All domain types (interfaces, unions, enums) must be centralized in domain/types.ts
   → If multiple files reference the same type, move it to domain/types.ts for single source of truth
   ❌ interface TickerCategory { id: string; name: string; } in domain/constants/popular-tickers.ts
   ✅ export type TickerCategory = { id: string; name: string; } in domain/types.ts

2. Pure utility functions placed in components/ instead of proper layers
   → Pure functions with no React dependencies must be in domain/ (business logic) or lib/ (UI utilities)
   → Utility functions extracted from components must go to utils/ subfolders, not remain in components/
   ❌ Pure function in components/dashboard/utils/ or inlined in SectorSignalPanel.tsx
   ✅ Pure function in domain/signals/ or dedicated utils/ subfolder with proper layer imports
```
