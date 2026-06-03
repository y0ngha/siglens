---
name: coverage-pr-patterns
description: Recurring review signals for test-only coverage-raising PRs in siglens (next/dynamic mock, handler-coverage tests, comment line-refs)
metadata:
  type: project
---

Test-only coverage PRs (raising changed files to ≥90%) recur in siglens. When reviewing them, focus on falsifiability, not coverage numbers.

**Why:** These PRs add no production source — the only risk is padding/tautological tests that hit lines without catching regressions (MISTAKES.md Tests #13, #13.5).

**How to apply — patterns seen in `feat/symbol-test-coverage-90`:**
- `next/dynamic` mocked to invoke the loader factory (`void loader()`) so the `import().then()` arrow gets covered, then return a lightweight Stub. This is sound IF a sibling `vi.mock` stubs the dynamically-imported module so `void loader()` doesn't pull heavy deps. The Stub's testid (not the real component's) is what gets asserted for gating-branch tests — verify the gating condition `{a && b && <X/>}` has true/false/partial cases.
- Event-handler coverage tests (popstate/pageshow/bfcache) that start in the SAME state they assert after the event are weakly falsifiable — they cover the handler line but can't detect a broken reset (nothing to reset FROM). A genuinely falsifiable variant starts in an advanced phase (e.g. callCount-based mock returning submitted=true) and asserts the reset landed. Flag the weak ones as recommended.
- Comments referencing source line numbers ("lines 24–25 of X.tsx") drift silently — recommended-level finding per MISTAKES.md 15.6.
- `vi.fn() as unknown as <Signature>` in test files is the accepted mock-typing exception (MISTAKES.md TS #7) — do NOT flag.
