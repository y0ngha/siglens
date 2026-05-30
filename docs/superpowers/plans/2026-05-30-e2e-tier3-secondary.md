# E2E Tier 3 — Secondary Pages Specs Implementation Plan (PR-C)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).
> **Repo policy:** implementer commits in the worktree; final PR + merge via git-agent (or orchestrator if agents unavailable). Multi-line JSDoc allowed.
> **Hard lessons from Tier 1/2 — bake into EVERY task:**
> 1. **Assert OUTCOMES, not primitives.** A page-render spec proves "this route renders its identifying, viewport-independent, data-independent marker" (a stable visible h1 / heading text emitted by RSC). Do NOT assert FMP/Yahoo/LLM-backed dynamic content (faked/short-circuited under E2E).
> 2. **`.env.local` masks CI gaps.** CI has ONLY `.env.e2e`. If a page/action needs an env var (throws if unset), add it to `.env.e2e` with a WHY comment. Verify a cold build + e2e run rely only on `.env.e2e`.
> 3. **Network is guarded.** Specs import `{ test, expect }` from `../support/fixtures` (allows only localhost:4300 + non-http schemes). Any external call not faked fails the test — that's the signal to fake it server-side under `E2E_TEST=1` (mirror existing fakes).
> 4. **CI-only flake debugging:** if a spec passes locally but fails in CI, do NOT guess — download the `playwright-report` artifact (`gh run download <RUN>`), read each failure's `error-context.md` (a11y snapshot) + `test-failed-1.png`. See `feedback_e2e_ci_flake_playbook`.
> 5. **Mobile (@webkit) Radix-aria-hidden trap:** on symbol pages the `MobileAnalysisSheet` (vaul Drawer) makes the page body `aria-hidden` → `getByRole` fails on mobile. Tier 3 pages (`/`, `/market`, `/backtesting`, `/privacy`, `/terms`) do NOT render that sheet, so role queries are fine there. But any NEW @webkit spec on a symbol page must route via URL + use role-agnostic CSS locators (see symbol-tabs.spec.ts).
> 6. `playwright.config.ts` already sets `workers: 1` + generous timeouts for CI (DB-write specs hang under parallel). Do NOT revert.

**Goal:** Add the 6 Tier-3 secondary-page E2E specs (home, market, backtesting, contact dialog, legal pages, pwa-install) verifying each renders its stable, data-independent outcome on real browsers, plus any server-side fake the contact path needs.

**Architecture:** These are mostly RSC-rendered marketing/legal/analysis-showcase pages plus two interactive surfaces (the Footer-triggered ContactDialog and the PwaBanner/IosInstallModal). No new analysis seams: the analysis short-circuit + data fakes from Tier 1/2 already cover any analysis content these pages embed. The only possible new fake is the contact-submit path if it calls an external service not already faked by the Tier 2 email dispatcher.

**Tech Stack:** Playwright (existing harness), `E2E_TEST` server-side injection, existing fixtures/fakes.

---

## Pre-flight (resolved by investigation — verify exact strings against the real DOM)
- Routes (app router): `/` (home), `/market`, `/backtesting`, `/privacy`, `/terms`. No `/contact` route — contact is a **dialog** (`src/widgets/layout/ContactDialog.tsx`) triggered from `src/widgets/layout/Footer.tsx` ("문의하기"). Dialog description: "의견이나 오류 제보를 남겨 주세요".
- PWA: `src/features/pwa-install/ui/PwaBanner.tsx` + `IosInstallModal`. Banner text seen in webkit: "앱으로 설치하면 더 빠르게 접속할 수 있어요" + "설치하기". Render is gated by `detectPwaEnvironment` (beforeinstallprompt for Chromium, iOS-standalone heuristic for webkit). Read `src/features/pwa-install/lib/detectPwaEnvironment.ts` + `PwaBanner.tsx` to learn the exact trigger conditions before writing the spec.
- Home `/`: hero h1 (long marketing copy), sector scanner section ("…개 섹터의 선도 종목을 매일 스캔…"), FAQ ("같은 실적 지표는 어디서 보나요?"), the header search combobox (`getByRole('banner').getByRole('combobox',{name:'종목 티커 검색'})`).
- Market `/market`: h1 "미국 주식 시장 개요"; sections "골든크로스 스캐너", "…개 섹터 신호 스캐너".
- Backtesting `/backtesting`: an analysis-showcase page (sample RSI/pattern narratives). Find a STABLE, data-independent marker (page h1 or a static section heading) — NOT the sample analysis bodies.
- Privacy/Terms: legal text pages. Each has `metadata.title` + visible headings ("투자 면책 고지 요약", "중요 안내" on one of them). Use the page's visible h1 (verify which heading is the h1).
- Contact submit: read `src/features/contact-form/ui/ContactForm.tsx` + its action to learn (a) the submit/success affordances, (b) whether it hits an external service or the email dispatcher (already faked in Tier 2) or a DB insert. If it calls something not faked, the network guard will catch it → fake it server-side under E2E_TEST (mirror `E2eEmailDispatcher`).

---

## Task A: Investigate contact-submit + PWA trigger (no code yet)
**Files:** read-only.
- [ ] Read `src/features/contact-form/ui/ContactForm.tsx`, its server action (`src/features/contact-form/**/actions` or `api`), and `src/widgets/layout/ContactDialog.tsx`. Record: trigger to open the dialog (Footer "문의하기"), the form fields (message/email?), the submit button label, the success indicator (toast/text/closed dialog), and the submit transport (Resend? Slack webhook? DB? email dispatcher?).
- [ ] Read `src/features/pwa-install/lib/detectPwaEnvironment.ts` + `src/features/pwa-install/ui/PwaBanner.tsx` + `IosInstallModal.tsx`. Record exactly what makes the banner/modal appear (event listener, env detection, localStorage dismissal key) and whether it is testable deterministically in Playwright (e.g., dispatch a `beforeinstallprompt` event, or assert the iOS modal on the webkit project, or assert the banner is dismissable and the dismissal persists).
- [ ] If contact-submit hits an un-faked external service: plan the fake (new gate under E2E_TEST mirroring Tier 2). If it uses the existing email dispatcher or a DB insert, no new fake needed.
- [ ] Output a short findings note in the PR description (no commit needed for read-only, or commit a one-line note if you add a fake).

## Task B (only if Task A found an un-faked external contact transport): fake it
**Files:** create the fake + gate; colocated tests (MISTAKES.md §22 — all branches).
- [ ] Add an `E2E_TEST==='1'` gate at the contact transport boundary returning a deterministic success without network (require-gated; config-level eslint override if `require` needed — NO inline disable, MISTAKES.md §13). Path aliases not relative (§7.6).
- [ ] Colocated unit test: E2E→fake, unset→real.
- [ ] Commit: `feat(e2e): fake contact submit transport under E2E_TEST`.

## Task 1: `home.spec.ts`
**Files:** Create `e2e/specs/home.spec.ts`.
- [ ] Import `{ test, expect }` from `../support/fixtures`. Assert: (a) `page.goto('/')`; (b) the hero h1 visible (verify exact/regex text from `src/app/page.tsx`); (c) the sector-scanner section heading visible; (d) the header search combobox visible and typing a query + selecting navigates to `/AAPL` (reuse the smoke/`tickerSearchNavigation` selector — search short-circuits to the AAPL fixture under E2E). Keep assertions data-independent.
- [ ] Run green chromium (`yarn test:e2e e2e/specs/home.spec.ts --project=chromium`). Commit: `test(e2e): home page renders hero + sector scanner + search nav`.

## Task 2: `market.spec.ts`
**Files:** Create `e2e/specs/market.spec.ts`.
- [ ] `page.goto('/market')`; assert h1 "미국 주식 시장 개요" (verify) + the "골든크로스 스캐너"/sector-signal section heading visible. The sector scanner content is data-backed (faked market provider) — assert the section's stable heading/landmark, not specific tickers. If clicking a scanned signal navigates to a symbol, optionally assert one navigation (data permitting; otherwise skip).
- [ ] Run green chromium. Commit: `test(e2e): market overview renders scanner sections`.

## Task 3: `backtesting.spec.ts`
**Files:** Create `e2e/specs/backtesting.spec.ts`.
- [ ] `page.goto('/backtesting')`; assert the page's STABLE marker (h1 / static section heading from `src/app/backtesting/`, verified against the DOM — NOT the sample analysis narratives, which are content). If the page is purely a static showcase, asserting the h1 + one static section heading is sufficient.
- [ ] Run green chromium. Commit: `test(e2e): backtesting showcase renders`.

## Task 4: `contact.spec.ts`
**Files:** Create `e2e/specs/contact.spec.ts`.
- [ ] Open the ContactDialog via the Footer "문의하기" trigger (scroll to footer if needed); assert the dialog opens (role=dialog, description "의견이나 오류 제보를 남겨 주세요"). Fill the message (+ email if required), submit, and assert the SUCCESS outcome (success text/toast or dialog closed) — using the fake/real transport per Task A. Also assert a validation branch if cheap (empty submit → error/disabled).
- [ ] Run green chromium. Commit: `test(e2e): contact dialog submit succeeds`.

## Task 5: `legal.spec.ts`
**Files:** Create `e2e/specs/legal.spec.ts`.
- [ ] Two cases (or a loop): `/privacy` and `/terms`. For each, assert the page's visible h1/heading (verify exact text per page) and that the document `title` matches the route's `metadata.title`. These render from seeded active terms (global-setup seeds active privacy/tos) — confirm no `relation "terms" does not exist` or missing-content errors. Assert the disclaimer marker ("투자 면책 고지 요약"/"중요 안내") on whichever page renders it.
- [ ] Run green chromium. Commit: `test(e2e): privacy/terms legal pages render`.

## Task 6: `pwa-install.spec.ts` (likely `@webkit` for the iOS modal)
**Files:** Create `e2e/specs/pwa-install.spec.ts`.
- [ ] Per Task A findings, drive the PWA install surface deterministically:
  - Chromium: dispatch a synthetic `beforeinstallprompt` event (`page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')))` — adjust to the real event shape/listener) → assert the PwaBanner "설치하기" appears; assert dismiss hides it and the dismissal persists (localStorage key from `detectPwaEnvironment`).
  - Webkit (`@webkit`): assert the iOS install modal/banner path per its real iOS-detection trigger (may need a forced condition). If the trigger cannot be made deterministic in webkit, reduce to asserting the banner is NOT shown by default (no event) and document why, OR gate the webkit case behind the achievable condition. Layout IS the feature on webkit, so prefer asserting the visible install affordance if reachable.
- [ ] Run green chromium (+ webkit for `@webkit`). Commit: `test(e2e): pwa install banner/modal surfaces`.

## Verification (whole PR)
- [ ] `yarn typecheck` 0; `yarn lint` clean (no inline eslint-disable; FSD/`@e2e` restrictions intact); `yarn test` green (existing suite + any new colocated tests).
- [ ] `yarn e2e:up && yarn e2e:db && yarn test:e2e` → ALL specs pass (Tier 1 + Tier 2 + Tier 3) on chromium (+ webkit for `@webkit`). Network guard clean (zero external).
- [ ] **CI-condition check:** cold build + e2e rely ONLY on `.env.e2e` (no `.env.local`) — no missing-secret throw. If a new env var was needed, it is in `.env.e2e` with a WHY comment.
- [ ] Prod path unchanged when `E2E_TEST` unset.

## Self-Review
- Spec coverage: home, market, backtesting, contact, legal(privacy+terms), pwa-install = 6 Tier-3 journeys. Contact + PWA are the interactive ones; the rest are render-marker specs.
- Placeholder scan: selector/transport discovery is concrete inspect-then-implement steps (acceptable, matches Tier 1/2).
- Type consistency: reuses existing fixtures/fakes; only Task B introduces a new gate (mirrors Tier 2 pattern).

## Out of scope: Tier 4 (PR-D — resilience, not-found, seo-smoke).
