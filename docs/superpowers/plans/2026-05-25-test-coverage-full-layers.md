# Full-Layer 90%+ Test Coverage Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 90%+ test coverage across ALL FSD layers (shared, entities, features, widgets, app) with unit tests, integration tests, and user-interaction tests. Migrate from Jest to Vitest before writing new tests.

**Architecture:** Migrate to Vitest for native ESM, faster watch mode, and simpler config. Expand coverage measurement to include every layer. Add jsdom-based component/hook tests for UI layers. Use `userEvent` (preferred) and `fireEvent` for interaction tests. Add cross-layer integration tests for critical user flows.

**Tech Stack:** Vitest 4 + @vitest/coverage-v8, @testing-library/react 16, @testing-library/user-event 14, jsdom

---

## Scope & Phasing

| Phase | Layer | New test files | Description |
|---|---|---|---|
| **0** | Infrastructure | 0 | Jest → Vitest migration (226 existing tests) |
| **1** | shared | ~47 | lib, hooks, ui, config, db, api |
| **2** | entities | ~22 | Low-coverage gaps + **branch coverage 95%+ 보완** |
| **3** | features | ~38 | hooks (userEvent), UI components, model + **branch 보완** |
| **4** | widgets | ~153 | Components, hooks, utils — all 14 widgets |
| **5** | app | ~51 | Pages, route handlers, layouts, OG images, loading states |
| **6** | integration | **~27** | Cross-layer user flow tests + **사용자 여정 3건** |
| **7** | worst-case | **~27** | Error/edge-case tests + **AI/외부 API 6건 추가** |
| **Total** | | **~365** | |

Each phase ends with a **threshold gate task** that raises `coverageThreshold` in `vitest.config.ts`.

---

## Audit Summary — Untested Files by Layer

### shared (62 untested / 124 total)

| Category | Untested | Files |
|---|---|---|
| lib | 22 | adsense, cardStyles, cn, contact, contactErrorMessages, cancelJobsApi, legal (fn), llmProviderLabels, news/periodLabels, og, options/marketHoursDisplay, pwaEvents, skillUtils, sleep, storageKeys, tooltipPosition, trendline, auth/constants, auth/formTypes, auth/passwordRules, auth/redirect, auth/tierLabel, auth/validation |
| hooks | 8 | useCopyToClipboard, useDialog, useHydrated, useOnClickOutside, usePageShowReload, usePopoverToggle, useQueryParamState, useRovingKeyboardNav |
| ui | 16 | auth/AuthCardShell, AuthErrorAlert, AuthFieldGroup, PasswordField, PasswordStrengthHint, SubmitButton, BotBlockedNotice, DotSeparator, EyeIcon, InfoTooltip, JsonLd, MarkdownText, tabs/TabsPill, TabsUnderline, tabs/hooks/useTabs, tabs/utils/tabIds |
| config | 7 | contact, cookieNames, dashboard-tickers, llmProviders, pollingConfig, popular-tickers, ticker |
| db | 5 | client, config, constants, schema, tokenEncryption |
| api | 1 | fmp/httpClient |

**Note:** shared/lib/auth/{passwordRules, redirect, validation} already have test files. shared/email/dispatcher already tested. These are miscounted above — remove 3 from lib count. **Actual untested: ~59 files → need ~47 new tests** (some are type-only or trivially covered).

### entities (14 files with coverage gaps)

Most entity files are already tested (119 test files). Coverage report shows 94%+ for measured files. Key gaps:

| File | Current Coverage | Issue |
|---|---|---|
| earnings-report/lib/nextEarningsReport.ts | 43.8% | Stale-refresh branches untested |
| news-article/actions/getNewsCardsAction.ts | 0% | No test at all |
| oauth-account/lib/pendingOAuthSignupStore.ts | 75% | Expiry/cleanup untested |
| session/actions/currentUserAction.ts | 66.7% | Error branch |
| session/hooks/useCurrentUser.ts | 66.7% | Hook wrapper |
| analysis/usageCounts.ts | Not measured | New file, needs test |
| og-image/lib/buildSymbolOgImage.tsx | Not measured | JSX image builder |
| 7x barrel actions.ts files | 0% | Re-exports only — exclude from measurement |

**Plan: 14 new test files**, plus exclude barrel `actions.ts` re-exports from `collectCoverageFrom`.

### features (35 untested files / 62 total)

| Category | Count | Files |
|---|---|---|
| hooks | 15 | useLoginForm, useSignupForm, useForgotPasswordForm, useResetPasswordForm, useEmailVerificationForms, useFinalizeOAuthSignup, useLogout, useDeleteAccountForm, useContactForm, useApiKeyForms, useModelGate, useAutocomplete, useRecentSearches, useTickerSearch, useBacktestFilter |
| ui | 14 | LoginForm, SignupForm, ForgotPasswordForm, ResetPasswordForm, SocialLoginButtons, LogoutButton, DeleteAccountConfirm, ContactSubmittedNotice, ContactTextareaField, ContactTextField, ApiKeyInput, ApiKeySection, PremiumModelGateModal, SymbolSearchPanel, TickerAutocomplete |
| model | 2 | SymbolChatContext, useSymbolChat |
| lib | 1 | contactFormUtils (already has test — verify) |
| actions | 3 | barrel re-exports (exclude from measurement) |

**Plan: ~35 new test files** (hooks + UI + model).

### widgets (153 untested / 203 total)

| Widget | Untested | Breakdown |
|---|---|---|
| chart | 41 | 22 hooks, 9 utils, 7 components, 1 constant |
| symbol-page | 34 | 16 hooks, 12 components, 4 utils, 1 constant, 1 exception |
| options | 21 | 11 components, 2 hooks, 8 utils |
| news | 13 | 4 components, 4 hooks, 3 sections, 1 constant, 1 util |
| dashboard | 14 | 12 components, 3 hooks |
| overall | 11 | 2 components, 1 hook, 8 sections |
| analysis | 5 | 4 components, 1 hook |
| chat | 7 | 3 components, 3 hooks, 1 util |
| home | 6 | 5 components, 1 hook |
| layout | 7 | 7 components |
| fundamental | 5 | 3 components, 1 hook, 1 util |
| backtesting | 4 | 4 components |
| fear-greed | 2 | 1 component, 1 hook |
| legal | 3 | 3 components |

**Plan: ~140 new test files** (some trivial components can share test files).

### app (51 untested / 54 total)

| Category | Count |
|---|---|
| Pages (page.tsx) | 18 |
| OG/Twitter images | 15 |
| API route handlers | 7 |
| Loading states | 5 |
| Layouts | 2 |
| Data functions | 2 |
| Other (providers, manifest, robots, not-found, error, component) | 6 |

**Plan: ~45 new test files** (OG images share a pattern template, loading states are trivial).

---

## Phase 0: Jest → Vitest Migration

### Task 0.1: Install Vitest and remove Jest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add Vitest dependencies**

```bash
yarn add -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Remove Jest dependencies**

```bash
yarn remove jest ts-jest @types/jest jest-environment-jsdom
```

- [ ] **Step 3: Update package.json scripts**

Replace all test scripts:

```json
{
    "test": "vitest run",
    "test:quiet": "vitest run --reporter=verbose",
    "test-watch": "vitest",
    "test-coverage": "vitest run --coverage",
    "test-coverage-watch": "vitest --coverage",
    "test-coverage-report": "vitest run --coverage --reporter=verbose"
}
```

- [ ] **Step 4: Commit dependency changes**

```bash
git add package.json yarn.lock
git commit -m "chore: replace jest with vitest — dependency swap"
```

---

### Task 0.2: Create vitest.config.ts

**Files:**
- Create: `vitest.config.ts`
- Delete: `jest.config.js`

- [ ] **Step 1: Write vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    test: {
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
        environment: 'node',
        environmentMatchGlobs: [
            ['**/*.test.tsx', 'jsdom'],
        ],
        coverage: {
            provider: 'v8',
            include: [
                'src/entities/**/*.{ts,tsx}',
                'src/features/**/*.{ts,tsx}',
                'src/shared/**/*.{ts,tsx}',
                'src/widgets/**/*.{ts,tsx}',
                'src/app/**/*.{ts,tsx}',
                'src/proxy.ts',
            ],
            exclude: [
                '**/*.d.ts',
                '**/index.ts',
                '**/types.ts',
                '**/model.ts',
                '**/test-utils/**',
                'src/entities/*/actions.ts',
                'src/entities/*/actions/index.ts',
                'src/features/*/actions.ts',
            ],
            thresholds: {
                statements: 50,
                branches: 50,
                functions: 50,
                lines: 50,
            },
        },
    },
});
```

- [ ] **Step 2: Delete jest.config.js**

```bash
rm jest.config.js
```

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git rm jest.config.js
git commit -m "chore: create vitest.config.ts replacing jest.config.js

All FSD layers measured. Barrel re-export files excluded.
Threshold at 50% temporarily while tests are being written.
.tsx files auto-detect jsdom environment via environmentMatchGlobs."
```

---

### Task 0.3: Migrate setup file

**Files:**
- Create: `vitest.setup.ts`
- Delete: `jest.setup.ts`
- Delete: `jest.setup-jsdom.ts` (if exists)

- [ ] **Step 1: Write vitest.setup.ts**

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { TextDecoder, TextEncoder } from 'util';

if (typeof globalThis.TextDecoder === 'undefined') {
    (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;
}
if (typeof globalThis.TextEncoder === 'undefined') {
    (globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
}

process.env.ALPACA_API_KEY = 'test-alpaca-key';
process.env.ALPACA_API_SECRET = 'test-alpaca-secret';
process.env.AI_PROVIDER = 'claude';
process.env.GEMINI_CHAT_FREE_API_KEY = 'test-gemini-user-api-key';
process.env.GEMINI_CHAT_API_KEY = 'test-gemini-key';
process.env.ANTHROPIC_CHAT_API_KEY = 'test-anthropic-key';
process.env.OPENAI_CHAT_API_KEY = 'test-openai-key';
process.env.DATABASE_URL = 'test-database-url';

vi.mock('next/cache', () => ({
    cacheLife: () => {},
    cacheTag: () => {},
    revalidatePath: () => {},
    revalidateTag: () => {},
    unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}));
```

- [ ] **Step 2: Delete old setup files**

```bash
rm jest.setup.ts
git add vitest.setup.ts
git rm jest.setup.ts
git commit -m "chore: migrate jest.setup.ts → vitest.setup.ts

Adds @testing-library/jest-dom/vitest for matcher support.
Replaces jest.mock with vi.mock for next/cache."
```

---

### Task 0.4: Automated codemod for 226 test files

**Files:**
- Modify: All 226 test files in `src/`

- [ ] **Step 1: Run find-and-replace for mechanical changes**

```bash
# jest.fn → vi.fn
find src -name '*.test.*' -exec sed -i '' 's/jest\.fn/vi.fn/g' {} +

# jest.mock → vi.mock
find src -name '*.test.*' -exec sed -i '' 's/jest\.mock/vi.mock/g' {} +

# jest.spyOn → vi.spyOn
find src -name '*.test.*' -exec sed -i '' 's/jest\.spyOn/vi.spyOn/g' {} +

# jest.mocked → vi.mocked
find src -name '*.test.*' -exec sed -i '' 's/jest\.mocked/vi.mocked/g' {} +

# jest.clearAllMocks → vi.clearAllMocks
find src -name '*.test.*' -exec sed -i '' 's/jest\.clearAllMocks/vi.clearAllMocks/g' {} +

# jest.resetModules → vi.resetModules
find src -name '*.test.*' -exec sed -i '' 's/jest\.resetModules/vi.resetModules/g' {} +

# jest.useFakeTimers → vi.useFakeTimers
find src -name '*.test.*' -exec sed -i '' 's/jest\.useFakeTimers/vi.useFakeTimers/g' {} +

# jest.useRealTimers → vi.useRealTimers
find src -name '*.test.*' -exec sed -i '' 's/jest\.useRealTimers/vi.useRealTimers/g' {} +

# jest.advanceTimersByTime → vi.advanceTimersByTime
find src -name '*.test.*' -exec sed -i '' 's/jest\.advanceTimersByTime/vi.advanceTimersByTime/g' {} +

# Remove @jest-environment jsdom docblocks (handled by environmentMatchGlobs)
find src -name '*.test.tsx' -exec sed -i '' '/\*\*$/,/\*\/$/{ /jest-environment/d; }' {} +

# Remove manual @testing-library/jest-dom imports (now in setup)
find src -name '*.test.*' -exec sed -i '' "/import '@testing-library\/jest-dom'/d" {} +

# Add vitest imports to files that use vi.*
find src -name '*.test.*' -exec grep -l 'vi\.' {} + | while read f; do
    if ! grep -q "from 'vitest'" "$f"; then
        sed -i '' "1i\\
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
" "$f"
    fi
done

# as jest.Mock → as Mock (type casts)
find src -name '*.test.*' -exec sed -i '' 's/as jest\.Mock/as Mock/g' {} +
find src -name '*.test.*' -exec sed -i '' 's/as jest\.MockedFunction/as MockedFunction/g' {} +
```

- [ ] **Step 2: Verify tests compile**

```bash
yarn test 2>&1 | tail -20
```

- [ ] **Step 3: Commit codemod changes**

```bash
git add src/
git commit -m "chore: automated jest→vitest codemod across 226 test files

jest.fn→vi.fn, jest.mock→vi.mock, jest.spyOn→vi.spyOn,
type casts, timer functions, environment docblocks removed."
```

---

### Task 0.5: Manual fixes — vi.hoisted() for 17 files

Files that reference mock variables before `vi.mock()` need `vi.hoisted()`:

**Pattern to find:**
```bash
grep -rn "const mock.*= vi.fn" src --include="*.test.*" -l | head -20
```

**Before (broken):**
```ts
const mockUpsert = vi.fn();
vi.mock('@/entities/api-key', () => ({
    DrizzleUserApiKeyRepository: vi.fn().mockImplementation(() => ({
        upsert: mockUpsert,
    })),
}));
```

**After (fixed):**
```ts
import { vi } from 'vitest';

const { mockUpsert } = vi.hoisted(() => ({
    mockUpsert: vi.fn(),
}));

vi.mock('@/entities/api-key', () => ({
    DrizzleUserApiKeyRepository: vi.fn().mockImplementation(() => ({
        upsert: mockUpsert,
    })),
}));
```

- [ ] **Step 1: Fix each file** (~17 files, ~3-4 hours)
- [ ] **Step 2: Run tests to verify**
- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "fix: add vi.hoisted() to 17 test files for mock variable hoisting"
```

---

### Task 0.6: Manual fixes — jest.requireActual → vi.importActual (32 files)

**Before:**
```ts
vi.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    pollAnalysis: vi.fn(),
}));
```

**After:**
```ts
vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    pollAnalysis: vi.fn(),
}));
```

- [ ] **Step 1: Find and fix all 32 files**

```bash
grep -rn "requireActual" src --include="*.test.*" -l
```

- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "fix: migrate jest.requireActual → vi.importActual (async) in 32 files"
```

---

### Task 0.7: Final verification — all 226 tests pass

- [ ] **Step 1: Run full test suite**

```bash
yarn test
```

Expected: 226 passed, 2089 tests

- [ ] **Step 2: Run coverage to establish Vitest baseline**

```bash
yarn test-coverage 2>&1 | tail -10
```

- [ ] **Step 3: Commit any remaining fixes and tag milestone**

```bash
git commit -m "chore: vitest migration complete — 226 suites, 2089 tests passing"
```

---

## Phase 1: shared Layer Tests (~47 new tests)

Detailed test code for each file is in the v1 plan. Summary of ALL files to test:

### Task 1.1: shared/lib — 0% and low-coverage files (10 tests)

| File | Test to create |
|---|---|
| sleep.ts | `shared/lib/__tests__/sleep.test.ts` |
| tooltipPosition.ts | `shared/lib/__tests__/tooltipPosition.test.ts` |
| trendline.ts | `shared/lib/__tests__/trendline.test.ts` |
| adsense.ts | `shared/lib/__tests__/adsense.test.ts` |
| cardStyles.ts | `shared/lib/__tests__/cardStyles.test.ts` |
| contact.ts | `shared/lib/__tests__/contact.test.ts` |
| options/marketHoursDisplay.ts | `shared/lib/options/__tests__/marketHoursDisplay.test.ts` |
| legal.ts (formatKoreanDate) | `shared/lib/__tests__/legal.test.ts` |
| cn.ts | `shared/lib/__tests__/cn.test.ts` |
| og.ts | `shared/lib/__tests__/og.test.ts` |

### Task 1.2: shared/lib — additional untested utilities (8 tests)

| File | Test to create |
|---|---|
| cancelJobsApi.ts | `shared/lib/__tests__/cancelJobsApi.test.ts` |
| contactErrorMessages.ts | `shared/lib/__tests__/contactErrorMessages.test.ts` |
| llmProviderLabels.ts | `shared/lib/__tests__/llmProviderLabels.test.ts` |
| news/periodLabels.ts | `shared/lib/__tests__/news/periodLabels.test.ts` |
| pwaEvents.ts | `shared/lib/__tests__/pwaEvents.test.ts` |
| skillUtils.ts | `shared/lib/__tests__/skillUtils.test.ts` |
| storageKeys.ts | `shared/lib/__tests__/storageKeys.test.ts` |
| auth/tierLabel.ts | `shared/lib/__tests__/auth/tierLabel.test.ts` |

### Task 1.3: shared/hooks — 8 untested hooks

| File | Test to create |
|---|---|
| useCopyToClipboard.ts | `shared/hooks/__tests__/useCopyToClipboard.test.ts` |
| useDialog.ts | `shared/hooks/__tests__/useDialog.test.tsx` |
| useOnClickOutside.ts | `shared/hooks/__tests__/useOnClickOutside.test.tsx` |
| usePopoverToggle.ts | `shared/hooks/__tests__/usePopoverToggle.test.tsx` |
| useHydrated.ts | `shared/hooks/__tests__/useHydrated.test.ts` |
| usePageShowReload.ts | `shared/hooks/__tests__/usePageShowReload.test.ts` |
| useQueryParamState.ts | `shared/hooks/__tests__/useQueryParamState.test.ts` |
| useRovingKeyboardNav.ts | `shared/hooks/__tests__/useRovingKeyboardNav.test.ts` |

Full test code for each: see v1 plan Tasks 1.3a-1.3h (replace `jest.*` with `vi.*`).

### Task 1.4: shared/ui — 16 component tests

| File | Test to create |
|---|---|
| auth/AuthCardShell.tsx | `shared/ui/auth/__tests__/AuthCardShell.test.tsx` |
| auth/AuthErrorAlert.tsx | `shared/ui/auth/__tests__/AuthErrorAlert.test.tsx` |
| auth/AuthFieldGroup.tsx | `shared/ui/auth/__tests__/AuthFieldGroup.test.tsx` |
| auth/PasswordField.tsx | `shared/ui/auth/__tests__/PasswordField.test.tsx` |
| auth/PasswordStrengthHint.tsx | `shared/ui/auth/__tests__/PasswordStrengthHint.test.tsx` |
| auth/SubmitButton.tsx | `shared/ui/auth/__tests__/SubmitButton.test.tsx` |
| BotBlockedNotice.tsx | `shared/ui/__tests__/BotBlockedNotice.test.tsx` |
| DotSeparator.tsx | `shared/ui/__tests__/DotSeparator.test.tsx` |
| EyeIcon.tsx | `shared/ui/__tests__/EyeIcon.test.tsx` |
| InfoTooltip.tsx | `shared/ui/__tests__/InfoTooltip.test.tsx` |
| JsonLd.tsx | `shared/ui/__tests__/JsonLd.test.tsx` |
| MarkdownText.tsx | `shared/ui/__tests__/MarkdownText.test.tsx` |
| tabs/TabsPill.tsx | `shared/ui/tabs/__tests__/TabsPill.test.tsx` |
| tabs/TabsUnderline.tsx | `shared/ui/tabs/__tests__/TabsUnderline.test.tsx` |
| tabs/hooks/useTabs.ts | `shared/ui/tabs/__tests__/hooks/useTabs.test.ts` |
| tabs/utils/tabIds.ts | `shared/ui/tabs/__tests__/utils/tabIds.test.ts` |

### Task 1.5: shared/config — 7 config tests

| File | Test to create |
|---|---|
| contact.ts | `shared/config/__tests__/contact.test.ts` |
| cookieNames.ts | `shared/config/__tests__/cookieNames.test.ts` |
| dashboard-tickers.ts | `shared/config/__tests__/dashboard-tickers.test.ts` |
| llmProviders.ts | `shared/config/__tests__/llmProviders.test.ts` |
| pollingConfig.ts | `shared/config/__tests__/pollingConfig.test.ts` |
| popular-tickers.ts | `shared/config/__tests__/popular-tickers.test.ts` |
| ticker.ts | `shared/config/__tests__/ticker.test.ts` |

### Task 1.6: shared/db + api (6 tests)

| File | Test to create |
|---|---|
| db/tokenEncryption.ts | `shared/db/__tests__/tokenEncryption.test.ts` |
| db/client.ts | `shared/db/__tests__/client.test.ts` |
| db/config.ts | `shared/db/__tests__/config.test.ts` |
| db/constants.ts | `shared/db/__tests__/constants.test.ts` |
| db/schema.ts | `shared/db/__tests__/schema.test.ts` |
| api/fmp/httpClient.ts | `shared/api/fmp/__tests__/httpClient.test.ts` |

### Task 1.7: Threshold gate → 60%

- [ ] **Step 1:** `yarn test-coverage` — verify >60% globally
- [ ] **Step 2:** Update `vitest.config.ts` thresholds to 60
- [ ] **Step 3:** Commit

---

## Phase 2: entities Layer Gaps (~14 new tests)

### Task 2.1: Low-coverage entity files

| File | Test to create |
|---|---|
| earnings-report/lib/nextEarningsReport.ts | `entities/earnings-report/__tests__/lib/nextEarningsReport.test.ts` |
| news-article/actions/getNewsCardsAction.ts | `entities/news-article/__tests__/getNewsCardsAction.test.ts` |
| oauth-account/lib/pendingOAuthSignupStore.ts | `entities/oauth-account/__tests__/lib/pendingOAuthSignupStore.test.ts` (expand) |
| session/actions/currentUserAction.ts | `entities/session/__tests__/actions/currentUserAction.test.ts` (expand) |
| session/hooks/useCurrentUser.ts | `entities/session/__tests__/hooks/useCurrentUser.test.tsx` |
| analysis/usageCounts.ts | `entities/analysis/__tests__/usageCounts.test.ts` |

### Task 2.2: Missing entity tests

| File | Test to create |
|---|---|
| og-image/lib/buildSymbolOgImage.tsx | `entities/og-image/__tests__/buildSymbolOgImage.test.tsx` |
| analysis/lib/gate.ts (edge cases) | expand existing test |
| ticker/lib/recentSearches.ts (branch 68%) | expand existing test |
| ticker/lib/getAssetInfo.ts (branch 84%) | expand existing test |
| ticker/lib/searchTicker.ts (branch 92%) | expand existing test |
| llm-provider/api/openai.ts (branch 81%) | expand existing test |
| llm-provider/api/anthropic.ts (branch 83%) | expand existing test |
| skill/api.ts (branch 77%) | expand existing test |

### Task 2.3: Entities branch coverage 95%+ expansion (8 existing tests to expand)

Expand existing test files to cover uncovered branches/lines:

| File | Current Branch | Uncovered Lines | Action |
|---|---|---|---|
| earnings-report/api.ts | 73.58% | 60-84, 236, 289 | Add error branch + edge case tests |
| ticker/lib/recentSearches.ts | 68.18% | 20-26 | Add storage error + empty state tests |
| ticker/lib/getAssetInfo.ts | 84.78% | 61-63, 206, 218 | Add FMP timeout + cache miss tests |
| session/lib/sessionCookie.ts | 88.88% | 57-60 | Add cookie parse error branch |
| skill/api.ts | 77.35% | 81, 84, 149, 158 | Add skill not found + parse error tests |
| llm-provider/api/openai.ts | 81.25% | 25, 36 | Add stream error + empty response tests |
| llm-provider/api/anthropic.ts | 83.33% | 53 | Add timeout branch test |
| ticker/lib/searchTicker.ts | 92.85% | 119, 132 | Add no-result + FMP fallback tests |

### Task 2.4: Threshold verification at 60%

- [ ] Verify entities layer individually exceeds 95% (with expanded branches)
- [ ] Verify global remains above 60%

---

## Phase 3: features Layer Tests (~35 new tests)

### Task 3.1: Feature hooks — 15 hooks

| Feature | Hook | Test |
|---|---|---|
| auth-login | useLoginForm.ts | `__tests__/hooks/useLoginForm.test.ts` |
| auth-signup | useSignupForm.ts | `__tests__/hooks/useSignupForm.test.ts` |
| auth-password-reset | useForgotPasswordForm.ts | `__tests__/hooks/useForgotPasswordForm.test.ts` |
| auth-password-reset | useResetPasswordForm.ts | `__tests__/hooks/useResetPasswordForm.test.ts` |
| auth-email-verification | useEmailVerificationForms.ts | `__tests__/hooks/useEmailVerificationForms.test.ts` |
| auth-oauth-consent | useFinalizeOAuthSignup.ts | `__tests__/hooks/useFinalizeOAuthSignup.test.ts` |
| auth-logout | useLogout.ts | `__tests__/hooks/useLogout.test.ts` |
| account-delete | useDeleteAccountForm.ts | `__tests__/hooks/useDeleteAccountForm.test.ts` |
| contact-form | useContactForm.ts | `__tests__/hooks/useContactForm.test.ts` |
| api-key-management | useApiKeyForms.ts | `__tests__/hooks/useApiKeyForms.test.ts` |
| premium-gate | useModelGate.ts | `__tests__/hooks/useModelGate.test.ts` |
| ticker-search | useAutocomplete.ts | `__tests__/hooks/useAutocomplete.test.ts` |
| ticker-search | useRecentSearches.ts | `__tests__/hooks/useRecentSearches.test.ts` |
| ticker-search | useTickerSearch.ts | `__tests__/hooks/useTickerSearch.test.ts` |
| backtest-filter | useBacktestFilter.ts | `__tests__/hooks/useBacktestFilter.test.ts` |

### Task 3.2: Feature UI components — 14 components

| Feature | Component | Test |
|---|---|---|
| auth-login | LoginForm.tsx | `__tests__/LoginForm.test.tsx` |
| auth-signup | SignupForm.tsx | `__tests__/SignupForm.test.tsx` |
| auth-password-reset | ForgotPasswordForm.tsx | `__tests__/ForgotPasswordForm.test.tsx` |
| auth-password-reset | ResetPasswordForm.tsx | `__tests__/ResetPasswordForm.test.tsx` |
| auth-oauth | SocialLoginButtons.tsx | `__tests__/SocialLoginButtons.test.tsx` |
| auth-logout | LogoutButton.tsx | `__tests__/LogoutButton.test.tsx` |
| account-delete | DeleteAccountConfirm.tsx | `__tests__/DeleteAccountConfirm.test.tsx` |
| contact-form | ContactSubmittedNotice.tsx | `__tests__/ContactSubmittedNotice.test.tsx` |
| contact-form | ContactTextareaField.tsx | `__tests__/ContactTextareaField.test.tsx` |
| contact-form | ContactTextField.tsx | `__tests__/ContactTextField.test.tsx` |
| api-key-management | ApiKeyInput.tsx | `__tests__/ApiKeyInput.test.tsx` |
| api-key-management | ApiKeySection.tsx | `__tests__/ApiKeySection.test.tsx` |
| premium-gate | PremiumModelGateModal.tsx | `__tests__/PremiumModelGateModal.test.tsx` |
| ticker-search | TickerAutocomplete.tsx | `__tests__/TickerAutocomplete.test.tsx` |
| ticker-search | SymbolSearchPanel.tsx | `__tests__/SymbolSearchPanel.test.tsx` |

### Task 3.3: Feature model + remaining (4 tests)

| Feature | File | Test |
|---|---|---|
| symbol-chat | hooks/useSymbolChat.ts | `__tests__/hooks/useSymbolChat.test.ts` |
| symbol-chat | model/SymbolChatContext.tsx | `__tests__/model/SymbolChatContext.test.tsx` |

### Task 3.4: Features + shared branch coverage 95%+ expansion

**Features branch expansion (3 files):**

| File | Current Branch | Action |
|---|---|---|
| contact-form/lib/contactFormUtils.ts | 90% | Add edge case for branch at line 8 |
| pwa-install/lib/registerServiceWorker.ts | 76% | Add SW registration error + updatefound error tests |
| auth-oauth/lib/state.ts | 94.44% | Add HMAC error branch at line 144 |

**Shared branch expansion (3 files):**

| File | Current Branch | Action |
|---|---|---|
| shared/lib/seo.ts | 87.14% | Add edge cases for lines 16-17, 158-165 |
| shared/lib/formatAnalyzedAt.ts | 83.33% | Add edge case for line 33 |
| shared/lib/withRetry.ts | 100% (but line 85 uncovered) | Add backoff budget exhaustion test |

### Task 3.5: Threshold gate → 70%

- [ ] Update `vitest.config.ts` thresholds to 70
- [ ] Commit

---

## Phase 4: widgets Layer Tests (~140 new tests)

Organized by priority. Each widget follows this test pattern:

- **utils/*.ts** → Pure function unit tests (node env)
- **hooks/*.ts** → `renderHook` + vi.mock dependencies (jsdom)
- **Components (*.tsx)** → `render` + `userEvent` interaction tests (jsdom)
- **sections/*.tsx** → `render` + prop variation tests (jsdom)

### Task 4.1: chart widget (44 tests — highest priority)

**Utils (9 tests):**
- `chart/__tests__/utils/ichimokuUtils.test.ts`
- `chart/__tests__/utils/keyLevelsUtils.test.ts`
- `chart/__tests__/utils/overlayLegendFormat.test.ts`
- `chart/__tests__/utils/patternOverlayUtils.test.ts`
- `chart/__tests__/utils/seriesDataUtils.test.ts`
- `chart/__tests__/utils/trendlineUtils.test.ts`
- `chart/__tests__/constants.test.ts`
- (overlayLabelUtils, paneLabelUtils already tested)

**Hooks (22 tests):**
All 22 chart hooks need tests. Each follows this pattern:
```tsx
import { renderHook } from '@testing-library/react';
import { useXxxOverlay } from '@/widgets/chart/hooks/useXxxOverlay';
// mock lightweight-charts and siglens-core
vi.mock('lightweight-charts', () => ({ ... }));
```

**Components (7 tests):**
- `chart/__tests__/ChartErrorFallback.test.tsx`
- `chart/__tests__/ChartSkeleton.test.tsx`
- `chart/__tests__/IndicatorToolbar.test.tsx`
- `chart/__tests__/OverlayLegend.test.tsx`
- `chart/__tests__/StockChart.test.tsx`
- `chart/__tests__/TimeframeSelector.test.tsx`
- `chart/__tests__/VolumeChart.test.tsx`

### Task 4.2: symbol-page widget (34 tests)

**Utils (4):** analysisStatus, buildChatState (tested), mobileSheetDom, symbolTabsConfig
**Hooks (16):** All symbol-page hooks
**Components (12):** ChartContent, CrossLinkCards, MobileAnalysisSheet, SectionSkeleton, SymbolLayoutHeader, SymbolModelContext, SymbolPageClient, SymbolPageContext, SymbolTabs, SymbolTabsSkeleton, constants/mobileSheet, exceptions/BotBlockedError

### Task 4.3: dashboard widget (14 tests)

**Hooks (3):** useBriefing, useMarketSummary, useSectorSignalState
**Components (11):** BriefingCard, IndexCard, MarketSummaryPanel, MarketSummaryPanelSkeleton, SectorSignalPanel, SectorSignalPanelSkeleton, SectorTabs, SignalBadge, SignalStockCard, SignalSubsection, SignalTypeGuide, TimeframeSelector

### Task 4.4: options widget (21 tests)

**Utils (8):** buildChatState (tested), chartLabelOffsets, chartStrokeWidths, computeTooltipPos (tested), formatCompactCount, optionsTooltips, pickLabelIndices, aggregateStrikeVolume (tested)
**Hooks (2):** useOptionsAnalysis, useOptionsChainMetrics
**Components (11):** ExpirationSelector, OpenInterestChart, OptionsAiAnalysis, OptionsAiAnalysisError, OptionsAiAnalysisSkeleton, OptionsAiAnalysisStaleNotice, OptionsChainTable, OptionsEmptyState, OptionsMetricsRow, OptionsPageClient, OptionsStaleDataBanner, StrikeVolumeChart

### Task 4.5: news widget (13 tests)

**Hooks (4):** useNewsAnalysis (tested), useNewsCardPolling (tested), useNewsPollingWithInvalidation, useWaitForNewsCards
**Components (4):** NewsAiSummary, NewsAiSummaryError, NewsAiSummaryErrorBoundary, NewsAiSummarySkeleton
**Sections (3):** AnalystActions, EventCalendar (tested), NewsList (tested)
**Other (1):** constants.ts

### Task 4.6: overall widget (11 tests)

**Hooks (1):** useOverallAnalysis (tested)
**Components (2):** DependencyProgress, OverallTriggerCta
**Sections (8):** FundamentalSummary, IntegratedConclusion, NewsSummary, OptionsSummary (tested), OverallSummary, RiskFactors, ScenarioAnalysis, TechnicalSummary

### Task 4.7: chat widget (7 tests)

**Hooks (3):** useChatButtonState, useChatInput, usePageContextLabel
**Components (3):** ContextSwitchSystemMessage, FloatingChatButton, UserApiKeyRequiredModal
**Utils (1):** chatStorage

### Task 4.8: remaining widgets (21 tests)

| Widget | Tests |
|---|---|
| home | HeroIllustration, HowItWorks, SkillsShowcase, StatsBar, TickerCategories, useSkillsShowcase (6) |
| layout | ContactDialog, CurrentYear, Footer, Header, HeaderNav, HeaderNavStatic, SiteJsonLd (7) |
| analysis | AdBanner, AnalysisPanel, AnalysisProgress, AnalysisToast, useAdSensePush (5) |
| backtesting | BacktestCaseCard, BacktestCaseList, BacktestHero, BacktestTabs (4) |
| fundamental | FundamentalAiSummary, FundamentalAiSummaryError, FundamentalAiSummarySkeleton (3 — sections + hook already tested) |
| fear-greed | FearGreedGauge, useFearGreedFromSymbol (2) |
| legal | LegalBreadcrumb, LegalPageShell, PolicySection (3) |

### Task 4.9: Additional widget files missed in initial count (+13)

| Widget | Missing files | Test to create |
|---|---|---|
| chart | FearGreedHistoricalChart.tsx (already tested — verify) | — |
| fundamental | FundamentalAiSummary.tsx, sections/EmptySectionCard.tsx (already tested — verify) | — |
| news | NewsAiSummaryErrorBoundary.tsx | `news/__tests__/NewsAiSummaryErrorBoundary.test.tsx` |
| options | OptionsStaleDataBanner.tsx, StrikeVolumeChart.tsx | 2 tests |
| overall | DependencyProgress.tsx, OverallTriggerCta.tsx | 2 tests |
| symbol-page | ChartContent.tsx, CrossLinkCards.tsx, SymbolModelContext.tsx, SymbolPageContext.tsx, SymbolTabsSkeleton.tsx | 5 tests |
| analysis | parseStructuredSummary.ts | `analysis/__tests__/utils/parseStructuredSummary.test.ts` |
| dashboard | TimeframeSelector.tsx | `dashboard/__tests__/TimeframeSelector.test.tsx` |

After verification, some "missing" files are already tested indirectly. Net addition: **~13 tests**.

### Task 4.10: Threshold gate → 80% (midpoint), 85% (completion)

- [ ] At midpoint (chart + symbol-page + dashboard done): raise to 80%
- [ ] At Phase 4 completion: raise to 85%

---

## Phase 5: app Layer Tests (~45 new tests)

### Task 5.1: API route handlers (7 tests)

| Route | Test |
|---|---|
| api/auth/[provider]/start/route.ts | `api/auth/__tests__/start.test.ts` |
| api/auth/callback/[provider]/route.ts | already tested |
| api/jobs/cancel/route.ts | `api/jobs/__tests__/cancel.test.ts` |
| api/sitemap/route.ts | `api/sitemap/__tests__/route.test.ts` |
| api/sitemap/static/route.ts | `api/sitemap/__tests__/static.test.ts` |
| api/sitemap/popular/route.ts | `api/sitemap/__tests__/popular.test.ts` |
| api/sitemap/longtail/[page]/route.ts | `api/sitemap/__tests__/longtail.test.ts` |

### Task 5.2: Pages — data functions + metadata (12 tests)

| Page | Test |
|---|---|
| page.tsx (home) | `__tests__/homePage.test.tsx` |
| [symbol]/page.tsx | `[symbol]/__tests__/symbolPage.test.tsx` |
| [symbol]/layout.tsx | already tested (symbol-metadata) |
| [symbol]/fundamental/fundamentalData.ts | `[symbol]/fundamental/__tests__/fundamentalData.test.ts` |
| [symbol]/news/newsData.ts | already tested |
| login/page.tsx | `login/__tests__/page.test.tsx` |
| signup/page.tsx | `signup/__tests__/page.test.tsx` |
| forgot-password/page.tsx | `forgot-password/__tests__/page.test.tsx` |
| reset-password/page.tsx | `reset-password/__tests__/page.test.tsx` |
| account/page.tsx | `account/__tests__/page.test.tsx` |
| account/delete/page.tsx | `account/delete/__tests__/page.test.tsx` |
| market/page.tsx | `market/__tests__/page.test.tsx` |
| backtesting/page.tsx | `backtesting/__tests__/page.test.tsx` |

### Task 5.3: OG/Twitter images (8 tests — template pattern)

All OG image files follow the same pattern. Write one template test, replicate:

```tsx
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/entities/og-image', () => ({
    buildSymbolOgImage: vi.fn().mockResolvedValue(new Response('image')),
}));

describe('[symbol] opengraph-image', () => {
    it('returns ImageResponse for valid symbol', async () => {
        const { default: handler } = await import('@/app/[symbol]/opengraph-image');
        const response = await handler({ params: { symbol: 'AAPL' } });
        expect(response).toBeDefined();
    });
});
```

8 route groups × 2 (OG + Twitter) = 16 files, but 8 tests cover both via shared pattern.

### Task 5.4: Special files + remaining (8 tests)

| File | Test |
|---|---|
| manifest.ts | `__tests__/manifest.test.ts` |
| robots.ts | `__tests__/robots.test.ts` |
| not-found.tsx | `__tests__/not-found.test.tsx` |
| providers.tsx | `__tests__/providers.test.tsx` |
| _components/AuthSessionHeader.tsx | `_components/__tests__/AuthSessionHeader.test.tsx` |
| privacy/page.tsx | `privacy/__tests__/page.test.tsx` |
| terms/page.tsx | `terms/__tests__/page.test.tsx` |
| login/error.tsx | `login/__tests__/error.test.tsx` |

### Task 5.5: Loading states + missing app files (+6 tests)

| File | Test |
|---|---|
| [symbol]/loading.tsx | `[symbol]/__tests__/loading.test.tsx` |
| [symbol]/news/loading.tsx | `[symbol]/news/__tests__/loading.test.tsx` |
| [symbol]/fundamental/loading.tsx | `[symbol]/fundamental/__tests__/loading.test.tsx` |
| [symbol]/options/loading.tsx | `[symbol]/options/__tests__/loading.test.tsx` |
| [symbol]/overall/loading.tsx | `[symbol]/overall/__tests__/loading.test.tsx` |
| [symbol]/SymbolLayoutClient.tsx | `[symbol]/__tests__/SymbolLayoutClient.test.tsx` |

Loading tests are simple: render, verify skeleton/spinner elements exist.

### Task 5.6: Threshold gate → 85% (after Phase 4+5)

---

## Phase 6: Integration Tests (~15 new tests)

> These tests simulate real user flows across multiple layers. They render component subtrees with minimal mocking to verify that layers connect correctly.

### Task 6.1: Ticker search → Symbol page navigation

**File:** `src/__integration__/tickerSearchNavigation.test.tsx`

Tests the complete flow: user types in search → sees autocomplete → selects result → navigates to symbol page.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TickerAutocomplete } from '@/features/ticker-search/ui/TickerAutocomplete';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, prefetch: vi.fn() }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/entities/ticker/actions/searchTickerAction', () => ({
    searchTickerAction: vi.fn().mockResolvedValue([
        { symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플', exchange: 'NASDAQ' },
        { symbol: 'AAPL34', name: 'Apple Inc BDR', koreanName: null, exchange: 'SAO' },
    ]),
}));

describe('Ticker Search → Navigation Integration', () => {
    it('user types ticker → sees results → clicks → navigates', async () => {
        const user = userEvent.setup();
        render(<TickerAutocomplete />);

        const input = screen.getByPlaceholderText(/종목/);
        await user.type(input, 'AAPL');

        await waitFor(() => {
            expect(screen.getByText(/Apple Inc/)).toBeInTheDocument();
        });

        await user.click(screen.getByText(/Apple Inc/));
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/AAPL'));
    });

    it('keyboard navigation: ArrowDown → Enter selects result', async () => {
        const user = userEvent.setup();
        render(<TickerAutocomplete />);

        await user.type(screen.getByPlaceholderText(/종목/), 'AAPL');
        await waitFor(() => screen.getByText(/Apple Inc/));

        await user.keyboard('{ArrowDown}{Enter}');
        expect(mockPush).toHaveBeenCalled();
    });

    it('Escape closes dropdown without navigating', async () => {
        const user = userEvent.setup();
        render(<TickerAutocomplete />);

        await user.type(screen.getByPlaceholderText(/종목/), 'AAPL');
        await waitFor(() => screen.getByText(/Apple Inc/));

        await user.keyboard('{Escape}');
        expect(screen.queryByText(/Apple Inc/)).not.toBeInTheDocument();
        expect(mockPush).not.toHaveBeenCalled();
    });
});
```

### Task 6.2: Symbol page tab navigation

**File:** `src/__integration__/symbolTabNavigation.test.tsx`

Tests tab switching on the symbol page — verifying correct tab highlights and URL changes.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SymbolTabs } from '@/widgets/symbol-page/SymbolTabs';

let currentPath = '/AAPL';

vi.mock('next/navigation', () => ({
    usePathname: () => currentPath,
}));
vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: any) => (
        <a href={href} onClick={() => { currentPath = href; }} {...props}>{children}</a>
    ),
}));

describe('Symbol Page Tab Navigation', () => {
    const tabs = [
        { path: '/AAPL', label: '차트' },
        { path: '/AAPL/news', label: '뉴스' },
        { path: '/AAPL/fundamental', label: '펀더멘털' },
        { path: '/AAPL/options', label: '옵션' },
        { path: '/AAPL/fear-greed', label: '공포탐욕' },
        { path: '/AAPL/overall', label: '종합' },
    ];

    it('renders all 6 tab links', () => {
        render(<SymbolTabs symbol="AAPL" />);
        for (const tab of tabs) {
            expect(screen.getByRole('link', { name: new RegExp(tab.label) })).toBeInTheDocument();
        }
    });

    it('highlights active tab based on current pathname', () => {
        currentPath = '/AAPL/news';
        const { rerender } = render(<SymbolTabs symbol="AAPL" />);
        const newsTab = screen.getByRole('link', { name: /뉴스/ });
        expect(newsTab).toHaveAttribute('aria-current', 'page');
    });

    it('clicking tab updates path and highlights new tab', async () => {
        currentPath = '/AAPL';
        const user = userEvent.setup();
        const { rerender } = render(<SymbolTabs symbol="AAPL" />);

        await user.click(screen.getByRole('link', { name: /뉴스/ }));
        rerender(<SymbolTabs symbol="AAPL" />);

        expect(currentPath).toBe('/AAPL/news');
    });

    it('each tab has correct href', () => {
        currentPath = '/AAPL';
        render(<SymbolTabs symbol="AAPL" />);
        for (const tab of tabs) {
            const link = screen.getByRole('link', { name: new RegExp(tab.label) });
            expect(link).toHaveAttribute('href', tab.path);
        }
    });
});
```

### Task 6.3: Auth signup → email verification flow

**File:** `src/__integration__/authSignupFlow.test.tsx`

Tests: render signup form → fill fields → submit → verify action called with correct data → verify redirect.

### Task 6.4: Auth login → session → redirect flow

**File:** `src/__integration__/authLoginFlow.test.tsx`

Tests: render login form → enter credentials → submit → action returns error → show error → retry → success → redirect.

### Task 6.5: OAuth flow → consent → completion

**File:** `src/__integration__/oauthFlow.test.ts`

Tests: OAuth start route generates URL → callback route processes code → pending signup stored → consent form renders → finalize creates account.

### Task 6.6: Analysis submission → polling → result display

**File:** `src/__integration__/analysisFlow.test.tsx`

Tests: click analyze button → submitAnalysisAction → poll loop → result renders in AnalysisPanel.

### Task 6.7: News analysis → card enrichment → display

**File:** `src/__integration__/newsAnalysisFlow.test.tsx`

Tests: news page loads → cards show pending state → background analysis completes → cards update with sentiment.

### Task 6.8: Contact form → submission → success notice

**File:** `src/__integration__/contactFormFlow.test.tsx`

Tests: open contact dialog → fill all fields → submit → success notice appears → form resets.

### Task 6.9: Mobile bottom sheet interaction

**File:** `src/__integration__/mobileSheetInteraction.test.tsx`

Tests: open analysis sheet → drag resize → content scrolls → close sheet → state clears.

### Task 6.10: Options page → expiration selector → chain table

**File:** `src/__integration__/optionsPageFlow.test.tsx`

Tests: load options page → select expiration date → chain table updates → metrics row recalculates.

### Task 6.11: Password reset → email → new password

**File:** `src/__integration__/passwordResetFlow.test.tsx`

Tests: forgot password form → submit → request action → reset form → submit new password → success.

### Task 6.12: Account deletion flow

**File:** `src/__integration__/accountDeleteFlow.test.tsx`

Tests: account page → click delete → confirmation form → type confirmation → submit → redirected.

### Task 6.13: Dashboard → sector signal → ticker click

**File:** `src/__integration__/dashboardNavigation.test.tsx`

Tests: market page loads → sector tabs → click tab → signal cards update → click stock card → navigates to symbol page.

### Task 6.14: Ticker search with recent searches

**File:** `src/__integration__/recentSearches.test.tsx`

Tests: search and select ticker → revisit search → see recent searches → click recent → navigates.

### Task 6.15: Fear & Greed gauge interaction

**File:** `src/__integration__/fearGreedInteraction.test.tsx`

Tests: navigate to fear-greed tab → gauge renders with score → historical chart loads → hover shows tooltip.

### Task 6.16: Home page category browsing

**File:** `src/__integration__/homePageCategoryBrowse.test.tsx`

Tests: home page loads → see ticker categories → click category → tickers shown → click ticker → navigates.

### Task 6.17: Backtesting filter flow

**File:** `src/__integration__/backtestingFilterFlow.test.tsx`

Tests: backtesting page loads → apply tag filter → case list updates → click case card → details shown.

### Task 6.18: PWA install banner interaction

**File:** `src/__integration__/pwaInstallFlow.test.tsx`

Tests: detect PWA-eligible browser → show install banner → click install → calls beforeinstallprompt → dismiss → banner hidden → localStorage persisted.
iOS variant: detect iOS Safari → show iOS modal → close → modal hidden.

### Task 6.19: Model selector (premium/free switching)

**File:** `src/__integration__/modelSelectorFlow.test.tsx`

Tests: free user sees allowed models → select premium model → gate modal shown → dismiss → reverts to free model.
Premium user: select any model → no gate → model applied → analysis re-triggers.

### Task 6.20: API key management flow

**File:** `src/__integration__/apiKeyManagementFlow.test.tsx`

Tests: open API key section → enter key → click save → action called → success feedback → key masked display.
Error case: invalid key format → validation error shown → key not saved.

### Task 6.21: Chart indicator toolbar

**File:** `src/__integration__/chartIndicatorFlow.test.tsx`

Tests: open indicator dropdown → select RSI → RSI pane appears → toggle off → pane removed.
Multiple indicators: add MACD + Bollinger → both visible → remove one → other persists.

### Task 6.22: Chart timeframe change

**File:** `src/__integration__/chartTimeframeFlow.test.tsx`

Tests: default timeframe shown → click "1W" → useBars re-fetches with weekly → chart updates → analysis re-triggers if auto-analyze enabled.

### Task 6.23: Legal page navigation

**File:** `src/__integration__/legalPageNavigation.test.tsx`

Tests: navigate to /privacy → breadcrumb shows "개인정보처리방침" → TOC links work → navigate to /terms → content changes → breadcrumb updates.

### Task 6.24: 404 page behavior

**File:** `src/__integration__/notFoundPage.test.tsx`

Tests: navigate to nonexistent route → 404 page renders → shows category suggestions → click category → navigates to valid page.

### Task 6.25: User journey — 신규 사용자 (New user full journey)

**File:** `src/__integration__/journeyNewUser.test.tsx`

Tests the complete new user experience end-to-end:

```ts
describe('New User Journey', () => {
    it('home → category browse → ticker click → chart page', async () => { ... });
    it('chart page → tab navigation (news → fundamental)', async () => { ... });
    it('free analysis → premium model attempt → gate modal', async () => { ... });
    it('gate modal → navigate to signup → register → login → analysis retry', async () => { ... });
});
```

### Task 6.26: User journey — 기존 사용자 (Returning user journey)

**File:** `src/__integration__/journeyReturningUser.test.tsx`

Tests the daily workflow of a returning user:

```ts
describe('Returning User Journey', () => {
    it('login → market dashboard → sector signal scan', async () => { ... });
    it('click signal stock → symbol page → chart with indicators', async () => { ... });
    it('change timeframe → add MACD + Bollinger → chart updates', async () => { ... });
    it('navigate to overall tab → AI 종합 분석 → chat follow-up', async () => { ... });
});
```

### Task 6.27: User journey — 에러 복구 (Error recovery journey)

**File:** `src/__integration__/journeyErrorRecovery.test.tsx`

Tests error scenarios and recovery during real user sessions:

```ts
describe('Error Recovery Journey', () => {
    it('analysis start → AI timeout → error banner → retry → success', async () => { ... });
    it('tab switch during analysis → cancel → new tab analysis starts', async () => { ... });
    it('news analysis fails → error state → retry button → success', async () => { ... });
    it('network disconnect → reconnect → state preserved → resume', async () => { ... });
});
```

### Task 6.last: Threshold gate → 90% (final)

- [ ] **Step 1:** `yarn test-coverage` — verify all metrics >90%
- [ ] **Step 2:** Update `vitest.config.ts` thresholds to final values:

```ts
thresholds: {
    statements: 90,
    branches: 90,
    functions: 90,
    lines: 90,
},
```

- [ ] **Step 3:** Final commit

```bash
git add vitest.config.ts
git commit -m "chore(test): restore coverage threshold to 90% — all layers covered

All FSD layers (shared, entities, features, widgets, app) measured
and exceeding 90% coverage. 15 integration tests verify cross-layer
user flows. Vitest migration complete."
```

---

## Phase 7: Worst-Case / Error / Edge-Case Tests (~21 new tests)

> These tests verify the system behaves correctly under failure conditions. Each test targets a specific error path, not just the happy path.

### Critical Severity (Data Loss / Security) — 4 tests

#### Task 7.1: LLM API failure responses

**File:** `src/__tests__/worst-case/llmProviderFailures.test.ts`

```ts
describe('LLM Provider Error Handling', () => {
    it('router throws when AI API returns null/empty text response', async () => { ... });
    it('Anthropic adapter handles AbortSignal timeout (10s)', async () => { ... });
    it('OpenAI adapter handles 500 Internal Server Error', async () => { ... });
    it('Gemini adapter handles invalid model ID', async () => { ... });
    it('router returns descriptive error with provider name on failure', async () => { ... });
});
```

#### Task 7.2: User registration compensation failure

**File:** `src/__tests__/worst-case/registerUserCompensation.test.ts`

```ts
describe('registerUser compensation rollback', () => {
    it('agreements INSERT fails → compensating DELETE succeeds → clean state', async () => { ... });
    it('agreements INSERT fails → compensating DELETE also fails → user row orphaned', async () => { ... });
    it('concurrent registration with same email → second attempt gets email_exists error', async () => { ... });
    it('bcrypt hash generation throws → registration fails without creating user', async () => { ... });
});
```

#### Task 7.3: Session expiry and token security

**File:** `src/__tests__/worst-case/sessionSecurity.test.ts`

```ts
describe('Session security edge cases', () => {
    it('expired session token (expiresAt <= now) returns null', async () => { ... });
    it('missing session cookie returns null without DB query', async () => { ... });
    it('malformed token format returns null', async () => { ... });
    it('session deleted between cookie read and DB lookup returns null', async () => { ... });
    it('timing-safe token comparison prevents timing attacks', () => { ... });
});
```

#### Task 7.4: Database retry exhaustion

**File:** `src/__tests__/worst-case/databaseRetryExhaustion.test.ts`

```ts
describe('withRetry + Neon transient errors', () => {
    it('retries on Neon transient error up to maxRetries', async () => { ... });
    it('throws original error when backoff budget (5s) exceeded', async () => { ... });
    it('non-retryable Neon error thrown immediately without retry', async () => { ... });
    it('Drizzle-wrapped Neon error detected via cause chain (up to 8 levels)', async () => { ... });
});
```

### High Severity (Broken UX) — 6 tests

#### Task 7.5: Asset info graceful degradation chain

**File:** `src/__tests__/worst-case/assetInfoDegradation.test.ts`

```ts
describe('getAssetInfo degradation: cache → DB → API → null', () => {
    it('cache miss → DB hit → returns DB result', async () => { ... });
    it('cache miss → DB miss → FMP hit → returns FMP result', async () => { ... });
    it('all three layers fail → returns null (never throws)', async () => { ... });
    it('FMP timeout (10s) → returns null gracefully', async () => { ... });
    it('invalid ticker format returns null early without API calls', async () => { ... });
    it('concurrent 100 calls for same symbol collapse into 1 via singleFlight', async () => { ... });
    it('cache write fails → warning logged → data still returned', async () => { ... });
});
```

#### Task 7.6: Empty chart data handling

**File:** `src/__tests__/worst-case/emptyChartData.test.tsx`

```ts
describe('Chart with empty/invalid data', () => {
    it('empty bars array shows fallback message', () => { ... });
    it('bars with all-zero OHLC renders without crash', () => { ... });
    it('chart container with zero width/height handled gracefully', () => { ... });
});
```

#### Task 7.7: News API malformed data

**File:** `src/__tests__/worst-case/newsApiMalformed.test.ts`

```ts
describe('FMP news API error handling', () => {
    it('mixed valid/malformed items → only valid items upserted', async () => { ... });
    it('publishedDate missing timezone → parsed as UTC', async () => { ... });
    it('completely invalid date format → row skipped with warning', async () => { ... });
    it('news item missing url or title → adapter throws during mapping', async () => { ... });
    it('FMP returns 4xx/5xx → error thrown, no partial data stored', async () => { ... });
});
```

#### Task 7.8: Options chain missing data

**File:** `src/__tests__/worst-case/optionsChainMissing.test.ts`

```ts
describe('Yahoo options adapter edge cases', () => {
    it('underlyingPrice=0 → returns null (OptionsEmptyState)', async () => { ... });
    it('additional expiration fetch fails → that slot skipped, others proceed', async () => { ... });
    it('all chains rejected by sanitization → returns null', async () => { ... });
    it('expirationDates empty → no chains → returns null', async () => { ... });
});
```

#### Task 7.9: OAuth state validation failure

**File:** `src/__tests__/worst-case/oauthStateValidation.test.ts`

```ts
describe('OAuth callback security', () => {
    it('misconfigured HMAC secret → redirect to login with oauth_unknown error', async () => { ... });
    it('missing state cookie → redirect with error', async () => { ... });
    it('provider returns email that conflicts with existing user → error', async () => { ... });
    it('expired OAuth code → code exchange fails → error', async () => { ... });
    it('pending signup store unavailable → error', async () => { ... });
});
```

#### Task 7.10: Auth hint cookie failure

**File:** `src/__tests__/worst-case/authHintCookieFailure.test.ts`

```ts
describe('Login with cookie edge cases', () => {
    it('login succeeds, session set, but auth hint cookie fails → silent ignore', async () => { ... });
    it('subsequent operations handle null auth hint gracefully', async () => { ... });
});
```

### Medium Severity (Degraded UX) — 6 tests

#### Task 7.11: AI provider rate limiting

**File:** `src/__tests__/worst-case/aiRateLimit.test.ts`

```ts
describe('AI provider 429 rate limiting', () => {
    it('Anthropic 429 → error propagates to caller', async () => { ... });
    it('OpenAI 429 → error propagates to caller', async () => { ... });
    it('Gemini 429 → error propagates to caller', async () => { ... });
});
```

#### Task 7.12: Email verification edge cases

**File:** `src/__tests__/worst-case/emailVerificationEdgeCases.test.ts`

```ts
describe('verifyEmail edge cases', () => {
    it('wrong code → timing-safe comparison → invalid_verification_code error', async () => { ... });
    it('already verified code → error', async () => { ... });
    it('expired code (>30min) → error', async () => { ... });
});
```

#### Task 7.13: Password reset token edge cases

**File:** `src/__tests__/worst-case/passwordResetEdgeCases.test.ts`

```ts
describe('confirmPasswordReset edge cases', () => {
    it('expired token (>30min) → expired_token error', async () => { ... });
    it('token already consumed → error', async () => { ... });
    it('invalid token format → error', async () => { ... });
    it('user deleted between token generation and confirmation → error', async () => { ... });
});
```

#### Task 7.14: Malformed API request bodies

**File:** `src/__tests__/worst-case/malformedApiRequests.test.ts`

```ts
describe('API route input validation', () => {
    it('cancel route: missing jobs array → 400', async () => { ... });
    it('cancel route: invalid job type → 400', async () => { ... });
    it('cancel route: non-JSON body → 400', async () => { ... });
    it('cancel route: partial success → 204 (allSettled isolation)', async () => { ... });
});
```

#### Task 7.15: FMP API rate limit

**File:** `src/__tests__/worst-case/fmpRateLimit.test.ts`

```ts
describe('FMP httpClient error handling', () => {
    it('FMP 429 → descriptive error thrown', async () => { ... });
    it('FMP timeout (10s) → AbortError thrown', async () => { ... });
    it('FMP 500 → error with status code', async () => { ... });
});
```

#### Task 7.16: Single-flight translation collapse

**File:** `src/__tests__/worst-case/singleFlightCollapse.test.ts`

```ts
describe('singleFlight concurrent request collapse', () => {
    it('100 concurrent calls for same key → 1 execution, all get same result', async () => { ... });
    it('execution fails → all waiters get the error', async () => { ... });
    it('after failure, next call starts fresh execution', async () => { ... });
});
```

### AI / External API Specific Failures — 6 tests

#### Task 7.22: AI slow response + polling timeout

**File:** `src/__tests__/worst-case/aiSlowResponse.test.ts`

```ts
describe('AI slow response handling', () => {
    it('Anthropic stream exceeds 10s AbortSignal → timeout error thrown', async () => { ... });
    it('OpenAI response takes 30s+ → AbortSignal fires → error propagated', async () => { ... });
    it('Gemini response delayed → timeout → feature layer shows retry prompt', async () => { ... });
    it('pollAnalysisAction receives "timeout" status from redis → UI shows timeout banner', async () => { ... });
    it('analysis polling hits maxRetries → stops polling → shows stale analysis', async () => { ... });
});
```

#### Task 7.23: Redis polling error during analysis

**File:** `src/__tests__/worst-case/pollAnalysisRedisError.test.ts`

```ts
describe('Analysis polling redis errors', () => {
    it('pollAnalysisAction returns error status → UI shows error with retry', async () => { ... });
    it('poll returns unexpected shape (missing fields) → graceful fallback', async () => { ... });
    it('poll returns stale data (old timestamp) → treated as pending', async () => { ... });
    it('redis connection fails mid-polling → error propagated to caller', async () => { ... });
});
```

#### Task 7.24: FMP large response / edge cases

**File:** `src/__tests__/worst-case/fmpLargeResponse.test.ts`

```ts
describe('FMP API large/edge responses', () => {
    it('FMP returns 1000+ news items → all processed without memory issue', async () => { ... });
    it('FMP returns empty array → no items upserted, no error', async () => { ... });
    it('FMP ticker search returns 500+ results → truncated to limit', async () => { ... });
    it('FMP fundamental data missing key fields → partial data returned', async () => { ... });
});
```

#### Task 7.25: Yahoo API timeout + edge cases

**File:** `src/__tests__/worst-case/yahooTimeout.test.ts`

```ts
describe('Yahoo Finance API failures', () => {
    it('Yahoo API timeout → adapter returns null → OptionsEmptyState shown', async () => { ... });
    it('Yahoo returns HTML instead of JSON (server error page) → adapter handles gracefully', async () => { ... });
    it('Yahoo rate limits (429) → error propagated → retry prompt shown', async () => { ... });
    it('Yahoo returns options with 100+ expirations → processed without issue', async () => { ... });
});
```

#### Task 7.26: AI malformed JSON response

**File:** `src/__tests__/worst-case/aiMalformedJsonResponse.test.ts`

```ts
describe('AI JSON response parsing', () => {
    it('AI returns invalid JSON → jsonrepair attempted → success', async () => { ... });
    it('AI returns invalid JSON → jsonrepair fails → descriptive error thrown', async () => { ... });
    it('AI returns valid JSON but wrong schema → validation fails → error', async () => { ... });
    it('AI returns truncated JSON (cut mid-string) → jsonrepair fixes it', async () => { ... });
    it('AI returns markdown-wrapped JSON (```json...```) → extracted and parsed', async () => { ... });
});
```

#### Task 7.27: Analysis result missing required fields

**File:** `src/__tests__/worst-case/analysisMissingFields.test.ts`

```ts
describe('Analysis result field validation', () => {
    it('AI result missing summary field → fallback message shown', async () => { ... });
    it('AI result missing signals array → empty signals displayed', async () => { ... });
    it('AI result missing keyLevels → chart renders without levels', async () => { ... });
    it('AI result has null confidence → default confidence used', async () => { ... });
    it('parseStructuredSummary receives empty string → returns null', () => { ... });
    it('parseStructuredSummary receives partial JSON → extracts available fields', () => { ... });
});
```

### Low Severity (Cosmetic / Logging) — 5 tests

#### Task 7.17: Cache write best-effort failure

**File:** `src/__tests__/worst-case/cacheWriteFailure.test.ts`

```ts
describe('Best-effort cache operations', () => {
    it('cache.set failure logged as warning, data still returned', async () => { ... });
});
```

#### Task 7.18: Chart resize during hydration

**File:** `src/__tests__/worst-case/chartResizeHydration.test.tsx`

```ts
describe('Chart resize edge cases', () => {
    it('indicator toggle on first mount skips resize (isInitialPaneRenderRef)', () => { ... });
    it('subsequent toggles trigger resize correctly', () => { ... });
});
```

#### Task 7.19: Background translation failure

**File:** `src/__tests__/worst-case/backgroundTranslation.test.ts`

```ts
describe('Background Korean translation', () => {
    it('Gemini translation fails → console.warn, response not blocked', async () => { ... });
    it('English name still returned when Korean translation unavailable', async () => { ... });
});
```

#### Task 7.20: Yahoo finance notice suppression

**File:** `src/__tests__/worst-case/yahooNoticeSuppression.test.ts`

```ts
describe('Yahoo finance library config', () => {
    it('suppressNotices includes yahooSurvey', () => { ... });
});
```

#### Task 7.21: Job cancellation partial failure

**File:** `src/__tests__/worst-case/jobCancelPartialFailure.test.ts`

```ts
describe('Job cancel with allSettled isolation', () => {
    it('mixed success/failure → 204 returned, each job independent', async () => { ... });
    it('all jobs fail → still returns 204', async () => { ... });
});
```

---

## Acceptance Criteria

1. `yarn test-coverage` passes with 90% threshold for statements, branches, functions, lines
2. Coverage measurement includes ALL FSD layers (shared, entities, features, widgets, app)
3. Every layer individually exceeds 90% line coverage
4. At least 30 test files use `userEvent` for user interaction testing
5. **24 integration test files** verify cross-layer user flows (happy + sad path)
6. **27 worst-case test files** verify error/edge-case behavior (Critical 4 + High 6 + AI/API 6 + Medium 6 + Low 5)
7. **3 user journey tests** simulate end-to-end user sessions (신규/기존/에러복구)
8. All existing + new tests pass on Vitest
9. No Jest dependencies remain in package.json
10. Total test count: 226 existing + ~365 new ≈ **591 test files**
11. All layers exceed **95% branch coverage** (not just 90% line coverage)

## Threshold Ramp-Up Schedule

| After Phase | Threshold | Gate Task |
|---|---|---|
| Phase 0 | 50% | Task 0.2 |
| Phase 1 + 2 | 60% | Task 1.7 |
| Phase 3 | 70% | Task 3.4 |
| Phase 4 midpoint | 80% | Task 4.10 |
| Phase 4 + 5 | 85% | Task 5.6 |
| Phase 6 + 7 | **90% (final)** | Task 6.last |
