---
name: FF Principles
description: Condensed FF 4 principles for code review — no examples
type: reference
---

# FF Principles (Condensed)

## Readability — Is it easy to read?
- **1-A**: Separate code that doesn't run simultaneously → split by state, use object maps not if/else chains
- **1-B**: Abstract implementation details → extract into named hooks/functions
- **1-C**: Name complex conditions → assign boolean expressions to named variables
- **1-D**: Name magic numbers → extract to named constants
- **1-E**: Keep ternary operators simple → use object maps or early returns; no nested ternaries
- **1-F**: Write range conditions left to right → `b <= a && a <= c` form
- **1-G**: Minimize viewpoint shifts → code should read top to bottom without jumping around
- **1-H**: Don't group by logic type → each hook/function owns one narrow concern

## Predictability — Can you predict the behavior?
- **2-A**: Avoid name collisions → include context in names
- **2-B**: Unify return types across same-family functions → `(T | null)[]` pattern for indicators
- **2-C**: Expose hidden logic → no side effects inside pure functions; caller controls side effects

## Cohesion — Does code that should change together, change together?
- **3-A**: Keep files that change together in the same directory → colocate
- **3-B**: Centralize magic numbers as constants → one source of truth
- **3-C**: Match cohesion level to unit of change → field-level vs form-level based on change frequency

## Coupling — Is the impact range of a change narrow?
- **4-A**: Manage one responsibility at a time → split hooks/functions by concern
- **4-B**: Allow duplicate code (AHA) → abstract only after 3 repetitions
- **4-C**: Remove Props Drilling → use Context or component composition

## Priority (Siglens-specific)
- `domain/indicators` → Predictability first (unified return types, consistent null handling)
- `components/` → Readability first (minimize conditional branching)
- `infrastructure/` → Cohesion first (replacing a Provider modifies only one file)
