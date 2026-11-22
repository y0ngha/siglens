# Testing Rules

Test conventions for Siglens (split out of CONVENTIONS.md). Cite rules as `TESTING.md#TE-N`.

**Rule IDs** follow the root `CLAUDE.md` "Rule IDs and references". Sections group rules by topic, so numbers are not contiguous within a section.

Retired IDs: TE-32, TE-35

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
src/instrumentation*.ts 90%
cache-handler/  90%
```

The project target is 90% coverage across all measured FSD layers.
The measured file set is `coverage.include`/`exclude` in `vitest.config.ts` (every layer plus `cache-handler/**`).
Measured weekly by the `coverage-weekly` workflow (per-layer table in the run summary); PR CI does not run coverage.

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

Test structure allows **2 to 5 levels** (`describe(module)` → `describe(function)` → `describe(context)` → `it`). Choose the appropriate depth based on module complexity.
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

<a id="TE-56"></a>

#### TE-56 — describe/it text uses the language of the sibling tests

A new `describe`/`it` name uses the same language as the other tests in that file (and its directory siblings). Mixed languages make the suite hard to scan and search; when adding a case to an existing file, match it, and rename on sight if a name drifted.

- ❌ `it('rounds half a cent up')` added to a file whose other cases are Korean.
- ✅ `it('반 센트는 올림한다')` in the same file.

<a id="TE-57"></a>

#### TE-57 — New hooks and branchy components get their own tests

A new custom hook, or a UI component with its own branches (states, empty/error paths, derived labels), gets a colocated test that drives it directly. Coverage through the parent's integration test alone leaves the branches unpinned and lets a regression in the extracted unit stay green.

- ❌ A hook split out of a component, covered only by the parent component's test.
- ✅ A `renderHook` test for the hook and a render test per branch of the component, next to the source.

## Required Test Cases

<a id="TE-21"></a>

#### TE-21 — Return-type changes require the null case

When a return type becomes nullable (`T[]` to `(T | null)[]`), add a test for the null case.

<a id="TE-22"></a>

#### TE-22 — Every new field gets an it()

Each new field or indicator output needs at least one `it()` verifying its presence. When a function starts threading a new field through several call sites, assert it at each site with a non-default value.

<a id="TE-23"></a>

#### TE-23 — Period-based indicators pin reference values

Sign-only checks (`toBeGreaterThan(0)`) do not verify a calculation. Every period-based indicator test includes `toBeCloseTo` against manually calculated expected values. Warm-up constants are imported from the source, and boundary constants cover the whole dependency chain (for example nested window calculations). Each one also covers an empty input, an input shorter than the window, and the warm-up boundary: the first `period - 1` values are `null`, or the output is shorter by the window, whichever the function returns.

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
- Production code never defends against a mock's missing method (`fn?.()` / `typeof x.method === 'function'`); complete the mock instead.

<a id="TE-25"></a>

#### TE-25 — Every spy has an assertion; new dependencies are asserted structurally

Remove a spy that is never asserted. When a dependency gains fields, replace `expect.any(Object)` with `expect.objectContaining({ ... })` so a dropped field fails the test.

<a id="TE-26"></a>

#### TE-26 — Assert new arguments with non-default values

When a function starts passing a new argument or dependency to a mocked collaborator, every call site's test asserts it with a value that differs from the default (`'KRW'`, not `'USD'`). Structural matchers that omit the new field tolerate it being dropped.

<a id="TE-27"></a>

#### TE-27 — Never assert by call index

Do not assert by position (`mock.calls[0]`, `.at(n)`, destructuring, `toHaveBeenNthCalledWith`): `clearMocks` is off in `vitest.config.ts`, so calls from earlier tests and late async calls stay in the list and can occupy the slot. Find the call by a discriminating argument or use `toHaveBeenCalledWith`. `codeRules.test.ts` (rule `mock-call-index`, per-file baseline, `TOOLCHAIN.md#TC-41`) fails any new one.

Assert what was written (the key and TTL), not just how many times the collaborator was called.

- ❌ `expect(set.mock.calls[0][0]).toBe(key)` or `expect(set).toHaveBeenCalledTimes(1)`.
- ✅ `expect(set).toHaveBeenCalledWith(key, value, ttl)`.

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
- Check that the serialized or compared value can carry the property under test. ❌ `expect(JSON.stringify(result)).not.toContain('boom')` to prove an `Error` is absent (an `Error` serializes to `{}`, so it always passes) ✅ assert on `result` directly (`expect(result).not.toBeInstanceOf(Error)`, or its `message`).
- Regression bounds are tight: a `>=` bound that the broken code also satisfies is vacuous. Use equality or the narrowest bound, and revert-check it against the broken implementation. A test added alongside a fix that still passes on the pre-fix code is not a pin: name it as path coverage, not as a regression guard for the fix.
- A test exercises the path its title claims and asserts every half of that claim. A "throws/rejects" test makes the callee itself reject (a callee that catches the error never reaches the path), and a "shows X without Y" test asserts both X present and Y absent.

<a id="TE-10"></a>

#### TE-10 — Never redefine production code or values in tests

Import and exercise the real function; a local redefinition makes the test tautological. Expected values that the module exports (labels, thresholds) are imported too, not retyped.

Exception: persisted or wire-level strings (storage keys, persisted event names, cookie names) are a contract with data already stored elsewhere. Pin them as literals in at least one test, especially when they are built by a factory or composed from a prefix; asserting against the same constant lets a rename pass while silently orphaning stored data.

- ❌ `const shouldShowAd = (x) => x.enabled; expect(shouldShowAd(mock)).toBe(true)`.
- ✅ `import { shouldShowAd } from '@/shared/lib/ads'`.
- ❌ A fixed-window test hard-codes `2021-06-25`, or a guard asserts `version === 6`; changing the constant or adding a version leaves the test silently checking the old value. ✅ Derive the date from the exported constant and the latest version from the data.

<a id="TE-6"></a>

#### TE-6 — Import boundary constants

Period and threshold constants come from the source (`import { RSI_DEFAULT_PERIOD } from '@y0ngha/siglens-core'`), not a local `const TEST_PERIOD = 14`. Do not mirror a private source constant by hand or leave literal copies in assertions and log strings after the source is converted.

<a id="TE-4"></a>

#### TE-4 — Cover both sides of every branch

A new `if (value < THRESHOLD)` branch needs a case for the branch taken and one for not taken, plus values just below and just above the boundary. Mutation-check each new branch (delete or invert it and confirm a test fails) and confirm the test fails for the intended reason, not an unrelated clock or timeout. A new field in a size-budgeted payload is tested against the budget trimmer.

- ❌ Testing `formatImpliedMove(0.04)` for the floor branch with only `value <= 0` cases.
- ✅ Below-floor, above-floor and exact-boundary cases.
- A rule stated as a condition on the input's state ("add the follow-up only when the lead is intact") is tested at the boundary where the implemented check and the stated condition disagree: ❌ only a too-long follow-up. ✅ also a clamped lead followed by a short follow-up.
- A branch that only logs (a new failure log on a non-OK response) is a branch: assert the log call, and give each sibling step the same non-OK case.

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

A helper that matches on paths, keys or prefixes needs at least one fixture carrying the exact envelope the production caller passes; tests with pre-unwrapped data stay green while the helper no-ops in production. Build fixtures from the real shape (`importOriginal`, or run them through the mapping layer) and populate every field, especially new ones, with non-default values. Hand-built fixtures and `toMatchObject` that omit a new field tolerate its omission. The same holds for URL and pattern assertions on framework-emitted output (metadata image routes get a hash suffix): read the framework source or a built page before writing the pattern. The same holds for text heuristics over real documents (headline extraction, picking the primary document): derive the rules and the cases from cleaned samples of real documents, because hand-made text skips split titles, boilerplate and odd attachments.

Values a surface formats (scores, prices, ratios) use production-shaped unrounded numbers (`24.48367166813769`, not `24`) in fixtures for every text and metadata surface (title, description, structured data); integer fixtures hide a missing rounding step.

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

<a id="TE-58"></a>

#### TE-58 — Source-reading guards follow the code when it moves

A test that reads source files (`readFileSync`, a glob over a slice) pins a path or file list. When code is split, renamed or moved, update the guard's file list in the same change and assert that each scanned file exists and the scan is non-empty; otherwise it keeps passing against the old files and stops guarding the moved code.

- ❌ A scan of `Panel.tsx` keeps passing after its logic moves to `PanelRow.tsx` and `usePanel.ts`.
- ✅ The scan derives its files from the directory (or lists the new files), and fails when a listed path is missing.

<a id="TE-59"></a>

#### TE-59 — Date-handling tests include a daylight-saving fixture

A date or day-key test run only on a winter (standard-time) date cannot show an offset bug that exists half the year. Include a fixture inside the summer-time period of each time zone involved, and assert the day key it must produce (see SERVER.md#SA-21).

- ❌ Every bar fixture is dated in November, so a UTC-slice day key passes.
- ✅ One fixture is a London bar stamped `23:00Z` in July and the test expects the next calendar day.

<a id="TE-60"></a>

#### TE-60 — A fix for an adversarial-input defect is tested with nearest-miss inputs

Pin the fix with inputs that almost match its guard, not only the one the reviewer named. A guard located by a prefix
(`</script`) while the pattern needs the full token (`</script\s*>`) passes the named case and re-opens the defect for
`</scriptx>`.

- ❌ The test feeds only input with no closing token at all.
- ✅ It also feeds prefix-only closers (`</scriptx>`, `</track>`, `</header>`) at the size cap.

<a id="TE-61"></a>

#### TE-61 — An E2E for a rendered image asserts it loaded, not only that it is visible

`toBeVisible()` passes for a broken `<img>`, and jsdom unit tests do not enforce CSP. Assert `naturalWidth > 0` for every image source the feature introduces (preview, live, stored). See `src/app/CLAUDE.md#AP-7` for the CSP side.

- ❌ `await expect(img).toBeVisible()` while a CSP-blocked `blob:` thumbnail renders as a broken image.
- ✅ `expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)`.

## Time, Flakes & Isolation

<a id="TE-7"></a>

#### TE-7 — Mock every time source

Code using `Date.now()` or `new Date()` runs under a mocked clock (`vi.useFakeTimers` / `vi.setSystemTime`). Hardcoded expected TTLs or dates without a fixed clock make flaky tests.

This includes a clock passed as an argument: if a dependency (an LRU, a cache) also reads the real clock, freeze it too so only the injected value decides. Do not sleep real time to let callers interleave; wait on an observable event.

- ❌ Passing a synthetic `now` of `999` to a limiter whose backing cache expires entries on `Date.now()`; a 1 ms TTL elapses in real CI time and a new window opens.
- ✅ Freeze the clock for the suite (`vi.useFakeTimers()` + `vi.setSystemTime`) so the injected `now` is the only time source.
- ❌ A cache key's date segment is matched with a regex (`/:\d{4}-\d{2}-\d{2}$/`) against the wall clock, so any date passes. ✅ Pin the clock with `vi.setSystemTime` and assert the exact key.

<a id="TE-9"></a>

#### TE-9 — Wait for the passive-effect listener before dispatching

A document listener registered in `useEffect`/`useEffectEvent` attaches in the passive-effect phase. Under CI load, dispatching right after render can fire before it attaches and the event is lost. Fix the race, not the timeout: await a sibling of the same effect batch (for example the dialog receiving focus), then dispatch. Never blindly bump timeouts.

- ❌ `render(); await findByText('first'); fireEvent.keyDown(document, { key: 'Escape' });`
- ✅ `await waitFor(() => expect(getByRole('dialog')).toHaveFocus()); fireEvent.keyDown(...)`.

The same applies to e2e geometry: a bounding box read once while an open or resize animation is still running samples a mid-motion value and flakes. Wrap the read and its assertion in `expect(async () => { ... }).toPass()` so it retries until stable, or wait for the motion to end; do not add a fixed sleep.

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

<a id="TE-62"></a>

#### TE-62 — Falsify a source guard against the real data, item by item

A guard that matches loosely (any `[tag] text`, bare substrings of a large corpus) passes for items whose evidence is gone. Prove it by removing each guarded item's evidence from an in-memory copy of the real data and expecting that item to be reported; assert zero survivors. Mutating one hand-picked item does not show the other items are guarded.

A guard on a promise (a policy or notice sentence) asserts each clause that code behaviour depends on, per locale; a single short phrase lets the second half of the promise be dropped unnoticed.

- ❌ The author deletes one phrase from the source, sees the guard fail, and ships; most other phrases still match through a loose template or substring.
- ✅ A test loops over every parsed item, deletes its evidence in memory, and asserts the guard flags it.

<a id="TE-63"></a>

#### TE-63 — A parser-based guard accounts for every candidate

A guard that parses call forms must count every candidate line and fail on any it did not recognise (variable arguments, unknown helpers, continued lines). Silently skipping unrecognised forms lets new code bypass the guard; the failure names the unparsed line.

<a id="TE-64"></a>

#### TE-64 — A source guard reads real constants, pins allowlist counts, and scopes its matches

A guard that checks a hard-coded copy of a constant drifts from the code it guards: import the constant. Resolve each call's arguments (bind numbers and names to constants) per call, not per file, and match only inside the section the guard is about, not anywhere in the document. An allowlist entry keyed on `file::tag` covers every later call that reuses the key, so pin an exact count per entry and check it in both directions (a stale entry fails too). A shape the scanner cannot read (a destructured handler parameter, a spread) is reported as unparsed, never skipped.

- ❌ Allowlist `src/a.ts::[tag]`; a second call with the same tag in that file passes unseen.
- ✅ Allowlist `src/a.ts::[tag]` with count 1; a second call, or a removed one, fails the guard.

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

When behavior or a constant changes, update every layer in the same change; scoped `yarn test` runs skip e2e, so a mismatch only surfaces in CI. Import constants into e2e specs instead of restating the literal, and assert current catalog strings rather than old copy. When user-visible catalog text (ko or any locale) changes, grep `e2e/` and the unit tests for the old literal in the same change (`getByText`, `getByRole` names, `findIndex` regexes) and update every hit; an e2e matcher on the old copy fails CI, and an index lookup that returns -1 can keep passing silently. The same applies to what is rendered at the default e2e viewport: a class change that hides or shows a label by breakpoint (`hidden sm:inline` to `hidden 2xl:inline`) changes the accessible name there, so grep `e2e/specs` for the old label and run the affected specs; unit gates do not cover accessible names by viewport.

<a id="TE-65"></a>

#### TE-65 — An e2e update must pin the changed behaviour and fail against the old code

"Updating" a spec for a change is not done until an assertion names what changed, and that assertion is shown to fail on the pre-change behaviour (revert or perturb the code, run the spec, then restore). Three recurring ways to pass without pinning:

- Order change: adjusting the array a spec iterates keeps the old and new orders green. Assert the exact order (`toHaveText([...])`) and prove it by swapping two items.
- Moved spec: moving a spec to another route to keep it passing leaves the route it left uncovered. Give the original route an equivalent assertion (for a link, host, path and decoded query, not only `href` containing a fragment).
- Awaited mount: scope the locator to the container whose client mount is awaited. A bare `.first()` can match a server-rendered copy and return at once, so the wait never waits.

- ❌ Reorder the tab list in the spec's loop; the old order still passes.
- ✅ `await expect(tabs).toHaveText(['A', 'B', 'C'])`, run against the old code to see it fail.

<a id="TE-66"></a>

#### TE-66 — An e2e absence assertion needs proof the code under test already ran

"The element never appears" passes vacuously if asserted before the component that could render it has run. A hydration-start marker or a frame count is not that proof; it only holds by an incidental margin that shrinks on a slower runner. Sync on an interaction only a hydrated handler can answer (an ARIA state flip such as `aria-expanded`), and keep a positive control through the same helper, differing only in the seed. Likewise, before waiting on state the app writes (a localStorage key), confirm the writer runs under automation: code that skips `navigator.webdriver` never writes it, so seed the state explicitly and say that reason in the helper's comment.

- ❌ `await page.waitForTimeout(1500); await expect(banner).toHaveCount(0);`
- ✅ Open and close the menu, wait on `aria-expanded`, then assert `toHaveCount(0)`; the same helper with a different seed shows the banner.

<a id="TE-67"></a>

#### TE-67 — Raw-HTML e2e assertions match attributes case-insensitively

React serializes some attributes in camelCase (`dateTime`, `tabIndex`), so a lowercase pattern over `page.request.get()` HTML never matches. Use the `i` flag on attribute patterns, and run a new e2e once before review; typecheck and Vitest never execute it.

- ❌ `expect(html).toMatch(/<time datetime="/)`
- ✅ `expect(html).toMatch(/<time datetime="/i)`

<a id="TE-50"></a>

#### TE-50 — Assert inline JSON through the SSR response

Playwright `hasText` cannot read `<script>` element text. Fetch the SSR HTML with `page.request.get()` and assert on the body.

Strip `<script>` blocks first when the text also appears in script payloads, and bind the pattern to the target element by its id; a greedy pattern over the whole body matches outside the section.

<a id="TE-51"></a>

#### TE-51 — Stubs emit only production statuses

An e2e stub returns only the statuses production sends for that mode. An invented status (for example `cached` on re-analysis) lets UI code branch on a state that never occurs.

<a id="TE-52"></a>

#### TE-52 — Audit test doubles that parse vendor formats

Fake LLMs and similar doubles that parse a vendor or core message format break silently when the format changes. After a dependency upgrade, re-check each double against the new format.

<a id="TE-53"></a>

#### TE-53 — A test must fail when the behaviour it names is removed

Before keeping a test, remove or break the behaviour it claims to cover and confirm it fails. Vacuous shapes and their fix:

- **Mocked logic.** A query builder whose condition is never inspected, a SQL assertion built from short `toContain`
  fragments, a Redis Lua `eval` mocked so only its arguments are asserted, or a mocked collaborator that holds the
  behaviour (the value computation, the branch predicate). Mock only the I/O boundary; render the real condition (SQL
  text and params, the full clause); run the script on a real or emulated Redis or assert its effects; assert values
  that differ per branch.
- **Wrong surface.** A renderer behaviour (domain clamp, include flag, label suppression, tick density) asserted only
  through the data flag, a "renders independently" test that mounts only the inner component, a new tracking call with
  no click-and-assert test, an "unsubscribes on unmount" test reading `result.current` after `unmount()`. Assert the
  rendered output and the composed tree, drive the instrumented element, spy on the unsubscribe.
- **Non-discriminating fixtures.** On and off, or the latest and the oldest candidate, give the same result. Give each
  case a distinct value so a no-op mutation or the wrong pick fails.
- **Unobservable properties.** A read-only session or no-write guarantee passes the happy path either way: assert the
  option sent through an exported builder and add an env-gated real-database test that a write fails. A "no write" test
  spies the forbidden operation and asserts `not.toHaveBeenCalled()`, not the mock's shape
  (`not.toHaveProperty('update')`); falsify it by adding the call. An absence assertion over recorded calls asserts the
  call count first.
- **Untested guards and changes.** A last-line defensive guard behind an earlier check gets an input driven past that
  check. A widened fetch window, a changed fingerprint input, and a flag that must follow a successful primary write
  (asserted absent when that write fails) each get a test. After a key rename, negative assertions target the key the
  code now writes, and a test flips when a deliberate guard (not caching a partial result) is reverted.
- **Exit codes.** A CLI or script failure-path test asserts output only the intended path prints, not only the exit code
  (an earlier step can fail with the same code), and matches resolver errors by family (`ENOTFOUND|EAI_AGAIN`).
- **Impossible states.** A component that reads shared async state is tested with the states the real hook produces
  (read the hook first), not a combination it never emits (a live result while analysing).

- ❌ `where` is mocked and never inspected, so dropping the date filter still passes.
- ✅ Render the condition to SQL plus params and assert both.

<a id="TE-54"></a>

#### TE-54 — Pin new CSS rules and cover replaced page sections

A new global stylesheet rule (for example a `:has()` selector) has no runtime test unless one reads the source: assert the normalized rule text (whitespace collapsed) so deleting or weakening the selector or its declarations fails. A page section that is replaced or inlined gets extracted into a component and covered by a render test, so the swap does not drop its coverage.

- ❌ A `:has()` rule added to `globals.css` and a page card rewritten inline, with no test touching either.
- ✅ A test reads `globals.css`, normalizes whitespace and asserts the exact rule; the card lives in a feature component with its own render test.

## Real-database tests

<a id="TE-55"></a>

#### TE-55 — SQL whose meaning is the feature is verified on a real Postgres, and CI runs it

A rendered-SQL assertion (`sqlToQuery` text and params) proves the statement is built, not that it computes the right numbers: joins, `FILTER` counts, `IS DISTINCT FROM` guards and `ON CONFLICT` behaviour only show up when the statement runs. Aggregation, dedup and pruning SQL therefore gets a `*.db.test.ts` that runs the real statements against Postgres, asserts the invariants (for example `priorHolders = holders − new + exited`) and seeds through the real write path instead of hand-inserting the rows the query is meant to produce.

- The test is opt-in by URL: every `*.db.test.ts` guards on the one shared variable, `describe.skipIf(!process.env.TEST_DATABASE_URL)`. It refuses any target that is not a local database (`describeTarget`: not local, or a tunnel port) and works in a throwaway schema it drops afterwards.
- CI's `e2e` workflow (shard 1, after migrating its compose Postgres) runs `yarn test .db.test.ts`, selecting by file name: a new test joins CI only when it is named `*.db.test.ts` and reads `TEST_DATABASE_URL`, never a per-feature variable.
- Locally use a private compose project name so you cannot tear down someone else's stack: `docker compose -p <name> -f docker-compose.e2e.yml up -d --pull never postgres`, then `TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e yarn test .db.test.ts`.
- ❌ Only `expect(sqlText).toContain('FULL OUTER JOIN')` for an aggregate query; a wrong join or filter still passes.
- ✅ The same statement run on seeded rows, asserting the counts and the identity between two quarters.
