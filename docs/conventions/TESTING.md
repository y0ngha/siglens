# Testing Rules

Test conventions for Siglens (split out of CONVENTIONS.md). Cite rules as `TESTING.md#TE-N`.

**Rule IDs**: every rule carries a stable `TE-N` ID with an anchor line above its heading. IDs are never renumbered or reused; a new rule takes the highest existing number + 1 (gaps such as TE-32/TE-35 stay empty). Sections group rules by topic, so numbers are not contiguous within a section.

## File Locations

```
# FSD 슬라이스 colocated
src/entities/user/__tests__/lib/loginUser.test.ts
src/features/auth-login/__tests__/actions/loginAction.test.ts
src/shared/lib/__tests__/cn.test.ts

# 공유 fixture/utility (여러 테스트에서 사용)
src/__tests__/fixtures/jsonResponse.ts
src/__tests__/utils/makeFormData.ts
```

## Coverage Targets

```
entities/       90%
features/       90%
shared/         90%
widgets/        90%
views/          90%
app/            90%
src/proxy.ts    90%
cache-handler/  90%
```

The project target is 90% coverage across all measured FSD layers.
Current Vitest coverage includes `src/entities/**`, `src/features/**`, `src/shared/**`,
`src/widgets/**`, `src/views/**`, `src/app/**`, `src/proxy.ts`, and `cache-handler/**`,
excluding declaration files, type/model-only files, and test utilities.

`src/views/**` is the FSD `pages` layer — it lives under `views/` because creating
`src/pages/` would activate Next's legacy Pages Router. `cache-handler/**` sits outside
`src/` but is production code (the S3-backed ISR cache handler); leaving it out of
`include` would silently exempt it from the threshold.

UI layers are part of the coverage target. Prefer unit tests for pure view utilities,
hook tests for stateful UI behavior, component tests for user-visible states, and
integration tests for critical cross-layer flows.

<a id="TE-16"></a>

#### TE-16 — Each module tests its own edge cases

When code is refactored or moved, the destination module carries the edge-case tests for its own behavior. A consumer's tests do not substitute for the moved function's tests.

<a id="TE-5"></a>

#### TE-5 — New helpers, actions, adapters and policy components need their own tests

Every new pure helper, Server Action wrapper, API/adapter function and policy-invariant component gets a colocated test file that reaches the project coverage target. Thin wrappers that delegate to `@y0ngha/siglens-core` still need a forwarding test (arguments and result pass through unchanged).

- ❌ A new `callGeminiWithKeyFallback` added to an adapter with no colocated test file.
- ✅ A `__tests__/` file next to it covering undefined input, missing levels, duplicates, zero values and the empty result.

## Test Structure

```typescript
// ✅ 2 levels: describe → it (simple cases)
describe('formatVolume', () => {
    it('returns "1.2M" for 1200000', () => { ... });
    it('returns "0" for 0', () => { ... });
});

// ✅ 3 levels: describe → describe(context) → it
describe('calculateRSI', () => {
    describe('when input length is less than period', () => {
        it('returns an all-null array', () => {
            expect(calculateRSI([100, 101], 14)).toEqual([null, null]);
        });
    });
    describe('when input is valid', () => {
        it('returns null for the first period - 1 values', () => { ... });
        it('returns values between 0 and 100', () => { ... });
    });
});

// ✅ 4 levels: describe(module) → describe(function) → describe(context) → it
describe('prompt', () => {
    describe('buildAnalysisPrompt', () => {
        describe('current market section', () => {
            it('includes "No data available" when bars is empty', () => { ... });
        });
    });
});

// ✅ 5 levels: for complex modules requiring fine-grained context separation
describe('candle-detection', () => {
    describe('detectCandlePatternEntries', () => {
        describe('multi-candle pattern detection', () => {
            describe('when a 3-bar pattern exists', () => {
                it('excludes single patterns on involved bars', () => { ... });
            });
        });
    });
});
```

Test structure allows **2 to 5 levels**. Choose the appropriate depth based on module complexity.
6+ levels are prohibited — merge context into describe text to reduce nesting.

<a id="TE-17"></a>

#### TE-17 — Hooks live inside describe

`beforeEach`/`beforeAll`/`afterEach` are declared inside the `describe` they serve, not at module level. Module-level hooks leak into every test in the file and hide which block depends on them.

<a id="TE-18"></a>

#### TE-18 — One behavior per it()

Each `it()` verifies exactly one unique behavior. Duplicated cases inflate the count without adding protection.

<a id="TE-19"></a>

#### TE-19 — describe text states only the shared precondition

A `describe()` name describes only the precondition or feature shared by all its `it()` cases. If a case contradicts the describe text, move it to its own `describe`.

- ❌ `describe('이메일 검증 (email_mismatch)')` containing `it('이메일이 일치하여 성공')`.
- ✅ `describe('이메일 불일치')` and `describe('이메일 정규화')` as separate blocks.

<a id="TE-20"></a>

#### TE-20 — it() names match what the assertions verify

An overstated name hides incomplete coverage. Rename the test or add assertions until they match. Titles that say "all", "every" or "remaining" verify the full set through derived logic (the complement of a list, not a second hardcoded list), and a title must not claim a path (for example a locale switch) the test never exercises. Applies to unit, integration and E2E tests.

- ❌ `it('uses 32_768 for remaining Gemini models', () => hardcodedGeminiList.forEach(...))` — misses new additions.
- ✅ `it('default budget for unclassified Gemini models', () => derived.forEach(...))`.

## Required Test Cases

<a id="TE-21"></a>

#### TE-21 — Return-type changes require the null case

When a return type becomes nullable (`T[]` to `(T | null)[]`), add a test for the null case.

<a id="TE-22"></a>

#### TE-22 — Every new field gets an it()

Each new field or indicator output needs at least one `it()` verifying its presence. When a function starts threading a new field through several call sites, assert it at each site with a non-default value.

<a id="TE-23"></a>

#### TE-23 — Period-based indicators pin reference values

Sign-only checks (`toBeGreaterThan(0)`) do not verify a calculation. Every period-based indicator test includes `toBeCloseTo` against manually calculated expected values. Warm-up constants are imported from the source, and boundary constants cover the whole dependency chain (for example nested window calculations).

### Required Test Cases for Period-Based Indicators

| Case | it description |
|------|----------------|
| Empty array | 빈 배열을 반환한다 |
| Input shorter than period | 전부 null인 배열을 반환한다 |
| Initial null range | 처음 period - 1개의 값은 null이다 |
| Valid value range | period번째 이후 값은 null이 아닌 숫자다 |
| Calculation accuracy | 첫 번째 값이 명세와 일치한다 |

## Mocking

```typescript
vi.mock('@/shared/api/fmp/httpClient');

const mockFmpBarsResponse = [{ date: '2026-05-25', open: 100, high: 101, low: 99, close: 100.5, volume: 1000 }];
```

<a id="TE-1"></a>

#### TE-1 — vi.mock goes above all imports

All static `import` statements stay contiguous at the top. `vi.mock(...)` is hoisted by Vitest, so placing it above the imports is safe and idiomatic; never sandwich it between two imports (it trips `import/first`).

- ❌ `import { withRetry } from '...'; vi.mock('@/shared/lib/sleep', ...); import { sleep } from '@/shared/lib/sleep';`
- ✅ `vi.mock('@/shared/lib/sleep', ...); import { withRetry } from '...'; import { sleep } from '@/shared/lib/sleep';`

<a id="TE-2"></a>

#### TE-2 — Mock per file and keep isolation honest

Declare mocks at the top of each test file and resolve aliases through tsconfig paths. Do not add global mocks to `vitest.setup.base.ts`: they hide modules that forgot to declare a dependency, and accidental protection (a global fetch stub, an environment gate) silently disappears when the global changes. Any test that reaches real I/O (LLM, Redis, HTTP) mocks each dependency explicitly, and a new external package added to production code is mocked in every test file that loads that module. Verify isolation by removing the global stub: tests must still pass or fail loudly.

Also: polling loops under a mocked interval must terminate (resolve once, then return a never-settling promise), and after repointing a mock in a refactor, re-run the failure-path tests alone (`yarn vitest run -t pattern`) to catch resets masked by the full suite.

- ❌ `vi.mock('@upstash/redis', ...)` placed in the global setup file.
- ✅ Per-file `vi.mock(...)` plus `beforeEach` resets.

<a id="TE-3"></a>

#### TE-3 — Mocks mirror the real API as it expands

When a component gains a prop or a module gains an export, update every test mock of it. Partial module mocks use `importOriginal` so real exports survive; mocks that destructure only the props in use silently ignore new ones. Before adding an export to a module that tests partially mock, grep test files for `vi.mock('<module path>'` and update each factory (or put the new export in a separate file). Barrel files are banned, so this applies to any frequently mocked defining file.

Module-load reads count too: importing a new constant from a partially mocked module into a file that reads it at load time breaks every test whose mock omits it. Keep the literal and a parity test instead (CONVENTIONS.md#CS-3).

- ❌ `vi.mock('@/shared/lib/seo', () => ({ createMetadata: vi.fn() }))` — a newly added export is `undefined` for every consumer.
- ✅ `vi.mock('@/shared/lib/seo', async importOriginal => ({ ...(await importOriginal<typeof import('@/shared/lib/seo')>()), createMetadata: vi.fn() }))`.

<a id="TE-24"></a>

#### TE-24 — Mocks implement every method the code under test calls

A repository, service or client mock implements all methods the code calls; update it whenever the code adds a dependency call.

- ❌ `{ fetch: vi.fn() }` when the action also calls `listBySymbol`.

<a id="TE-25"></a>

#### TE-25 — Every spy has an assertion; new dependencies are asserted structurally

Remove a spy that is never asserted. When a dependency gains fields, replace `expect.any(Object)` with `expect.objectContaining({ ... })` so a dropped field fails the test.

<a id="TE-26"></a>

#### TE-26 — Assert new arguments with non-default values

When a function starts passing a new argument or dependency to a mocked collaborator, every call site's test asserts it with a value that differs from the default (`'KRW'`, not `'USD'`). Structural matchers that omit the new field tolerate it being dropped.

<a id="TE-27"></a>

#### TE-27 — Never assert by call index

Do not use `mock.calls[0]` or `[1]`: a late call from an earlier test can occupy the slot. Find the call by a discriminating argument or use `toHaveBeenCalledWith`.

<a id="TE-28"></a>

#### TE-28 — Test-only resets are separate exports

Expose reset hooks as `__reset<Name>ForTests` exports, never as methods on the production interface.

<a id="TE-29"></a>

#### TE-29 — Test default behavior by truly unsetting inputs

Simulate a missing env var with `vi.stubEnv(name, undefined)`, not `''`; an empty string can accidentally satisfy a numeric fallback such as `Number('') === 0`.

<a id="TE-30"></a>

#### TE-30 — Clean up on every path

Restore spies in `afterEach` and release held resources (pending promises, timers, servers) in `finally`, so the failure path a test exists to catch does not leak them into later tests.

<a id="TE-31"></a>

#### TE-31 — Trim copied mock headers

A new test file keeps only the mocks its own code path executes. Do not carry over a neighbour's mock block or comments about another change.

## Assertions

<a id="TE-12"></a>

#### TE-12 — Assertions must be falsifiable

Use exact matchers when the value is deterministic, avoid compound boolean assertions, and assert every half of an additive guarantee.

- Imprecise matchers (`toBeGreaterThan(0)`, `toBeDefined()`) let 0, 2 and 10 all pass when the count is always 1. ❌ `expect(items.length).toBeGreaterThan(0)` ✅ `expect(items.length).toBe(1)`.
- `||`/`&&`/ternary inside `expect` passes on several failure modes. ❌ `expect(arg === undefined || arg.force !== true).toBe(true)` ✅ `expect(firstArgs?.[4]).toEqual({ force: false })`.
- Additive behavior (layer A persists, layer B appended) asserts both parts.
- Regression bounds are tight: a `>=` bound that the broken code also satisfies is vacuous. Use equality or the narrowest bound, and revert-check it against the broken implementation.

<a id="TE-10"></a>

#### TE-10 — Never redefine production code or values in tests

Import and exercise the real function; a local redefinition makes the test tautological. Expected values that the module exports (labels, thresholds) are imported too, not retyped.

- ❌ `const shouldShowAd = (x) => x.enabled; expect(shouldShowAd(mock)).toBe(true)`.
- ✅ `import { shouldShowAd } from '@/shared/lib/ads'`.

<a id="TE-6"></a>

#### TE-6 — Import boundary constants

Period and threshold constants come from the source (`import { RSI_DEFAULT_PERIOD } from '@y0ngha/siglens-core'`), not a local `const TEST_PERIOD = 14`. Do not mirror a private source constant by hand or leave literal copies in assertions and log strings after the source is converted.

<a id="TE-4"></a>

#### TE-4 — Cover both sides of every branch

A new `if (value < THRESHOLD)` branch needs a case for the branch taken and one for not taken, plus values just below and just above the boundary. Mutation-check each new branch (delete or invert it and confirm a test fails) and confirm the test fails for the intended reason, not an unrelated clock or timeout. A new field in a size-budgeted payload is tested against the budget trimmer.

- ❌ Testing `formatImpliedMove(0.04)` for the floor branch with only `value <= 0` cases.
- ✅ Below-floor, above-floor and exact-boundary cases.

<a id="TE-33"></a>

#### TE-33 — Unordered results use order-independent matchers

For results without a defined order use `expect.arrayContaining` plus a length check, not `toEqual` on a fixed order.

<a id="TE-34"></a>

#### TE-34 — Pin pairings, not just sets

A query or mapping test asserts column-to-value (key-to-value) pairing with distinct values per field. Asserting the set of columns and the set of values separately passes when two are swapped.

## Fixtures

<a id="TE-14"></a>

#### TE-14 — Fixture values differ from assertion literals

If a fixture value equals the literal in the assertion, reverting a dynamic prop to a hardcoded string still passes. Provide variants with distinct values and assert each. Never inherit values across fixtures by spreading; set differing properties explicitly.

- ❌ `const KR_SCOPE = { ...TEST_SCOPE, regionCode: 'KR' }` — `marketLabel` is still the US value.
- ✅ `const KR_SCOPE = { marketLabel: '한국 증시', regionCode: 'KR' }`.

<a id="TE-15"></a>

#### TE-15 — Fixture shape equals the real call-site envelope

A helper that matches on paths, keys or prefixes needs at least one fixture carrying the exact envelope the production caller passes; tests with pre-unwrapped data stay green while the helper no-ops in production. Build fixtures from the real shape (`importOriginal`, or run them through the mapping layer) and populate every field, especially new ones, with non-default values. Hand-built fixtures and `toMatchObject` that omit a new field tolerate its omission.

- ❌ `dropSupersededPaths([{ path: 'actionRecommendation.exit' }])` while production passes `result.actionRecommendation.exit`.
- ✅ A fixture with the full `{ status, result: { ... } }` envelope plus a route-level assertion that the payload reaches the helper.

<a id="TE-36"></a>

#### TE-36 — Fixtures follow interface changes

When a type gains a field, update every mock and fixture object to the updated interface.

## Wiring

<a id="TE-11"></a>

#### TE-11 — Test consumer wiring where the consumer lives

Testing a helper with an injected mock proves the helper calls it, not that the real consumer passes the right thing. For a helper extracted to de-duplicate wiring, and for callbacks or options handed to libraries, write a test that drives each consumer through the shared seam and fails when a consumer stops calling it; mutation-verify by replacing the call with a no-op. Do not mock the receiving library with classes that swallow constructor arguments. Values composed from several sources (for example derived JSON-LD) are asserted at the composition point.

- ❌ `Sidebar.test.tsx` injects a mock `onNavigate`; deleting the parent's `onNavigate={() => setDrawerOpen(false)}` still passes.
- ✅ A parent test opens the drawer, clicks a link inside, and asserts navigation and the drawer closing.

## Retained Code

<a id="TE-13"></a>

#### TE-13 — Code kept for a reason needs a test that fails without it

Defensive guards, fallbacks, timeouts and degradations kept "because X" need a test that fails when the code is removed. When swapping a mechanism (for example an external store for in-memory state), list the roles the old code played on failure paths and pin each with a test that passes on the old code and fails on the new one.

- ❌ A fallback cache write kept "for DB failure absorption" with no test exercising a DB write failure.
- ✅ A test that fails the DB write and asserts the fallback entry exists.

## Time, Flakes & Isolation

<a id="TE-7"></a>

#### TE-7 — Mock every time source

Code using `Date.now()` or `new Date()` runs under a mocked clock (`vi.useFakeTimers` / `vi.setSystemTime`). Hardcoded expected TTLs or dates without a fixed clock make flaky tests.

<a id="TE-9"></a>

#### TE-9 — Wait for the passive-effect listener before dispatching

A document listener registered in `useEffect`/`useEffectEvent` attaches in the passive-effect phase. Under CI load, dispatching right after render can fire before it attaches and the event is lost. Fix the race, not the timeout: await a sibling of the same effect batch (for example the dialog receiving focus), then dispatch. Never blindly bump timeouts.

- ❌ `render(); await findByText('first'); fireEvent.keyDown(document, { key: 'Escape' });`
- ✅ `await waitFor(() => expect(getByRole('dialog')).toHaveFocus()); fireEvent.keyDown(...)`.

<a id="TE-37"></a>

#### TE-37 — Non-isolated lanes restore every global they mutate

`unstubAllGlobals()` and `restoreAllMocks()` do not undo `Object.defineProperty`, timer overrides or prototype mutations. Capture the original descriptor before the test and restore it per test, and reset root-element state (`data-theme`, `style.colorScheme`) in the shared `afterEach`.

<a id="TE-38"></a>

#### TE-38 — No reimport-based reset

Do not reset module state by re-importing (`require.cache` deletion, dynamic re-require): the side effects blur what the test verifies and depend on run order. Mock flags at the test boundary (`vi.mock`, `vi.hoisted`) and make setup and teardown explicit.

<a id="TE-39"></a>

#### TE-39 — Reset React-managed hoistables after cleanup

Reset `document.title` and other hoistables only after RTL `cleanup()`. Clearing them first orphans React's `<title>` element and `removeChild` fails. Order: `cleanup()`, then reset.

<a id="TE-40"></a>

#### TE-40 — Hooks that attach DOM listeners test every trigger

Test every trigger event (for example pointerup, wheel, dblclick), listener removal on unmount, `cancelAnimationFrame` on unmount, rAF coalescing, and the no-op pending frame after teardown.

## Source Guards

<a id="TE-41"></a>

#### TE-41 — Follow every edge kind in import-graph guards

A guard that walks imports follows `import … from`, `export … from` re-exports and dynamic imports, and handles directives preceded by comments.

<a id="TE-42"></a>

#### TE-42 — Strip comments before matching source text

A safety guard that matches a comment instead of the code line passes vacuously. Strip comments before matching, and pin explicit lists (excluded columns, allowed paths) rather than patterns.

<a id="TE-43"></a>

#### TE-43 — Enumerate every request-context API

A static-rendering guard lists every framework API that reads request context (locale-less `getTranslations`, `getLocale`, `getMessages`, `headers`, `cookies`), not just the one that failed first.

<a id="TE-44"></a>

#### TE-44 — No line-number keys; run guards before commit

Guard exceptions keyed on line numbers break on any edit above them. Key on stable identifiers and run `yarn test src/__tests__/guards` before committing. When a script feeds a config list, dry-run its output against the invariant tests over that list.

## Third-Party Contracts

<a id="TE-8"></a>

#### TE-8 — Verify against the real client, not a mock

Mocked clients define the mock's behavior, not the library's. When a design depends on a third-party client's serialization, encoding or pipelining, test the real client instance over a stubbed transport (fetch/network) and assert both the request it sends and how it parses the response. The same holds for logic that reads framework-internal request state: verify with a production build and a real request, because hand-built mocks assert the reality they encode. Metadata that only changes at hydration time needs an e2e check.

- ❌ A cache-compression design verified only against a `Map` mock while the real client base64-encodes responses.
- ✅ `new Redis({ url, token })` with a stubbed `fetch` returning canned REST responses, asserting request encoding and response decoding.

<a id="TE-45"></a>

#### TE-45 — Re-verify security semantics when swapping transports

When replacing a DB driver, HTTP client or cache backend, compare TLS verification, encryption mode and authentication explicitly; defaults differ between libraries (for example one driver's `sslmode=require` encrypts without verifying the certificate). Verify with a production build against a test server presenting a self-signed certificate and assert the connection is rejected.

## E2E

<a id="TE-46"></a>

#### TE-46 — Destructive authed specs use a throwaway user

Playwright specs routed to the authed project inherit one shared seeded `storageState`, and spec order is nondeterministic. A spec that logs out or deletes the user overrides `storageState` to anonymous and provisions its own throwaway user; it never mutates the shared session.

- ❌ A logout spec on the shared state deletes the session row; a later sibling fails with a 302 to `/login`.
- ✅ `test.use({ storageState: { cookies: [], origins: [] } })`, sign up, then log out only the throwaway user.

<a id="TE-47"></a>

#### TE-47 — Delete manual seeds from the shared e2e database

A leftover manually seeded row (for example a high-priority notice) is picked up first by the app and makes unrelated specs fail with the wrong data. Remove manual seeds after verification and re-run the specs.

<a id="TE-48"></a>

#### TE-48 — Re-verify spec premises when a trigger changes

Typecheck, lint and Vitest never execute Playwright specs. When a source trigger (timer, event producer, condition) is removed or narrowed, grep `e2e/specs/` for it and re-check sibling specs that depend on its timing.

<a id="TE-49"></a>

#### TE-49 — Keep unit, integration and e2e layers in sync

When behavior or a constant changes, update every layer in the same change; scoped `yarn test` runs skip e2e, so a mismatch only surfaces in CI. Import constants into e2e specs instead of restating the literal, and assert current catalog strings rather than old copy.

<a id="TE-50"></a>

#### TE-50 — Assert inline JSON through the SSR response

Playwright `hasText` cannot read `<script>` element text. Fetch the SSR HTML with `page.request.get()` and assert on the body.

<a id="TE-51"></a>

#### TE-51 — Stubs emit only production statuses

An e2e stub returns only the statuses production sends for that mode. An invented status (for example `cached` on re-analysis) lets UI code branch on a state that never occurs.

<a id="TE-52"></a>

#### TE-52 — Audit test doubles that parse vendor formats

Fake LLMs and similar doubles that parse a vendor or core message format break silently when the format changes. After a dependency upgrade, re-check each double against the new format.

<a id="TE-53"></a>

#### TE-53 — A test must fail when the behaviour it names is removed

Before keeping a test, remove or break the behaviour it claims to cover and confirm it fails. Tests that pass anyway are vacuous: a mocked query builder whose condition argument is never inspected, a SQL assertion built from short `toContain` fragments, a new tracking call with no click-and-assert test, a Redis Lua script whose `eval` is mocked so only the arguments are asserted (run the script against a real or emulated Redis, or assert its effects), or a "renders independently" test that mounts only the inner component. Render the real condition (for SQL, its text and params), assert the full clause, drive the instrumented element, and assert on the composed tree.

- ❌ `where` is mocked and never inspected, so dropping the date filter still passes.
- ✅ Render the condition to SQL plus params and assert both.
