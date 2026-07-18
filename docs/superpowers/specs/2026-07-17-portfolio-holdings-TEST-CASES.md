# Portfolio Holdings Foundation — Empirical Test Cases

- **Date**: 2026-07-17
- **Branch**: `feat/portfolio-holdings-foundation`
- **Companion**: `2026-07-17-portfolio-holdings-CHANGE-SCOPE.md`
- **Target**: a **production-like build** served locally (`next start`), NOT `next dev`.

Executable by someone who did **not** build the feature. Every case gives auth state, exact steps, expected result, and — where applicable — both a **curl** check and a **Chrome** check.

---

## 0. Setup (run once before any case)

```bash
cd /Users/y0ngha/Project/siglens-wt-portfolio
# 1. Apply the new migration to the target DB (MANUAL release step — required).
yarn db:migrate                       # applies drizzle/0026_wandering_typhoid_mary.sql
# 2. Prod-like build + serve.
yarn build
yarn start                            # serves on http://localhost:3000
```

- **Base URL** below: `http://localhost:3000`.
- **Seeded ticker**: `AAPL` is the one symbol whose asset info resolves from the local DB without FMP (company name `Apple Inc.`). Use it for happy-path member cases.
- **Auth states used**:
  - **guest** — no cookies (`curl` with no cookie jar; Chrome incognito / logged-out).
  - **member** — a logged-in account. Capture its cookie jar for curl:
    `curl -c cookies.txt -b cookies.txt ...` after logging in via the UI, or reuse the e2e seeded session. A **free-tier** member must be used for TC-03b.
  - **fresh signup** — a brand-new account created during the case.
- **Notation**: "curl-verifiable" = assertable from HTTP response/HTML. "Chrome-only" = requires client-side hydration/interaction (the feature is heavily client-rendered, so most positive UI states are Chrome-only).

### Verified UI strings (checked against the actual components — use these verbatim)

| Where | String |
|---|---|
| Chip — unset | `평단 설정` |
| Chip — set (e.g. avg 150, qty 10) | `평단 $150 · 10주` (price first, qty second; trailing zeros trimmed) |
| Account row readout (e.g. qty 10, avg 150) | `10주 · 평단 $150` (qty first — note the order differs from the chip) |
| Account section heading | `보유종목` |
| Account section subtitle | `등록하면 내 평단 기준으로 분석을 받을 수 있어요.` |
| Add sub-heading | `종목 추가` |
| Form field labels | `종목`, `수량`, `평단` |
| Add button / Edit button | `추가` / `저장` (busy: `저장 중…`) |
| Empty state | `아직 등록한 보유종목이 없어요. 첫 종목을 추가해 보세요.` (substring `아직 등록한 보유종목이 없어요` is a safe match) |
| Read-error state | `보유종목을 일시적으로 불러오지 못했어요.` + button `다시 시도` |
| Loading skeleton (sr-only) | `보유종목을 불러오는 중이에요` |
| Delete flow | `삭제` → `삭제할까요?` → `삭제 확정` (busy: `삭제 중…`) / `취소` |
| Row aria-labels | `AAPL 보유종목 수정`, `AAPL 보유종목 삭제` |
| Save success (account) | `'AAPL' 보유종목을 저장했어요` |
| Delete success (account) | `'AAPL' 보유종목을 삭제했어요` |
| Popover title | `AAPL 평단 설정` (role `dialog`) |
| Popover buttons | `저장` (busy `저장 중…`) / `취소` |
| Invalid-symbol error | `올바른 종목 코드를 입력해 주세요.` |
| Invalid-quantity error | `0보다 큰 수량을 입력해 주세요 (소수점 8자리까지).` |
| Invalid-price error | `0보다 큰 평균 단가를 입력해 주세요 (소수점 8자리까지).` |
| symbol-not-found error | `존재하지 않는 종목입니다.` |
| unauthenticated (write) | `로그인이 필요합니다.` |
| storage failure (save/delete) | `저장에 실패했어요…` / `삭제에 실패했어요. 잠시 후 다시 시도해 주세요.` |
| Onboarding badge | `가입을 환영해요` |
| Onboarding h1 | `보유종목을 등록해 보세요` |
| Onboarding subtitle | `지금 등록하면 내 평단을 기준으로 분석을 받을 수 있어요. 나중에 계정 설정에서도 추가할 수 있어요.` |
| Onboarding primary / skip | `시작하기` / `나중에 하기` |
| Onboarding metadata title | `보유종목 등록` |

> **String corrections applied** (the design spec §7 was outdated): the chip does **not** use the `내 평단 …` prefix or a trailing `· 수정`, and it does **not** pad to two decimals — the real component renders `평단 설정` (unset) and `평단 $150 · 10주` (set, zeros trimmed). The task-prompt strings `평단 $150 · 10주`, `평단 설정`, and `올바른 종목 코드를 입력해 주세요.` are correct as given; the empty-state string is longer than the quoted fragment (full text above).

---

## 1. Account holdings CRUD (member)

### TC-01a — Add a holding
- **Precondition**: logged-in member; on `/account`; no AAPL holding (delete it first if present).
- **Steps (Chrome)**: In the "보유종목" section's "종목 추가" form: type `AAPL` in the 종목 field and press Enter (or click the autocomplete option) → the field collapses to a read-only `AAPL` chip. Fill 수량 `10`, 평단 `150`. Click `추가`.
- **Expected**: A new row appears reading `AAPL` · `Apple Inc.` · `10주 · 평단 $150`; status line shows `'AAPL' 보유종목을 저장했어요`; the add form clears.
- **Chrome-only** (write + client re-render). Curl cannot exercise the add.

### TC-01b — Edit qty/price persists across reload
- **Precondition**: TC-01a done (AAPL holding exists); member on `/account`.
- **Steps (Chrome)**: Click `AAPL 보유종목 수정` → the row swaps to an inline edit form (종목 read-only). Change 수량 `20`, 평단 `200`, click `저장`. Then **reload** the page.
- **Expected**: Row reads `20주 · 평단 $200` after save AND still after reload (proves DB persistence, not just cache).
- **Chrome-only.**

### TC-01c — Delete → empty state
- **Precondition**: AAPL holding exists (the only holding); member on `/account`.
- **Steps (Chrome)**: Click `AAPL 보유종목 삭제` → inline `삭제할까요?` with `삭제 확정` / `취소`. Click `삭제 확정`.
- **Expected**: Row disappears; status shows `'AAPL' 보유종목을 삭제했어요`; empty state `아직 등록한 보유종목이 없어요. 첫 종목을 추가해 보세요.` shows.
- **Chrome-only.**

### TC-01d — Validation: bad symbol
- **Precondition**: member on `/account`, add form.
- **Steps (Chrome)**: In 종목, type `aa pl` (embedded space) and press Enter → chip shows `AA PL`. 수량 `1`, 평단 `1`. Click `추가`.
- **Expected**: Inline error `올바른 종목 코드를 입력해 주세요.` under the form; the 종목 field is marked `aria-invalid`; **no row is created** for `AA PL`. (Space is outside the admissible symbol shape — rejected before any existence check or DB write, independent of FMP.)
- **Chrome-only.**

### TC-01e — Validation: zero quantity
- **Precondition**: member on `/account`, add form.
- **Steps (Chrome)**: 종목 `AAPL`, 수량 `0`, 평단 `150`, click `추가`.
- **Expected**: Inline error `0보다 큰 수량을 입력해 주세요 (소수점 8자리까지).`; 수량 field `aria-invalid` + focused; no row created.
- **Chrome-only.**

### TC-01f — Validation: >8-decimal
- **Precondition**: member on `/account`, add form.
- **Steps (Chrome)**: 종목 `AAPL`, 수량 `1.123456789` (9 fractional digits), 평단 `150`, click `추가`.
- **Expected**: Inline error `0보다 큰 수량을 입력해 주세요 (소수점 8자리까지).`; no row created. (Repeat with 평단 `150.123456789` → error `0보다 큰 평균 단가를 입력해 주세요 (소수점 8자리까지).`.)
- **Chrome-only.**

### TC-01g — Read-error state
- **Precondition**: member on `/account`; induce a holdings **read** failure (e.g. temporarily break the DB connection / point `DATABASE_URL` at an unreachable host, or block the `getPortfolioHoldingsAction` round-trip in devtools).
- **Steps (Chrome)**: Load `/account` while the read fails.
- **Expected**: The section shows `보유종목을 일시적으로 불러오지 못했어요.` with a `다시 시도` button (role `alert`), NOT the empty state (a transient blip must not be mistaken for "no holdings"). Clicking `다시 시도` refetches; once the DB is restored the list renders.
- **Chrome-only.**

---

## 2. Symbol-page chip (member)

### TC-02a — Unset chip
- **Precondition**: logged-in member with NO AAPL holding; visit `/AAPL`.
- **Steps (Chrome)**: After hydration, find the header control cluster (near `AI 분석 모델` selector and the reasoning toggle).
- **Expected**: A chip button reading exactly `평단 설정` (the unset state).
- **Chrome-only** (client-rendered; see TC-03a for why curl can't see it).

### TC-02b — Set via popover
- **Precondition**: member on `/AAPL`, chip shows `평단 설정`.
- **Steps (Chrome)**: Click the chip → a `role="dialog"` popover titled `AAPL 평단 설정` opens (focus moves into it). Fill 수량 `10`, 평단 `150`, click `저장`.
- **Expected**: Popover closes; chip now reads exactly `평단 $150 · 10주`.
- **Chrome-only.**

### TC-02c — Account ↔ chip shared source
- **Precondition**: member; AAPL holding set to qty 10 / avg 150 (from TC-02b).
- **Steps (Chrome)**: Navigate to `/account` → the AAPL row reads `10주 · 평단 $150`. Edit it to qty 20 / avg 200, save. Navigate back to `/AAPL`.
- **Expected**: The chip reflects the edit → `평단 $200 · 20주` (both surfaces read the one `['portfolio-holdings']` query; the mutation invalidated it).
- **Chrome-only.**

### TC-02d — Popover is a focus-trapped dialog
- **Precondition**: member on `/AAPL`, chip visible.
- **Steps (Chrome)**: Open the popover. (1) Tab repeatedly → focus cycles within the dialog (수량 → 평단 → 저장 → 취소 → back), never escaping to the page. (2) Press `Esc` → closes. (3) Reopen, click outside the panel → closes.
- **Expected**: All three close/trap behaviors hold; on close, focus is sane (returns toward the trigger).
- **Chrome-only.**

---

## 3. Auth gating (the critical invariant)

### TC-03a — Guest sees NO chip; chip absent from SSR HTML (curl)
- **Precondition**: **guest** (no auth cookie).
- **curl**:
  ```bash
  curl -s -D - http://localhost:3000/AAPL -o body.html
  ```
  - **Status**: `200`.
  - **Headers**: expect `x-nextjs-cache: HIT|STALE|MISS` (symbol pages are ISR).
  - **Body ABSENT substrings**: `평단 설정`, `평단 $`, `PortfolioChip`, and the dialog title fragment `평단 설정`. i.e. `grep -F '평단' body.html` returns **nothing**.
  - Rationale: the chip is client-only (`PortfolioChipMounted` + `next/dynamic ssr:false`), so it is not in server HTML **for anyone**.
- **Chrome (incognito / logged-out)**: load `/AAPL` → the header cluster shows the model selector + reasoning toggle but **no holdings chip** appears, even after full hydration.
- **Expected**: chip markup absent from curl HTML; nothing rendered in Chrome.
- **curl-verifiable (absence) + Chrome (confirm nothing appears).**

### TC-03b — Logged-in member (any tier, incl. free) DOES see the chip
- **Precondition**: logged-in **free-tier** member.
- **curl**: `curl -s -b cookies.txt http://localhost:3000/AAPL` still shows **no chip** in HTML (client-only rendering is auth-independent at the SSR layer) — so **curl alone cannot distinguish member from guest here**. Documented explicitly so the verifier does not treat curl-absence as a failure for members.
- **Chrome (logged in as free tier)**: load `/AAPL` → the chip **does** render (`평단 설정` if unset). Confirms gating is on authenticated *presence*, not tier.
- **Expected**: chip present in Chrome for the member; the tier being `free` does not hide it.
- **Chrome-only** for the positive assertion (the member/guest difference is only observable after hydration).

---

## 4. Onboarding

### TC-04a — Fresh signup, no return path → `/onboarding`
- **Precondition**: **fresh signup** started from the plain signup page (no `?next=`), consenting to terms.
- **Steps (Chrome)**: Complete signup at `/signup`. On success (auto-login) the app redirects.
- **Expected**: Lands on `/onboarding`, showing badge `가입을 환영해요`, h1 `보유종목을 등록해 보세요`, the reused holdings add/list UI, a primary `시작하기`, and a de-emphasized (underlined text-link, no fill) skip `나중에 하기`.
- **Chrome-only** (requires real signup + session).

### TC-04b — Both buttons go home
- **Precondition**: on `/onboarding` as the fresh member (TC-04a).
- **Steps (Chrome)**: (1) Click `시작하기` → lands on `/`. (2) Repeat the flow, instead click `나중에 하기` → lands on `/`.
- **Expected**: both route to home `/`. Optionally add a holding first via the embedded section, then `시작하기` → the holding persists (visible later on `/account`).
- **Chrome-only.**

### TC-04c — Signup FROM a specific page preserves `next`
- **Precondition**: guest; navigate to signup carrying a return path, e.g. `/signup?next=/AAPL` (as produced by a "sign up to continue" link on `/AAPL`).
- **Steps (Chrome)**: Complete a fresh signup.
- **Expected**: Lands on **`/AAPL`**, NOT `/onboarding` (`resolvePostSignupDestination` returns `next` unchanged when `next !== '/'`).
- **Chrome-only.**

### TC-04d — Guest hitting `/onboarding` directly is redirected to login
- **Precondition**: **guest**.
- **curl**:
  ```bash
  curl -s -D - http://localhost:3000/onboarding -o onb.html
  ```
  - The RSC guard (`getCurrentUser()` → `redirect('/login?next=/onboarding')`) fires for guests. Expect either a `307` `Location: /login?next=/onboarding`, or (under PPR streaming) a `200` static shell that resolves to the login route — **either way the guard prevents the guest from using onboarding**. The stable assertion is the **noindex meta** in the shell head (see TC-05a), which is present regardless.
- **Chrome (logged-out)**: navigate to `/onboarding` → redirected to `/login?next=/onboarding`.
- **Expected**: guest cannot reach the onboarding content; ends on login.
- **curl (redirect/guard) + Chrome (confirm redirect).**

---

## 5. SEO

### TC-05a — `/onboarding` is noindex
- **curl**:
  ```bash
  curl -s http://localhost:3000/onboarding | grep -i 'name="robots"'
  ```
  - **Expected substring PRESENT** in `<head>`: `<meta name="robots" content="noindex, nofollow"/>` (Next serializes `robots: { index:false, follow:false }`). Title `보유종목 등록` also present.
  - Note: Next's Metadata `robots` emits the **meta tag**, not necessarily an `x-robots-tag` HTTP header — assert on the meta tag. (If an `x-robots-tag: noindex` header is also present via edge config, that is a bonus, not the ground truth here.)
- **Chrome**: DevTools → Elements → `<head>` contains the robots meta.
- **curl-verifiable.**

### TC-05b — `/[symbol]` remains ISR-cached; SSR HTML unchanged by the chip
- **curl**:
  ```bash
  curl -s -D - http://localhost:3000/AAPL -o aapl.html
  ```
  - **Headers**: `x-nextjs-cache: HIT|STALE|MISS` present (ISR still active). Status `200`.
  - **Body**: crawlable content intact — the page `<title>`/description metadata and the breadcrumb `(AAPL)` are present; the holdings chip markup (`평단 …`) is **ABSENT** (same grep as TC-03a). This proves the chip did not leak into the cached SSR HTML and did not force the route dynamic.
- **Expected**: ISR header present; no chip markup; metadata intact.
- **curl-verifiable.**

### TC-05c — `/account` noindex unchanged
- **curl**:
  ```bash
  curl -s http://localhost:3000/account | grep -i 'name="robots"'
  ```
  - **Expected**: `<meta name="robots" content="noindex, nofollow"/>` still present (adding the holdings section did not change account SEO). Title `계정 설정` present.
- **curl-verifiable.**

---

## 6. Resilience

### TC-06a — Degrade-tolerant save (FMP/asset-info unavailable)
- **Precondition**: member; force the symbol existence check to **throw** — either run with no `FMP_API_KEY` configured (so `getAssetInfo` throws for a non-DB-seeded symbol) OR temporarily make `getAssetInfo` unreachable. Use a **shape-valid but never-seeded** symbol, e.g. `MSFT` (assuming it is not DB-seeded in this env).
- **Steps (Chrome)**: On `/account`, add 종목 `MSFT`, 수량 `5`, 평단 `100`, click `추가`.
- **Expected**: The save **succeeds** — a `MSFT` row appears with `5주 · 평단 $100` and **no company name** (companyName/fmpSymbol persisted as null). Contrast: a symbol that `getAssetInfo` resolves to `null` (genuinely nonexistent) would be rejected with `존재하지 않는 종목입니다.`; a **throw** must NOT block the save.
- **Verify (DB)**:
  ```sql
  SELECT symbol, company_name, fmp_symbol, quantity, average_price
  FROM portfolio_holdings WHERE symbol = 'MSFT';
  ```
  Expect a row with `company_name = NULL`.
- **Chrome + DB.** (Note the server log line `[savePortfolioHoldingAction] symbol verification unavailable, proceeding`.)

### TC-06b — COALESCE metadata preservation on degraded edit
- **Precondition**: member; a holding already has a stored company name (e.g. add `AAPL` while asset-info is healthy → `company_name = 'Apple Inc.'`). Then induce the degraded state (existence check throws, as in TC-06a).
- **Steps (Chrome)**: While degraded, **edit** the existing AAPL holding (change 수량 only, e.g. to `15`) and save.
- **Expected**: The edit succeeds; the stored `company_name` is **still `Apple Inc.`** — the upsert must NOT overwrite it with the now-`null` computed value.
- **Verify (DB)**:
  ```sql
  SELECT symbol, company_name, quantity FROM portfolio_holdings WHERE symbol = 'AAPL';
  ```
  Expect `company_name = 'Apple Inc.'`, `quantity = 15.00000000`. In Chrome, the `Apple Inc.` label still shows on the row after the degraded edit.
- **DB (authoritative) + Chrome (label still present).** This is the observable proof of the COALESCE-preserves-metadata invariant.

---

## 7. Regression sanity

### TC-07a — Site-header ticker search still navigates
- **Precondition**: any state (guest is fine); on `/` (home) or any page with the site header search.
- **Steps (Chrome)**: In the header ticker search, type `AAPL`, press Enter (or click the option).
- **Expected**: Navigates to `/AAPL` (the `navigateOnSelect` default is still `true`; the new optional props did not change existing consumers).
- **Chrome-only.**

### TC-07b — Signup / login flows still work
- **Precondition**: guest.
- **Steps (Chrome)**: (1) Log in with an existing account at `/login` → lands correctly (respecting any `next`). (2) Log out → session cleared. (3) A fresh signup with no `next` → `/onboarding` (ties to TC-04a); with `?next=/AAPL` → `/AAPL` (TC-04c).
- **Expected**: auth flows unbroken; the only behavioral change is the post-signup destination going through `resolvePostSignupDestination`.
- **Chrome-only.**

---

## Coverage map

| Category | Cases | curl | Chrome |
|---|---|---|---|
| 1. Account CRUD | TC-01a…g (7) | — | ✓ |
| 2. Symbol chip | TC-02a…d (4) | — | ✓ |
| 3. Auth gating | TC-03a, TC-03b (2) | ✓ (absence) | ✓ |
| 4. Onboarding | TC-04a…d (4) | ✓ (04d) | ✓ |
| 5. SEO | TC-05a…c (3) | ✓ | ✓ (05a) |
| 6. Resilience | TC-06a, TC-06b (2) | DB/logs | ✓ |
| 7. Regression | TC-07a, TC-07b (2) | — | ✓ |

**Total: 24 cases.** curl is authoritative for SEO (noindex meta, ISR header) and chip **absence** in SSR HTML; all positive UI states are Chrome-only because the feature renders client-side after hydration; resilience metadata is verified via DB/logs.
