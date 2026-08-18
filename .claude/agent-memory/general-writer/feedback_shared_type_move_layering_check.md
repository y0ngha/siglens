---
name: shared-type-move-layering-check
description: When a "move file from shared/lib to entities/lib" instruction is given, check whether any type it exports is also imported by a shared-layer file before moving the whole file
metadata:
  type: feedback
---

When an upstream instruction says "move `shared/lib/X.ts` to `entities/<slice>/lib/X.ts` because it's entity domain logic" (per MISTAKES.md Architecture #4), grep every importer of that file first. If a `shared/**` file (e.g. `shared/db/types.ts`) imports a type from it, moving the whole file verbatim creates a `shared → entities` import, which violates FSD layering (only a narrow, explicitly-documented exception table permits that, e.g. `shared/CLAUDE.md` "의도적 예외" — check it before assuming a new instance is fine).

**Why:** Caught this in PR #735 (siglens, `feat/kr-ticker-listing-status`): `krTickerReconcile.ts` defined `KrTickerListingRow`, which `shared/db/types.ts` imported as the return type of a `KoreanTickerRepository` method. The review-agent suggestion to move the whole file to `entities/ticker/lib/` would have broken layering. Fix: split — leave the type in `shared/db/types.ts` (canonical home for repository row/contract types, consistent with how `KoreanTickerEntry` already lives in `shared/lib/types.ts`), move only the pure functions/constants to `entities/*/lib/`, and have the entities-layer file `import type` the row shape back from `shared/db/types` (entities → shared is always fine, and type-only imports are erased so they don't drag in `server-only` at runtime — verified via `isolatedModules: true` in tsconfig).

**How to apply:** Before any file move driven by an architecture-boundary complaint, `grep -rln` the file's exported symbols across `src/shared/**` first. If found, split type vs. logic instead of moving the whole file, and note the deviation in the exit-signal `notes` field rather than silently doing the literal instruction.
