# Code Review Guidelines

All review comments must be written in **Korean**.

---

## Reference Documents

Before reviewing, read the following project documents in order:

1. `docs/conventions/CONVENTIONS.md` — coding paradigm, TypeScript rules, comments, change synchronization, i18n, layer dependency rules
   - `docs/conventions/REACT.md` — hooks, components, effects, charts, Tailwind, React Query (when client code is touched)
   - `docs/conventions/SERVER.md` — Server Actions, I/O, concurrency, data cache, DB (when server code is touched)
2. `docs/conventions/TESTING.md` — test structure, mocking, fixtures, e2e (when tests are touched)
3. `src/<layer>/CLAUDE.md` for each touched layer (and `skills/CLAUDE.md`, `docs/conventions/TOOLCHAIN.md` when relevant)
4. `docs/conventions/FF.md` — FF 4 principles: Readability, Predictability, Cohesion, Coupling
5. `docs/product/DOMAIN.md` — indicator specs, domain rules, IndicatorResult structure
6. `docs/conventions/DESIGN.md` — chart color constants, Tailwind token rules

Apply all rules defined in these documents as your review criteria.
Do not rely on general knowledge — always derive criteria from the documents above.

---

## Test Scope

All measured FSD layers — including `src/app/**` and `src/proxy.ts` — are part of the
~90% coverage target. Apply the coverage rules in `docs/conventions/CONVENTIONS.md` (§Coverage Targets).
Do NOT treat `app/` as test-exempt. (`components/` is a pre-FSD path that no longer exists.)
