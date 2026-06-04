# Code Review Guidelines

All review comments must be written in **Korean**.

---

## Reference Documents

Before reviewing, read the following project documents in order:

1. `docs/conventions/CONVENTIONS.md` — coding paradigm, TypeScript rules, component rules, layer dependency rules, React Query rules
2. `docs/workflows/MISTAKES.md` — common mistakes to flag (highest priority)
3. `docs/conventions/FF.md` — FF 4 principles: Readability, Predictability, Cohesion, Coupling
4. `docs/product/DOMAIN.md` — indicator specs, domain rules, IndicatorResult structure
5. `docs/conventions/DESIGN.md` — chart color constants, Tailwind token rules

Apply all rules defined in these documents as your review criteria.
Do not rely on general knowledge — always derive criteria from the documents above.

---

## Test Scope

All measured FSD layers — including `src/app/**` and `src/proxy.ts` — are part of the
~90% coverage target. Apply the coverage rules in `docs/conventions/CONVENTIONS.md` (§Coverage Targets).
Do NOT treat `app/` as test-exempt. (`components/` is a pre-FSD path that no longer exists.)
