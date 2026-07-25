# EMPIRICAL VALIDATION — SEO pre-warm Phase 1 (backend-only)

- **Date**: 2026-07-25
- **Repo / branch**: `siglens-seo-prewarm` @ `feat/seo-prewarm-backend`
- **Scope under test**: cron-driven "SEO analysis snapshot pre-warm" backend. New table `seo_analysis_snapshots`, `entities/seo-snapshot` slice, server-only prewarm seams, and the Redis-guarded route `PATCH /api/cron/seo-prewarm`.
- **What this validation is scoped to**: the **route contract** (auth fail-closed, lock behavior, 202/204 semantics, method gating) + **no user-facing regression** (robots.txt, sitemap, symbol-page rendering & robots meta unchanged). It is **NOT** scoped to the correctness of the background batch itself (that runs behind `after()` and is Phase-1-irrelevant to the HTTP contract).
- **Method**: prod-like local run — `yarn build` then `yarn start` on a chosen port. Tester runs **curl** and **Chrome**. Do not run in `next dev`.

> ⚠️ **Author's note (do not skip):** This validation is a **no-regression + route-contract** proof, not a feature-behavior proof. Phase 1 adds **no render consumer** for the snapshot table. The single strongest signal for cases C/D is that symbol-page / robots / sitemap output is **byte-identical (or semantically identical) to `master` on the same local env**. Where an absolute assertion (e.g. `index, follow`) could legitimately vary with local data availability, the spec says so and falls back to a master-baseline diff.

---

## 0. Preconditions (tester sets up BEFORE the run)

| # | Precondition | How to satisfy / verify |
|---|---|---|
| P1 | `CRON_SECRET` present in run env | Already in `.env.local` (`grep -c CRON_SECRET .env.local` → ≥1). `yarn start` inherits `.env.local`. The correct-bearer case (B3) reads this exact value. |
| P2 | Redis reachable (for the 202 path) | `.env.local` has `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (Upstash REST — reachable from localhost, no local daemon needed). If these are unset/blocked, the correct-bearer case yields **204** instead of **202** — still a PASS (see B3). |
| P3 | FMP + DB available for full symbol render | `.env.local` has `FMP_API_KEY` + `DATABASE_URL`. When present, `/AAPL` resolves fully → `index, follow`. If absent/rate-limited, `/AAPL` may **degrade** (200 + possibly `noindex`) — this is NOT a Phase-1 regression; case C2 handles it via the master baseline. |
| P4 | DB table `seo_analysis_snapshots` **need NOT exist** | The auth (B1/B2) and lock (B3 → 204) paths **short-circuit before the batch touches the DB**. Even on the 202 path, the batch runs behind `after()`; a missing table/provider makes it log `[seo-prewarm] batch failed: …` in the **server** stdout. That log is **EXPECTED locally and is NOT a failure of this validation** — this validation asserts the HTTP contract + no-regression, not batch success. |
| P5 | Baseline capture (recommended) | Before switching branches, or in a second checkout on `master` with the **same** env, capture `curl -s <host>/robots.txt`, `curl -sI <host>/AAPL`, `curl -s <host>/AAPL | grep -i 'name="robots"'`, and `curl -s <host>/sitemap.xml | head`. Cases C/E compare against these. |

**Host convention below**: `HOST=http://localhost:<PORT>` (choose a free port for `yarn start`, e.g. `PORT=4300 yarn start`). Replace `<host>` accordingly.

---

## A. Build / boot

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **A1** | Prod build succeeds, no dynamic-usage bail | `yarn build > /tmp/seo-build.log 2>&1; echo "EXIT=$?"` | `EXIT=0`. Log contains **no** `DYNAMIC_SERVER_USAGE` and no `Error occurred prerendering`. (Capture exit code directly — never pipe build through `tail`, which masks failures.) |
| **A2** | Cron route is a dynamic route handler | In the build "Route (app)" table: `grep -E 'api/cron/seo-prewarm' /tmp/seo-build.log` | Line present, marked as a Route Handler (`ƒ` / Dynamic — server-rendered on demand). It must **not** be a static (`○`) or SSG (`●`) entry. |
| **A3** | `[symbol]` routes stay SSG | `grep -E '● +/\[symbol\]' /tmp/seo-build.log` (and the sub-tabs `/[symbol]/overall`, `/news`, etc.) | Each `[symbol]` page still shows `●` (SSG / prerendered). Adding the cron route must not flip symbol pages to dynamic. |
| **A4** | Server boots and serves | `PORT=4300 yarn start` then `curl -sI $HOST/` | Process stays up; `/` returns `200`. Keep this server running for all subsequent cases. |

---

## B. Cron auth fail-closed + lock (curl)

Route exports **only** `PATCH` (`src/app/api/cron/seo-prewarm/route.ts`). Auth is timing-safe bearer compare; missing/empty `CRON_SECRET` → 401 (fail-closed); wrong bearer → 401; Redis root lock decides 202 vs 204.

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **B1** | No auth → rejected (fail-closed) | `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH $HOST/api/cron/seo-prewarm` | `401`. Empty body. |
| **B2** | Wrong bearer → rejected | `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH -H 'Authorization: Bearer WRONG_VALUE' $HOST/api/cron/seo-prewarm` | `401`. Empty body. (Timing-safe compare returns false on length mismatch too.) |
| **B3** | Correct bearer → accepted (202) OR lock/redis short-circuit (204) | `S=$(grep -E '^CRON_SECRET=' .env.local \| cut -d= -f2- \| tr -d '"'"'"'"'); curl -s -o /dev/null -w '%{http_code}\n' -X PATCH -H "Authorization: Bearer $S" $HOST/api/cron/seo-prewarm` | **`202`** if Redis reachable **and** lock acquired (first call within the TTL window), **OR** **`204`** if Redis unavailable (fail-closed) **or** the lock is already held. **BOTH are PASS** — both prove auth passed and the fail-closed/lock seam engaged. A `401`, `403`, `500`, or `200` here is a **FAIL**. |
| **B3-note** | How to tell 202 vs 204 apart | 202 = lock acquired, batch enqueued in `after()` (server stdout will then show `[seo-prewarm] batch done:` or `[seo-prewarm] batch failed:`). 204 = no batch enqueued (server stdout shows `[seo-prewarm] redis unavailable — cannot run` if Redis was the cause; silent if lock was simply held). Neither log outcome changes the PASS verdict. | Documented, not asserted. |
| **B4** | Lock re-entrancy → second concurrent call is 204 | Immediately re-run the B3 command a second time (within the 900s lock TTL, before the first batch releases): run B3 twice back-to-back. | The **second** call returns `204` (lock held by the first). If the first was already `204` (Redis down), both are `204` — still consistent with fail-closed. Observing at least one `204` on the repeat confirms the lock guard. |
| **B5** | Wrong method → not allowed | `curl -s -o /dev/null -w '%{http_code}\n' -X GET $HOST/api/cron/seo-prewarm` | `405` (Method Not Allowed — Next App Router returns 405 with an `Allow: PATCH` header for a handler that exports only PATCH). Verify header: `curl -sI -X GET $HOST/api/cron/seo-prewarm \| grep -i '^allow:'` → `Allow: PATCH`. A `200`/HTML here is a FAIL. |

---

## C. No SEO regression (curl)

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **C1** | `robots.txt` unchanged — still crawlable, no new symbol-page block | `curl -s $HOST/robots.txt` | Body contains `User-Agent: *`, `Allow: /`, and a `Sitemap: …/sitemap.xml` line. The only `Disallow` under the `*` group is `Disallow: /api/`. **No** `Disallow: /` under `*`, and **no** disallow of symbol paths (assert: `curl -s $HOST/robots.txt \| grep -E 'Disallow:' \| grep -viE '^Disallow: /api/'` — the only lines that survive should be the parasite-bot group's `Disallow: /`, NOT any symbol-path or root disallow in the `*`/AI groups). Diff against P5 baseline → identical. |
| **C2** | Symbol pages still 200 + indexable (or degraded-but-unchanged) | `curl -sI $HOST/AAPL` ; `curl -sI $HOST/MSFT` ; then `curl -s $HOST/AAPL \| grep -io '<meta name="robots"[^>]*>'` | Each `-sI` → **`200`** (no `500`). robots meta tag **present**. **If FMP/DB resolved the asset (P3 satisfied):** content is `index, follow` (NOT `noindex`). **If the asset degraded locally** (FMP absent/rate-limited): the page still returns `200` with a robots meta present, but the value **may legitimately be `noindex`** — in that case the PASS criterion is **equality with the P5 `master` baseline for the same symbol on the same env**, not the literal `index, follow`. What must hold unconditionally: **200, robots meta present, no 500, and identical to master.** |
| **C3** | Analysis content may be empty locally (not a regression) | Visual/curl inspection of `/AAPL` body | Analysis blocks may be empty/placeholder/degraded when the worker/AI or FMP data is unavailable locally. This is **allowed** and is **not** a Phase-1 change — Phase 1 added no render consumer. Only structural regressions (500, missing header/footer, error boundary) count as failures. |

---

## D. Chrome visual no-regression

Load in Chrome against the same running server. Prefer `/AAPL`; if symbol pages need prod data that is absent locally, also check `/` as a stable control.

| ID | Validates | Action | Expected result |
|---|---|---|---|
| **D1** | Page renders without crash / error boundary | Open `$HOST/AAPL` in Chrome | Page paints normally. **No** global-error / error-boundary screen, no Next.js error overlay, no blank white crash. Header and footer are present. |
| **D2** | No console error referencing the new code | Chrome DevTools → Console | No `Error`/`Uncaught` referencing `seo-prewarm`, `seo-snapshot`, `runPrewarmBatch`, `acquirePrewarmLock`, or `seo_analysis_snapshots`. (Pre-existing, unrelated warnings that also appear on `master` are acceptable — compare against P5 if unsure.) |
| **D3** | Network: no unexpected cron call from the page | DevTools → Network, reload `/AAPL` | No request to `/api/cron/seo-prewarm` is issued by the page (the cron route is server/EventBridge-only; it must never be fetched by client rendering). |
| **D4** | Control page sanity | Open `$HOST/` in Chrome | Home renders normally, header/footer present, no console error referencing the new cron/seo-snapshot code. |

---

## E. Cron route is non-indexable / non-discoverable

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **E1** | Route is API (no HTML), auth-gated | `curl -s $HOST/api/cron/seo-prewarm -X PATCH -o /dev/null -w '%{http_code} %{content_type}\n'` (no auth) | `401` and **no** HTML body/content-type (empty body). It never serves a crawlable HTML document. |
| **E2** | Not in sitemap | `curl -s $HOST/sitemap.xml \| grep -c 'seo-prewarm'` (note: `/sitemap.xml` rewrites to `/api/sitemap`) | `0`. Also `curl -s $HOST/sitemap.xml \| grep -c '/api/'` → `0` (no API routes are ever listed). |
| **E3** | robots.txt covers it | `curl -s $HOST/robots.txt \| grep -E 'Disallow: /api/'` | Present — `/api/` (which includes `/api/cron/seo-prewarm`) is disallowed for the `*` group and the AI-crawler group. Confirms the route is not offered for crawling. |
| **E4** | Not linked from rendered pages | In Chrome (D1), Ctrl/Cmd-F page source or check DevTools Elements for `seo-prewarm` | No anchor/link to `/api/cron/seo-prewarm` anywhere in rendered HTML. |

---

## Pass / fail summary

**This validation PASSES when:**
- A1–A4 all hold (build 0, cron route dynamic, `[symbol]` still SSG, server serves).
- B1=401, B2=401, B3 ∈ {202, 204}, B4 shows the lock guard (a `204` on the concurrent repeat), B5=405.
- C1 robots.txt identical to master (no new root/symbol disallow), C2 symbol pages 200 + robots meta present + identical to master baseline (literal `index, follow` when asset resolves), C3 degraded content tolerated.
- D1–D4 render clean with no console/network reference to the new code.
- E1–E4 confirm the cron route is non-HTML, auth-gated, not in sitemap, not linked.

**Explicit FAILs:** build exit ≠ 0 or `DYNAMIC_SERVER_USAGE`; any `[symbol]` route flips off SSG; B3 returns 401/403/500/200; B5 returns 200/HTML; any symbol page returns 500; robots.txt gains a root `Disallow: /` under `*` or any symbol-path disallow; the cron path appears in `sitemap.xml`; an error boundary or a console error referencing the new cron/seo-snapshot code appears in Chrome.

**Explicitly NOT a failure (expected locally):** `[seo-prewarm] batch failed:` / `batch done:` in server stdout; empty/placeholder analysis content on `/AAPL`; a `204` on the correct-bearer call when Redis is unreachable; a degraded `noindex` on a symbol page **that also degrades identically on `master`**.
