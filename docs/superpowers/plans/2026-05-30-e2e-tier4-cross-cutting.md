# E2E Tier 4 — Cross-Cutting Specs Implementation Plan (PR-D)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.
> **Repo policy:** implementer commits in the worktree; final PR + merge via git-agent (or orchestrator if agents unavailable). Multi-line JSDoc allowed.
> **Hard lessons from Tier 1–3 — bake in:** assert OUTCOMES not primitives; `.env.local` masks CI gaps; network is guarded (fixtures); CI-only flakes → read the playwright-report artifact (a11y snapshot + screenshot), don't guess; `playwright.config.ts` already runs `workers:1` + generous CI timeouts (do NOT revert); a FLAKY spec blocks the unattended merge loop — prefer a robust narrower assertion over a fragile broad one.

**Goal:** Add the Tier-4 cross-cutting specs verifying not-found handling and SEO-infrastructure endpoints behave correctly on the real built app. (Resilience deferred — see below.)

**Architecture:** Pure black-box checks against the production build. No new server-side fakes; the Tier 1–3 fake providers already cover any data these surfaces touch (e.g. OG images render from faked providers).

**Tech Stack:** Playwright (existing harness), `page.request` for raw HTTP probes.

---

## Task 1: `not-found.spec.ts`
**Files:** Create `e2e/specs/not-found.spec.ts`.
- [ ] Two ways into the global `not-found.tsx`: an unknown route segment, and a malformed ticker (`/[symbol]/page.tsx` → `notFound()` when the segment fails `VALID_TICKER_RE = /^[A-Z][A-Z.-]{0,7}$/`; a well-formed-but-unseeded ticker would instead render via FakeMarketProvider, so use a regex-FAILING ticker, e.g. `/INVALIDTICKER1`).
- [ ] Assert the user-facing OUTCOME: the not-found heading ("페이지를 찾을 수 없습니다") + a home link (`/홈으로 돌아가기/`, `href="/"`) render, and the home link navigates back to the landing page. **Do NOT assert the HTTP status** — `/[symbol]` renders dynamically, so `notFound()` lands inside an already-committed streamed shell, making the status an unreliable implementation detail.
- [ ] Run green chromium. Commit: `test(e2e): not-found page for unknown routes + malformed tickers`.

## Task 2: `seo-smoke.spec.ts`
**Files:** Create `e2e/specs/seo-smoke.spec.ts`.
- [ ] Probe the crawler-facing endpoints with `page.request.get` (raw HTTP, not navigation) and assert 200 + content-type:
  - `/robots.txt` (text/plain), `/manifest.webmanifest` (manifest+json|json), `/sitemap.xml` + `/sitemap-static.xml` (xml; `/sitemap.xml` → `/api/sitemap` via next.config rewrite).
  - The six per-symbol OG images at `<route>/opengraph-image` (no generateImageMetadata → served at the base path): `/AAPL/opengraph-image` + news/fundamental/options/fear-greed/overall → image/png. Under E2E these render from faked providers (no real external API).
- [ ] Run green chromium. Commit: `test(e2e): seo smoke — robots/manifest/sitemap/OG endpoints`.

## Deferred: `resilience` (widget error boundary → retry → recovery)
The design's resilience spec is **deferred to a focused follow-up**, not shipped here. Rationale (verified by investigation):
- Under `E2E_TEST` the analysis paths short-circuit to a cached fixture server-side, so no client-observable failure occurs naturally.
- The widgets with explicit retry UIs render CONDITIONALLY: the options AI-analysis card (clean "다시 시도" retry) only renders when `!oiStale`, and `oiStale` is computed server-side from the ET session + the OI snapshot — not controllable from the browser (page.clock only affects the client). The technical-analysis `ErrorBanner` shows the raw error message with no stable role/text selector.
- Forcing failure via Playwright route-interception of the server-action POST proved FLAKY (1/2) because of the conditional render + abort race — and a flaky spec blocks the unattended CI loop (the failure mode fought throughout Tier 2).
- **Proper fix (follow-up):** add an `E2E_TEST`-gated, request-scoped error-injection seam (e.g. a `x-e2e-force-analysis-error` cookie/header the submit action honors) so the error boundary → retry → recovery loop can be driven deterministically, paired with a guaranteed-rendered widget. This is a small, clean test seam but is its own change with colocated tests.

## Verification (whole PR)
- [ ] `yarn typecheck` 0; `yarn lint` clean; `yarn test` green.
- [ ] `yarn e2e:up && yarn e2e:db && yarn test:e2e` → ALL specs pass (Tier 1–4) on chromium (+ webkit for @webkit). Network guard clean.
- [ ] Cold build + e2e rely ONLY on `.env.e2e`.
- [ ] Prod path unchanged when `E2E_TEST` unset (no production code touched in this PR).

## Self-Review
- Spec coverage: not-found (route + ticker) + seo-smoke (robots/manifest/sitemap×2/OG×6). Resilience explicitly deferred with rationale + the seam it needs.
- No production code touched; only e2e specs + this plan.
