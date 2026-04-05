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
```

---

## TypeScript

```
1. Declaring types inside functions
   → Move to top of file

2. Using `as` type assertions instead of type guards
   → Use typeof, in, instanceof, or discriminated unions
   → Exception: DOM elements, third-party library return types (add comment explaining why)

3. Indicator result types defined in indicator files instead of domain/types.ts
   → All indicator result types belong in domain/types.ts

4. Rewriting constant-derived values as literals in implementation code
   → They won't update when the constant changes
   → expect() values in tests may use literals

5. Hardcoding array indices that represent structural positions
   ❌ result.split('\n\n')[1]
   ✅ const SECTION_INDEX = 1; result.split('\n\n')[SECTION_INDEX]

6. Using browser/Node global names as variable names (ESLint no-shadow)
   → window, document, location, event, name, length, screen

7. Object.fromEntries return type mismatch
   → Type assertion required: Object.fromEntries(pairs) as Record<K, V>

8. Missing fields in domain interface that exist in data source
   → When parsing new fields in infrastructure, add them to the domain interface immediately

9. Unused/missing type imports
   → Remove unused type imports; add missing ones for explicit annotations
   → When TypeScript infers automatically, the import is unnecessary

10. Implementation and documentation changes not synchronized
    → When implementation changes, update docs/DOMAIN.md and docs/DESIGN.md

11. Related interfaces with shared fields not linked by extends
    ❌ interface B { ...all fields of A...; extra: string }
    ✅ interface B extends A { extra: string }

12. Type or schema defined in the wrong layer, or duplicated without compile-time enforcement
    → Use Record<keyof Interface, ...> to enforce sync at compile time
    → Route-layer concerns stay in route layer (e.g. skillsDegraded)
```

---

## Components

```
1. Props interface separated from component by other definitions
   → Props interface must be immediately above the component function

2. Managing timeframe as a URL query parameter
   → Manage as client state only

3. new Date() in Server Component → hydration mismatch
   → Extract into a 'use client' component or add suppressHydrationWarning

4. Side effects inside setState updater functions
   → Updaters run twice in Strict Mode; side effects must be placed outside

5. Stale closure state instead of functional setState
   ❌ const next = new Set(visiblePatterns); setVisiblePatterns(next);
   ✅ setVisiblePatterns(prev => { const next = new Set(prev); ...; return next; });

6. Nesting interactive elements (button-in-button)
   → HTML spec prohibits interactive content inside interactive content

7. External callback prop in useEffect dependency array → infinite loops
   → Use useEffectEvent to wrap callback props

8. useState lazy initializer derives value from props
   → Initializer runs only once; use useEffect to sync when props change

9. Missing aria-expanded on accordion triggers

10. Component managing its own external margin
    → External spacing belongs to the caller, not the component

11. Unused Tailwind classes (e.g. grid classes on flex containers)
    → Verify parent layout model before applying layout-specific classes

12. Props declared but not connected to callbacks (latent bugs)
    → If a callback prop exists, it must actually be invoked

13. Repeating identical JSX structure 2+ times
    → Extract to a data array + .map() pattern

14. DOM event listener in useEffect instead of custom hook
    → Extract to useOnClickOutside, useEscapeKey, etc.

15. Inline styles for dynamic runtime values
    → Use CSS custom properties with Tailwind arbitrary-value syntax
    ❌ style={{ width: `${px}px` }}
    ✅ style={{ '--w': `${px}px` }} className="md:w-[var(--w)]"

16. Custom hook params missing optional properties present in sibling hooks
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
```

---

## Tests

```
1. Missing test file when creating a new domain/infrastructure file
   → Direct test cases required; indirect verification alone is insufficient

2. Not updating tests when return type changes
   → Nullable changes (T[] → (T | null)[]) require a null test case

3. New field/indicator without corresponding test cases
   → Every new field needs at least one it() verifying its presence

4. Test describe/it descriptions as code expressions
   ❌ describe('closes.length < period', ...)
   ✅ describe('입력 배열 길이가 period 미만일 때', ...)

5. Missing initial-period null test case for period-based indicators

6. beforeEach/beforeAll at module level instead of inside describe block

7. Boundary test constant redefined locally instead of imported from source
   ❌ const TEST_PERIOD = 14;
   ✅ import { RSI_DEFAULT_PERIOD } from '@/domain/indicators/constants';

8. Missing edge case coverage when refactoring or moving functions
   → Each module must test its own edge cases directly

9. Unconditional assertion required — no if-guarded assertions
   ❌ if (result.includes('pattern')) { expect(result).toMatch('bullish_engulfing'); }
   ✅ expect(result).toMatch('bullish_engulfing');

10. Test duplication — each it() must test exactly one unique behavior

11. Provider pair must have symmetric error handling, test coverage, and naming
    → When one Provider changes, apply the same change to all Providers

12. Repeated identical parameter object passed to multiple function calls
    → Extract to const (regular code) or useMemo (hooks)

13. Test describe text promises assertions not verified by its it() cases

14. Circular dependency between modules
    → Extract shared constant to a third file to break the cycle

15. Type field added but test mock objects not updated
    → All mock/fixture objects must match the updated interface
```
