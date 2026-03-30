# Test Layer Rules

## Core Principle

Tests cover **domain and infrastructure only**. No UI/component tests.
Coverage target: **100%** for domain and infrastructure.

---

## Test Scope

```
✅ Covered: src/domain/**
✅ Covered: src/infrastructure/**
❌ Not covered: src/components/** (no UI tests)
❌ Not covered: src/app/** (no route handler tests)
❌ Not covered: src/lib/** (trivial utilities)
```

---

## Directory Structure

Mirror the source structure:

```
__tests__/
├── domain/
│   ├── indicators/
│   │   ├── rsi.test.ts
│   │   ├── macd.test.ts
│   │   └── ...
│   └── analysis/
│       └── prompt.test.ts
└── infrastructure/
    ├── ai/
    │   └── claude.test.ts
    ├── market/
    │   └── alpaca.test.ts
    └── skills/
        └── loader.test.ts
```

---

## Test Rules

- Test file naming: `{source-file-name}.test.ts`
- Use `describe` / `it` blocks — no `test()` at the top level
- Always structure as **3 levels**: `describe(module)` > `describe(function)` > `it(case)`
- Each `it` block tests exactly **one behavior**
- Use descriptive test names that state expected behavior

```typescript
// ✅ Correct structure
describe('RSI', () => {
  describe('calculateRSI', () => {
    it('returns empty array when input length is less than period', () => { ... });
    it('calculates RSI correctly for standard 14-period', () => { ... });
  });
});

// ❌ Forbidden
test('RSI works', () => { ... });
```

---

## Assertion Rules

- Use `toBe` for primitives, `toEqual` for objects/arrays
- Use `toBeCloseTo` for floating-point comparisons
- For error testing: `expect(() => fn()).toThrow()`
- Test edge cases: empty arrays, boundary values, invalid inputs

---

## Mock Rules

- Mock **external dependencies only** (API calls, file I/O)
- Never mock domain functions — test them directly with real inputs
- Use `jest.mock()` at module level, not inside test blocks
- Reset mocks in `beforeEach` or `afterEach`

---

## Common Mistakes

- Using `test()` instead of `describe/it` → use 3-level structure
- Testing implementation details instead of behavior → test inputs/outputs
- Missing edge cases → always test empty, boundary, and error cases
- Floating-point exact comparison → use `toBeCloseTo`
- Mocking domain functions → test with real inputs/outputs
