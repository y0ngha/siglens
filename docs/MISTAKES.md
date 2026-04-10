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
   ❌ map.get(key) called twice with the same key
   ✅ const value = map.get(key); reuse value

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
```

---

## Components

```
1. Managing timeframe as a URL query parameter
   → Manage as client state only

2. External callback prop in useEffect dependency array → infinite loops
   → Use useEffectEvent to wrap callback props

3. useState lazy initializer derives value from props
   → Initializer runs only once; use useEffect to sync when props change

4. Missing aria-expanded on accordion triggers

5. Unused Tailwind classes (e.g. grid classes on flex containers)
   → Verify parent layout model before applying layout-specific classes

6. Props declared but not connected to callbacks (latent bugs)
   → If a callback prop exists, it must actually be invoked

7. Repeating identical JSX structure 2+ times
   → Extract to a data array + .map() pattern

8. DOM event listener in useEffect instead of custom hook
   → Extract to useOnClickOutside, useEscapeKey, etc.

9. Custom hook params missing optional properties present in sibling hooks
   → All hooks in the same family must accept consistent parameter patterns
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
```

---

## Lightweight Charts

1. Missing chart.remove() cleanup or listener unsubscribe before chart.remove()
   → Always call unsubscribeVisibleLogicalRangeChange before chart.remove() to prevent "Object is disposed" errors
   → Use a ref pattern for onChartRemove callback to capture cleanup logic and guard chartRef.current in ResizeObserver

2. Passing domain null values directly to setData
   → Convert to WhitespaceData({ time })

3. Adding volume/RSI to the main pane
   → Always add to a separate pane (index 1, 2, ...)

4. Derived className or style objects recreated on every render without memoization
   → Props-derived objects (inputClass, buttonClass computed from size prop) must use useMemo to prevent recreation
   → Prevents unnecessary re-renders when object identity is compared

---

## Pure Function Contracts

```
1. Utility functions must guard all valid input ranges explicitly
   → Pure functions must handle edge cases so callers cannot receive invalid results
   → Include guards for both lower bounds (null, negative) and upper bounds (array length, max values)
   ❌ function resolveBarIndex(index) { if (index < 0) return 0; return index; }  // missing upper bound
   ✅ function resolveBarIndex(index) { if (index < 0) return 0; if (index >= length) return length - 1; return index; }

2. External dependencies must fail gracefully consistently across the module
   → All calls to the same external service should use identical error handling patterns
   → If one call uses try-catch, all calls to that service should be wrapped identically
   ❌ cache.get(key)  // no try-catch, but cache.set(key, val) has try-catch
   ✅ const value = await cache.get(key).catch(error => { console.error(...); return null; });
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
```
