# Portfolio Position Visualization (Subsystem B) — Empirical Test Cases

- **Date**: 2026-07-18
- **Branch**: `feat/portfolio-position-viz` (stacked on Subsystem A, PR #691)
- **Scope doc**: `2026-07-18-portfolio-position-CHANGE-SCOPE.md`
- **Design**: `2026-07-18-portfolio-position-viz-design.md`

All Korean strings below are VERIFIED against the actual components
(`src/widgets/portfolio-position/ui/*`). See §"Verified strings" at the end.

## Build & run (PROD-LIKE — required)

The gauge is client-only; a dev server hides the ISR/hydration behavior. Verify against a production build:

```bash
cd /Users/y0ngha/Project/siglens-wt-position
yarn build            # next build
yarn start            # next start, serves on :3000
BASE=http://localhost:3000
```

**Method key:** `[curl]` = server-side assertable (no JS). `[Chrome]` = client-rendered, needs a real browser + a logged-in session. Cases that assert BOTH are marked `[curl + Chrome]`.

**Preconditions vocabulary:**
- **guest** — no session cookie.
- **member-with-holding** — logged in; portfolio has a holding for the symbol under test (e.g. AAPL) with a finite `averagePrice > 0`.
- **member-without-holding** — logged in; portfolio has NO holding for the symbol under test.

Seed a holding via the Subsystem A UI (portfolio add) or the account portfolio page before running the `[Chrome]` positive cases.

---

## Test cases

### TC-1 — member-with-holding sees the gauge with correct readouts `[Chrome]`
**Precondition:** member-with-holding (AAPL, e.g. avg $300).
**Steps:**
1. Log in; ensure an AAPL holding exists.
2. Navigate to `$BASE/AAPL`, wait for hydration + the chart tab analysis panel.
3. Inspect the "내 위치" section next to the technical-facts summary.

**Expected:**
- A `<section>` with heading **`내 위치`** is present.
- An `<svg role="img">` gauge (`[data-testid="position-gauge"]`) renders: 5 bands (`[data-testid="position-band"]` × 5), high/low tick labels, `[data-testid="avg-marker"]` (◆) and `[data-testid="current-marker"]` (▶).
- The `<dl>` readouts render with correct, mutually consistent values:
  - `최근 고점` = high, `최근 저점` = low, `현재가` = last close, `내 평단` = avg (all `$…`).
  - `수익률` = `formatSignedPercent((current-avg)/avg*100)` e.g. `+11.0%`, colored `text-ui-success-text` (≥0) / `text-ui-danger-text` (<0).
  - `최근 고점 대비` = `(avg-high)/high*100` e.g. `-16.0%`; `최근 저점 대비` = `(avg-low)/low*100` e.g. `+30.0%`.
  - `최근 범위의 위치` = `{avgPos*100 rounded}% 지점` e.g. `54% 지점`.
- Gauge `aria-label` matches `"AAPL 내 위치: 평단 $300, 현재가 $333, 수익률 +11.0%, 최근 범위의 54% 지점"` (return% precision `toFixed(1)`, range% `toFixed(0)`).
- The `수익률` value appears exactly ONCE as a readout (single source of truth; the gauge does not duplicate a return caption).

### TC-2 — member-without-holding: no gauge `[Chrome]`
**Precondition:** member-without-holding (no AAPL holding).
**Steps:** log in; navigate to `$BASE/AAPL`; wait for hydration; inspect the analysis panel.
**Expected:** NO `내 위치` section anywhere (`page.locator('text=내 위치')` count 0; `[data-testid="position-gauge"]` count 0). `TechnicalFactsSummary` still renders normally. `PositionSection` mounts (member present) but `useSymbolHolding` returns no holding → renders `null`.

### TC-3 — guest: no gauge + absent from SSR HTML `[curl + Chrome]`
**Precondition:** guest (no session).
**Steps (curl):**
```bash
curl -s $BASE/AAPL -o body.html -D headers.txt
grep -F '내 위치' body.html        # expect: no output (exit 1)
grep -F '최근 고점' body.html       # expect: no output
grep -F 'position-gauge' body.html # expect: no output
```
**Steps (Chrome):** open `$BASE/AAPL` in a fresh (logged-out) profile; wait for hydration; inspect the analysis panel.
**Expected:**
- `[curl]` none of `내 위치` / `최근 고점` / `position-gauge` / the gauge `aria-label` appear in the SSR HTML (client-only widget; guest gate returns before mount).
- `[Chrome]` NO `내 위치` section renders after hydration either; `PositionSectionMounted` returns `null` for a guest (no `useCurrentUser` user) and never mounts the lazy `PositionSection`, so the gauge chunk is never requested and `getPortfolioHoldingsAction` never fires (verify in DevTools Network: no chunk for `PositionSection`, no holdings action call).

### TC-4 — ISR intact + gauge absent from crawlable HTML `[curl]`
**Precondition:** any (curl sends no auth). Prime the route once (first `curl` may MISS/generate).
**Steps:**
```bash
curl -s $BASE/AAPL -o /dev/null            # prime
curl -s -D - $BASE/AAPL -o body.html | grep -i 'x-nextjs-cache'
grep -o '<title>[^<]*</title>' body.html   # metadata/title intact
grep -F '내 위치' body.html                 # expect: no output
grep -F '최근 고점' body.html                # expect: no output
grep -F '최근 범위의' body.html              # expect: no output (aria-label fragment)
```
**Expected:**
- Response `200` with `x-nextjs-cache: HIT` on the primed request (route is still statically ISR-generated, `revalidate = 21600`; the client-only member widget did NOT force `[symbol]` dynamic).
- `<title>` / page metadata unchanged from master (`app/[symbol]/page.tsx` behavior unchanged — the diff touched only `ChartContent.tsx`, a client tree).
- The gauge markup (`내 위치`, `최근 고점`, `최근 범위의`, `position-gauge`, the gauge `aria-label`) is ABSENT from the crawlable SSR HTML for every requester — grep returns nothing.

### TC-5 — out-of-range (avg above recent high → clamp + note) `[Chrome]`
**Precondition:** member-with-holding where `averagePrice > high52w` for the symbol (an avg bought above the recent range; e.g. seed a holding with avg well above the current high).
**Steps:** log in; navigate to `$BASE/AAPL`; inspect the gauge.
**Expected:**
- Gauge still renders (`computePosition` non-null — avg finite & > 0).
- The ◆ 내 평단 marker is CLAMPED to the top of the bar (`avgPos === 1`, `avgClamped === 'above'`).
- The out-of-range note **`최근 고점보다 높은 곳에서 매수`** renders below the SVG.
- `최근 범위의 위치` shows `100% 지점`; `수익률` reflects `(current-avg)/avg*100` (negative when current < avg).
- (Symmetric variant: avg < low52w → marker clamped to bottom, note **`최근 저점보다 낮은 곳에서 매수`**, `0% 지점`.)

### TC-6 — degrade: no bars / degenerate range → gauge hidden `[Chrome]` (`[curl]` for the SSR-absence half)
**Precondition:** member-with-holding, but the symbol has no usable bars / a degenerate range (FMP-degraded or `high52w <= low52w`). Reproduce with a symbol whose bars fail to load, or by forcing an empty/degenerate `facts` range.
**Steps (Chrome):** log in; navigate to the degraded symbol's chart tab; inspect the analysis panel.
**Steps (curl):** `curl -s $BASE/<degraded-symbol> | grep -F '내 위치'` → expect no output (client-only regardless).
**Expected:**
- NO `내 위치` section renders — either the `{facts && …}` guard in `ChartContent` drops the mount, or `computePosition` returns `null` on the degenerate range (`high52w <= low52w`) / non-finite / non-positive inputs.
- No error, no empty card, no console throw — the widget is presentation-only and degrades silently to nothing. `TechnicalFactsSummary` still behaves as before.

---

## Coverage summary

| TC | Precondition | Method | Asserts |
|----|--------------|--------|---------|
| 1 | member-with-holding | Chrome | gauge + readouts (수익률 / 최근 고점 대비 / 범위 위치) + aria-label |
| 2 | member-without-holding | Chrome | no gauge |
| 3 | guest | curl + Chrome | no gauge (client + hydrated); absent from SSR HTML; zero holdings query/bundle |
| 4 | any (unauth curl) | curl | ISR HIT + metadata intact + gauge absent from crawlable HTML |
| 5 | member, avg > high | Chrome | clamp + out-of-range note |
| 6 | member, no/degenerate range | Chrome + curl | degrade-to-null, no error |

6 test cases. Categories: 4 Chrome-only positive/negative client cases (1, 2, 5, plus the Chrome half of 3 & 6), 1 curl-only server case (4), 2 dual-method cases (3, 6).

---

## Verified strings (from `src/widgets/portfolio-position/ui/*`)

Exact, copy-pasteable for grep / assertions:

- Heading (PositionCard): `내 위치`
- Readout labels (PositionCard `<dl>`): `최근 고점` · `최근 저점` · `현재가` · `내 평단` · `최근 고점 대비` · `최근 저점 대비` · `수익률` · `최근 범위의 위치`
- Range-position value format: `{n}% 지점` (n = `rangePositionPct.toFixed(0)`, e.g. `54% 지점`)
- Signed-percent format (수익률 / % 대비): `formatSignedPercent` → `+11.0%` / `-16.0%` (`toFixed(1)`, `+` prefix when ≥ 0)
- Marker labels (in-SVG): `내 평단` (◆) · `현재가` (▶)
- Out-of-range notes (PositionGauge): `최근 고점보다 높은 곳에서 매수` · `최근 저점보다 낮은 곳에서 매수`
- Gauge `aria-label` (PositionGauge `buildAriaLabel`): `{SYMBOL} 내 위치: 평단 {avg}, 현재가 {current}, 수익률 {±}{returnPct.toFixed(1)}%, 최근 범위의 {rangePositionPct.toFixed(0)}% 지점`
  - Example: `AAPL 내 위치: 평단 $300, 현재가 $333, 수익률 +11.0%, 최근 범위의 54% 지점`
- test ids: `position-gauge`, `position-band`, `avg-marker`, `current-marker`

### Corrections applied vs the design-spec copy section (§5)

The design spec's illustrative copy did not match the built components on three points; the test cases use the VERIFIED component strings:

1. **`수익률 +11%` → `+11.0%`.** All percent readouts use `formatSignedPercent` = `toFixed(1)`, so one decimal (`+11.0%`, `-16.0%`, `+30.0%`), not integer.
2. **Range position is a labeled row, not a standalone note.** In `PositionCard` it is label `최근 범위의 위치` + value `54% 지점` (two cells). The composed phrase `최근 범위의 54% 지점` exists ONLY inside the gauge `aria-label`, not as visible card text.
3. **`최근 고점 대비 -16%` is split** into label `최근 고점 대비` + value `-16.0%` (likewise `최근 저점 대비` / `+30.0%`).
