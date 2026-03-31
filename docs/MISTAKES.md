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
   → Avoid imperative loops with index reassignment (let i = 0; while (i < length) i++) even when building complex state machines
   ❌ for (let i = 0; i < closes.length; i++) result.push(closes[i] * 2)
   ✅ closes.map(c => c * 2)
   ❌ let i = 0; while (i < lines.length) { ... i++; }
   ✅ lines.reduce((acc, line, idx) => { ... }, initialState)
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
   → Across provider pairs (ClaudeProvider, GeminiProvider): Extract shared logic to infrastructure/ai/utils.ts
   ❌ MARKDOWN_CODE_BLOCK_PATTERN defined in both claude.ts and gemini.ts
   ✅ Define once in infrastructure/ai/utils.ts and import in both providers

9. Discarding the callback parameter and re-accessing the same element via external array index
   → Rule: FF.md Readability 1-G — viewpoint shift forces the reader to track two locations simultaneously
   → map/filter/reduce callbacks already receive the current element as a parameter; use it directly
   ❌ lines.reduce((acc, _line, idx) => { const line = lines[idx]; ... })
   ❌ items.filter((_, ci) => { const item = outerArray[offset + ci]; ... })
   ✅ lines.reduce((acc, line) => { ... })
   ✅ items.filter(item => { ... })

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
```

12. Using template literals with inline ternary for conditional classes instead of cn()
    → Rule: CONVENTIONS.md — conditional classNames must use cn() utility
    → Rule: FF.md Predictability 2-A — consistent pattern for all conditional styling
    → Mixing `` `... ${condition ? '...' : '...'}` `` and cn() patterns creates inconsistency
    ❌ className={`flex ... ${period === 20 ? 'bg-blue' : 'bg-gray'}`}
    ✅ className={cn('flex ...', period === 20 ? 'bg-blue' : 'bg-gray')}
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

8. External callback prop in useEffect dependency array causes infinite loops
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

9. useState lazy initializer derives value from props
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

10. Missing aria-expanded attribute on accordion triggers
    → Accordion toggle elements (role="button" or <button>) must declare aria-expanded when managing hidden content
    → Rule: ARIA spec — interactive controls that toggle visibility must expose state to screen readers
    → Applies to both custom div[role="button"] and native <button> accordion triggers
    ❌ <div role="button" onClick={toggle}>Trigger</div><div className={isOpen ? '' : 'hidden'}>Content</div>
    ✅ <div role="button" onClick={toggle} aria-expanded={isOpen}>Trigger</div><div hidden={!isOpen}>Content</div>
    ❌ <button onClick={toggle}>Trigger</button><div className={isOpen ? '' : 'hidden'}>Content</div>
    ✅ <button onClick={toggle} aria-expanded={isOpen}>Trigger</button><div hidden={!isOpen}>Content</div>

11. Component managing its own external margin or parent depending on child's internal layout
    → Components must not hardcode their own external margins (margin, mb-2, etc.)
    → Parents must not depend on children's internal structure or layout direction
    → Rule: DESIGN.md — each component is responsible for its own internal layout; external spacing belongs to the caller
    → Rule: FF.md Coupling 4-A — components should not create tight coupling through layout expectations
    ❌ export function DetectedBadge() { return <div className="mb-2">...</div>; }  // hardcodes external margin
    ❌ <div className="flex-col md:flex-row"><ChartContent /></div>  // parent controls child's internal layout
    ✅ export function DetectedBadge() { return <div>...</div>; }  // layout is caller's responsibility
    ✅ export function ChartContent() { return <div className="flex-col md:flex-row">...</div>; }  // child owns its layout
       <SymbolPageClient />  // caller adds margin as needed

12. Repeating identical JSX structure across multiple render blocks
    → Rule: FF.md Readability 1-A — identical JSX repeated 2+ times should be data-driven
    → Extract to a data array + .map() pattern instead of hardcoding duplicates
    → Rule: FF.md Cohesion 3-B — related JSX structures belong in single rendering logic
    ❌ <div>{dropdownA && <Dropdown config={configA} />}</div>
       <div>{dropdownB && <Dropdown config={configB} />}</div>
       <div>{dropdownC && <Dropdown config={configC} />}</div>
    ✅ const dropdowns = [configA, configB, configC];
       {dropdowns.map(config => <div key={config.id}>{config.visible && <Dropdown config={config} />}</div>)}

13. Implementing DOM event listener logic directly in useEffect instead of extracting to custom hook
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
   → When a field is optional, explicitly verify both the presence and absence cases
   ❌ Add patternSummaries/skillResults to AnalysisResponse with no array-verification test
   ❌ Add riskLevel to ANALYSIS_REQUEST schema with no field-inclusion test
   ❌ interface Skill { pattern?: string }  // added but test only checks populated case, not undefined case
   ✅ it('patternSummaries 배열을 반환한다', () => { expect(Array.isArray(result.patternSummaries)).toBe(true); })
   ✅ it('pattern: 미존재 시 undefined를 반환한다', () => { expect(result.pattern).toBeUndefined(); })

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

8. Test file structure lacks module-level wrapper (2-level instead of 3-level)
   → Rule: CONVENTIONS.md Test Structure — describe(module/subject name) → describe(function/context) → it(behavior) is required
   ❌ describe('buildAnalysisPrompt', () => { describe('current market section', () => { it(...) }) })  // missing module wrapper
   ✅ describe('prompt', () => { describe('buildAnalysisPrompt', () => { describe('current market section', () => { it(...) }) }) })  // 3 levels

9. Test file exceeds 3-level structure (describe → describe → describe → it) with unnecessary intermediate layers
   → Rule: CONVENTIONS.md Test Structure — exactly 3 levels required: describe(subject) → describe(context) → it(behavior)
   → Adding extra describe layers between required levels creates nesting that obscures the test intent
   → Common offenders: adding describe(methodName) when method is the only one in the class, or describe(sectionName) between subject and context
   → When context is inherently coupled with subject, merge it into the context describe text instead of adding a separate layer
   ❌ describe('FileSkillsLoader') { describe('loadSkills') { describe('파일이 없을 때') { it('에러를 던진다') } } }  // 4 levels
   ✅ describe('FileSkillsLoader') { describe('파일이 없을 때') { it('에러를 던진다') } }  // 3 levels
   ❌ describe('buildAnalysisPrompt') { describe('현재 시장 상황 섹션') { describe('bars가 비어있을 때') { it('섹션이 생성된다') } } }  // 4 levels
   ✅ describe('buildAnalysisPrompt') { describe('현재 시장 상황 섹션 - bars가 비어있을 때') { it('섹션이 생성된다') } }  // merge context into describe text
   ❌ describe('생성자를 호출하면') { describe('API 키 미설정 상태에서') { it('에러를 던진다') } }  // separate describe for action when it's the only action tested
   ✅ describe('API 키 미설정 상태에서') { it('생성자를 호출하면 에러를 던진다') }  // merge into it description

10. Boundary test constant redefined locally instead of imported from source
   → Rule: MISTAKES.md TypeScript Rule 6 — hardcoded boundary values must be extracted to constants.ts
   → When a test file uses a boundary value (e.g. RSI_DEFAULT_PERIOD = 14, HIGH_CONFIDENCE_WEIGHT = 0.8),
     it must import the constant from domain, not redeclare it locally
   → Local redeclaration breaks when the constant changes; importing ensures test stays in sync
   ❌ (confidence.test.ts) const TEST_HIGH_CONFIDENCE = 0.8; // then expect(result.confidence >= TEST_HIGH_CONFIDENCE)
   ✅ (confidence.test.ts) import { HIGH_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants'; expect(result.confidence >= HIGH_CONFIDENCE_WEIGHT)

11. Provider pair has asymmetric error handling or logging behavior
   → Rule: FF.md Predictability 2-B — sibling functions/classes in the same family must behave consistently
   → When one Provider adds error detail (cause, console.error), apply the same change to all Providers
   ❌ GeminiProvider: catch (error) { throw new Error('...', { cause: error }); console.error(...) }
      ClaudeProvider: catch { throw new Error('...') }  // cause and console.error missing
   ✅ Both Providers use identical catch patterns with cause and console.error

12. New Provider implementation missing test cases that exist in sibling Provider
   → Rule: FF.md Predictability 2-B — sibling classes in the same family must have symmetric test coverage
   → When a new Provider is added, all it() cases present in the existing Provider must be replicated
   → Applies to field-presence checks (e.g. 'skillsDegraded' in result), error cases, and structural assertions
   → Common gap: markdown code block stripping edge cases (text before/after the block)
   ❌ ClaudeProvider: it('skillsDegraded 필드를 포함하지 않는다', ...)
      GeminiProvider: (missing)
   ✅ Both Providers have identical test cases covering the same behaviors and field assertions

13. Provider pair has inconsistent naming conventions
   → Rule: FF.md Predictability 2-A — sibling classes must use consistent terminology
   → When two Providers define the same concept (e.g. system instructions), use identical naming
   ❌ claude.ts: const CLAUDE_SYSTEM_PROMPT
      gemini.ts: const GEMINI_SYSTEM_INSTRUCTION  // different term ("PROMPT" vs "INSTRUCTION")
   ✅ claude.ts: const CLAUDE_SYSTEM_PROMPT
      gemini.ts: const GEMINI_SYSTEM_PROMPT  // consistent term
   ❌ Define identical string in both files
   ✅ Extract to infrastructure/ai/utils.ts as AI_SYSTEM_PROMPT and import in both

14. Repeated identical parameter object passed to multiple function calls
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