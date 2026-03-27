# Code Review Guidelines

All review comments must be written in **Korean**.

---

## Reference Documents

Before reviewing, read the following project documents in order:

1. `docs/CONVENTIONS.md` — coding paradigm, TypeScript rules, component rules, layer dependency rules, React Query rules
2. `docs/MISTAKES.md` — common mistakes to flag (highest priority)
3. `docs/FF.md` — FF 4 principles: Readability, Predictability, Cohesion, Coupling
4. `docs/DOMAIN.md` — indicator specs, domain rules, IndicatorResult structure
5. `docs/DESIGN.md` — chart color constants, Tailwind token rules

Apply all rules defined in these documents as your review criteria.
Do not rely on general knowledge — always derive criteria from the documents above.

---

## Test Scope

`components/` and `app/` are explicitly excluded from test coverage.
Do not request or write test files for them.
