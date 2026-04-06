# Common Mistakes

Mistakes that Claude Code repeatedly makes.
Review before implementation and ensure these are not repeated.

Rules already documented in CONVENTIONS.md, FF.md, ARCHITECTURE.md, or layer CLAUDE.md files are NOT repeated here.
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
   ❌ map.get(key) called twice with the same key
   ✅ const value = map.get(key); reuse value

3. Discarding the callback parameter and re-accessing via external array index
   ❌ lines.reduce((acc, _line, idx) => { const line = lines[idx]; ... })
   ✅ lines.reduce((acc, line) => { ... })

4. Leaving logic that has no effect
   → filter/map that doesn't change the result, catch-all conditions that never execute
   ❌ data.flatMap(...).filter(x => x.id === uniqueId)  // uniqueId guaranteed from flatMap
   ✅ data.flatMap(...)

5. Nested functions that implicitly capture parent scope variables
   → Extract to module-level and pass captured variables as explicit parameters
   ❌ function parent() { function child() { uses parentVar } }
   ✅ function child(parentVar) { ... }  // extracted, explicit params

6. Repeating identical filtering/calculation logic across multiple useEffect/useMemo blocks
   → Extract to useMemo (hooks) or const (regular code)

7. Repeating identical className ternary 3+ times
   → Extract to a helper function

8. Pure utility functions defined in hook files instead of utils/ subfolder
   → hooks/ = React hooks only; pure functions → utils/

9. Tight coupling between interface props and dependent files
   → Group related prop pairs into a single type (e.g. IndicatorToggleGroup { visible, onToggle })

10. Complex anonymous expressions (IIFE, multi-statement ternary)
    → Extract to a named helper function

11. Derived constants recreated on every render without memoization
    → Wrap with useMemo for objects/maps derived from props/state

12. Function/interface names become inaccurate after architectural changes
    → When replacing HTTP calls with Server Actions, renaming patterns, or moving code, update the names
    ❌ fetchBars (no longer a fetch — now a Server Action)
    ❌ ApiResponse (no longer an API route response)
    ✅ getBarsAction, ActionResult (accurate to new implementation)

13. Mutating arrays or objects instead of creating new copies
    → Use spread operators, .map(), .filter(), .reduce(), or immutable methods (.toReversed())
    ❌ groups.push(...); groups[idx].items.push(item); arr.reverse()
    ✅ [...groups, newItem]; groups.map((g, i) => i === idx ? { ...g, items: [...g.items, item] } : g); arr.toReversed()
    → Applies to all array mutations: push, pop, shift, unshift, splice, reverse, sort
```

---

## TypeScript

```
1. Declaring types inside functions
   → Move to top of file

2. Returning inline object types instead of named interfaces
   → Define a named interface at the top of the file and use it as the return type
   → Improves readability, enables reuse, and documents the contract clearly
   ❌ function getAlpacaCredentials() { return { apiKey, secretKey }; }  // type inferred
   ✅ interface AlpacaCredentials { apiKey: string; secretKey: string; }
      function getAlpacaCredentials(): AlpacaCredentials { ... }

3. Using `as` type assertions instead of type guards
   → Use typeof, in, instanceof, or discriminated unions
   → Exception: DOM elements, third-party library return types (add comment explaining why)
   → For third-party library assertions, always add a comment explaining why the guard is not possible

4. Indicator result types defined in indicator files instead of domain/types.ts
   → All indicator result types belong in domain/types.ts

5. Rewriting constant-derived values as literals in implementation code
   → They won't update when the constant changes
   → expect() values in tests may use literals

6. Hardcoding array indices that represent structural positions
   ❌ result.split('\n\n')[1]
   ✅ const SECTION_INDEX = 1; result.split('\n\n')[SECTION_INDEX]

7. Using browser/Node global names as variable names (ESLint no-shadow)
   → window, document, location, event, name, length, screen

8. Object.fromEntries return type mismatch
   → Type assertion required: Object.fromEntries(pairs) as Record<K, V>

9. Missing fields in domain interface that exist in data source
   → When parsing new fields in infrastructure, add them to the domain interface immediately

10. Unused/missing type imports
    → Remove unused type imports; add missing ones for explicit annotations
    → When TypeScript infers automatically, the import is unnecessary

11. Implementation and documentation changes not synchronized
    → When implementation changes, update docs/DOMAIN.md and docs/DESIGN.md

12. Related interfaces with shared fields not linked by extends
    ❌ interface B { ...all fields of A...; extra: string }
    ✅ interface B extends A { extra: string }

13. Type or schema defined in the wrong layer, or duplicated without compile-time enforcement
    → Use Record<keyof Interface, ...> to enforce sync at compile time
    → Route-layer concerns stay in route layer (e.g. skillsDegraded)

14. Interface field declaration does not match runtime behavior
    → Required fields marked `?` in the interface or absent fields declared as required
    → When tests and implementation show a field is optional, update interface to `fieldName?`
    ❌ interface Bars { bars: BarData[] }  // but implementation checks bars ?? []
    ✅ interface Bars { bars?: BarData[] }  // interface reflects runtime reality
```

---

## Components

```
1. Props interface separated from component by other definitions
   → Props interface must be immediately above the component function

2. Hook declaration order violated
   → Custom hooks must follow: useState → useRef → derived variables (useMemo/const) → useEffect
   → Placing useMemo or derived const between useEffect blocks breaks the convention
   ❌ useState(...); useEffect(...); const derived = ...; useEffect(...);
   ✅ useState(...); useRef(...); const derived = ...; useEffect(...); useEffect(...);

3. Managing timeframe as a URL query parameter
   → Manage as client state only

4. new Date() in Server Component → hydration mismatch
   → Extract into a 'use client' component or add suppressHydrationWarning

5. Side effects inside setState updater functions
   → Updaters run twice in Strict Mode; side effects must be placed outside

6. Stale closure state instead of functional setState
   ❌ const next = new Set(visiblePatterns); setVisiblePatterns(next);
   ✅ setVisiblePatterns(prev => { const next = new Set(prev); ...; return next; });

7. Nesting interactive elements (button-in-button)
   → HTML spec prohibits interactive content inside interactive content

8. External callback prop in useEffect dependency array → infinite loops
   → Use useEffectEvent to wrap callback props

9. useState lazy initializer derives value from props
   → Initializer runs only once; use useEffect to sync when props change

10. Missing aria-expanded on accordion triggers

11. Component managing its own external margin
    → External spacing belongs to the caller, not the component

12. Unused Tailwind classes (e.g. grid classes on flex containers)
    → Verify parent layout model before applying layout-specific classes

13. Props declared but not connected to callbacks (latent bugs)
    → If a callback prop exists, it must actually be invoked

14. Repeating identical JSX structure 2+ times
    → Extract to a data array + .map() pattern

15. DOM event listener in useEffect instead of custom hook
    → Extract to useOnClickOutside, useEscapeKey, etc.

16. Inline styles for dynamic runtime values
    → Use CSS custom properties with Tailwind arbitrary-value syntax
    ❌ style={{ width: `${px}px` }}
    ✅ style={{ '--w': `${px}px` }} className="md:w-[var(--w)]"

17. Custom hook params missing optional properties present in sibling hooks
    → All hooks in the same family must accept consistent parameter patterns
```

---

## Domain Functions

```
1. Writing indicator calculations directly in Route Handlers
   → Import and use from domain/indicators

2. Hidden selection/filtering rules left implicit
   → Expose explicitly (e.g. per-timeframe EMA selection)

3. Silent fallback without exposing degradation to caller
   ❌ skillsLoader.loadSkills().catch(() => [])
   ✅ .catch(error => { console.error(...); return []; }) + skillsDegraded in response

4. Multi-candle and single-candle patterns both shown for the same bar
   → Multi-candle > single-candle priority; suppress singles on involved bars

5. Ichimoku Cloud: future projection and bullish/bearish distinction required
   → SenkouA/B projected 26 bars forward; distinct colors for bullish vs bearish cloud

6. Skill markdown files using invalid type values
   → type field is only valid as 'pattern'; omit when not 'pattern'

7. Missing mandatory fields in skill markdown files
   → All required interface fields must be present in frontmatter and body

8. Module-level constants frozen at load time instead of computed per mount
   → Data freshness requires per-component timestamps, not frozen module-load values
   ❌ const MODULE_LOAD_TIME = Date.now();  // SPA nav: all mounts see the same old timestamp
   ✅ const time = useState(() => Date.now())[0];  // each mount captures its own timestamp

9. Sentinel values wrapped in functions that silently break the contract
   → Sentinel values (-1, null, undefined) must propagate unchanged through call chains
   ❌ Math.max(0, sentinel ?? fallback)  // Math.max converts -1 to 0, breaking sentinel behavior
   ✅ sentinel === -1 ? -1 : Math.max(0, sentinel)  // explicit guard before wrapping
```

---

## Tests

```
1. Missing test file when creating a new domain/infrastructure file
   → Direct test cases required; indirect verification alone is insufficient

2. Infrastructure file with 100% branch coverage not achieved
   → All conditional branches must have dedicated test cases
   → Check: optional chaining (?.),  nullish coalescing (??), if/else branches
   ❌ const secret = process.env.SECRET ?? process.env.SECRET_ALT;  // ALT-only path untested
   ✅ Add a test case that sets only the fallback path and verifies it

3. Not updating tests when return type changes
   → Nullable changes (T[] → (T | null)[]) require a null test case

4. New field/indicator without corresponding test cases
   → Every new field needs at least one it() verifying its presence

5. Test describe/it descriptions as code expressions
   ❌ describe('closes.length < period', ...)
   ✅ describe('입력 배열 길이가 period 미만일 때', ...)

6. Missing initial-period null test case for period-based indicators

7. beforeEach/beforeAll at module level instead of inside describe block

8. Boundary test constant redefined locally instead of imported from source
   ❌ const TEST_PERIOD = 14;
   ✅ import { RSI_DEFAULT_PERIOD } from '@/domain/indicators/constants';

9. Missing edge case coverage when refactoring or moving functions
   → Each module must test its own edge cases directly

10. Unconditional assertion required — no if-guarded assertions
    ❌ if (result.includes('pattern')) { expect(result).toMatch('bullish_engulfing'); }
    ✅ expect(result).toMatch('bullish_engulfing');

11. Test duplication — each it() must test exactly one unique behavior

12. Provider pair must have symmetric error handling, test coverage, and naming
    → When one Provider changes, apply the same change to all Providers

13. Repeated identical parameter object passed to multiple function calls
    → Extract to const (regular code) or useMemo (hooks)

14. Test describe text promises assertions not verified by its it() cases

15. Circular dependency between modules
    → Extract shared constant to a third file to break the cycle

16. Type field added but test mock objects not updated
    → All mock/fixture objects must match the updated interface
```

---

## Lightweight Charts

1. Missing chart.remove() cleanup
   → Duplicate canvas on component remount

2. Passing domain null values directly to setData
   → Convert to WhitespaceData({ time })

3. Adding volume/RSI to the main pane
   → Always add to a separate pane (index 1, 2, ...)

---

## Pure Function Contracts

```
1. Utility functions must guard all valid input ranges explicitly
   → Pure functions must handle edge cases so callers cannot receive invalid results
   → Include guards for both lower bounds (null, negative) and upper bounds (array length, max values)
   ❌ function resolveBarIndex(index) { if (index < 0) return 0; return index; }  // missing upper bound
   ✅ function resolveBarIndex(index) { if (index < 0) return 0; if (index >= length) return length - 1; return index; }
```

---

## ESLint

1. import/first violation
   → Writing export * before import in barrel files (index.ts)
   → Move imports to the top of the file

2. Missing EOF newline
   → Auto-fixed by running yarn format

3. Using eslint-disable comments instead of fixing root cause
   → eslint-disable-next-line, eslint-disable comment blocks are prohibited
   → Always fix the underlying violation instead
   ❌ // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = getSomething();
   ✅ // Remove the unused variable; if it's a required interface parameter, omit it from implementation

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
```

---

## Layer Dependencies

1. Importing external libraries in domain
   → technicalindicators, lodash, etc. are all prohibited

2. Importing infrastructure in components
   → AlpacaProvider, claudeClient, etc. are prohibited

3. Importing Lightweight Charts outside components/chart/

4. Importing @/lib/* in components is allowed
   → lib/ is the external UI utility wrapper layer (cn, etc.)
   → Unlike infrastructure, components may import from lib/

5. Lower layers importing from higher layers (infrastructure/hooks importing from app/)
   → Rule: ARCHITECTURE.md — dependency flow is strictly downward (app → infrastructure → domain)
   → Reverse imports (infrastructure → app or domain → infrastructure) violate layer boundaries
   → Infrastructure and domain functions must not depend on app-layer code (Server Actions, RSC logic, API routes)
   → If infrastructure needs app-level capabilities, extract the logic into infrastructure and call it from app
   → Hooks in components/ may only import from infrastructure; never import app/ Server Actions directly
   ❌ // infrastructure/market/barsApi.ts
      import { getBarsAction } from '@/app/actions'
      export async function fetchBars() { return getBarsAction(...) }
   ✅ // infrastructure/market/barsApi.ts
      'use server'
      export async function fetchBars() { ... }  // move Server Action logic here
      // app/ imports and calls this function
   ❌ // components/symbol-page/hooks/useBars.ts
      import { getBarsAction } from '@/app/actions'
   ✅ // components/symbol-page/hooks/useBars.ts
      import { fetchBars } from '@/infrastructure/market'  // import from infrastructure layer only
