# Test Layer Rules

## Core Principle

Tests cover **domain and infrastructure only**. Coverage target: **100%**.

**Test rules:** `→ see docs/CONVENTIONS.md` "Test Rules" section for full structure and conventions.

---

## Test Scope

```
✅ Covered: src/domain/**
✅ Covered: src/infrastructure/**
❌ Not covered: src/components/** (optional)
❌ Not covered: src/app/** (optional)
```

---

## Directory Structure

Mirror the source structure:

```
__tests__/
├── domain/
│   ├── indicators/
│   │   ├── rsi.test.ts
│   │   └── ...
│   └── analysis/
│       └── prompt.test.ts
└── infrastructure/
    ├── ai/
    ├── market/
    └── skills/
```

---

## Key Rules

- Use `describe` / `it` blocks — no `test()` at top level
- 2–5 levels of nesting allowed
- Mock **external dependencies only** — never mock domain functions
- Use `jest.mock()` at module level, reset mocks in `beforeEach`
- `toBeCloseTo` for floating-point comparisons
