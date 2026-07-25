# EMPIRICAL VALIDATION — SEO recovery (pre-warm Phase 1 + SSR rendering Phase 2, combined)

- **Date**: 2026-07-25
- **Repo / branch**: `/Users/y0ngha/Project/siglens-seo-render` @ `feat/seo-prewarm-rendering` (Phase 2 rebased on Phase 1)
- **Design spec**: `docs/superpowers/specs/2026-07-24-seo-recovery-bot-ssr-prewarm-design.md`
- **Prior validation (do not repeat)**: `docs/superpowers/specs/2026-07-25-seo-prewarm-phase1-empirical-validation.md` — the cron route contract was already proven there; §J below is a 4-line regression re-check only.
- **Method**: prod-like local run. `yarn build` + `yarn start` (NEVER `next dev`), backed by the repo's **local docker e2e Postgres/Redis**. Tester drives **curl** + **Chrome**.

---

## What this validation must actually prove

siglens.io's Google impressions collapsed to ~0 because ~60k programmatic symbol pages served **thin content to crawlers**:

- `/AAPL` shipped **968 KB of HTML** containing only **~677 characters of visible text**;
- `/AAPL/overall` showed a "not cached yet" placeholder instead of analysis;
- ~90 % of the visible text was **identical boilerplate** across every symbol.

The fix under test has five moving parts. This document proves each one **empirically**, not by reading code:

| # | Claim | Proven by |
|---|---|---|
| 1 | A nightly cron pre-generates per-symbol AI analysis reproducing the anonymous-free visitor's exact cache key and stores it in `seo_analysis_snapshots`. | §J (route contract only — the batch itself cannot run locally, see §0.6) |
| 2 | The render layer surfaces that snapshot as **persistent server-rendered prose** on all 7 symbol tabs. | **§C** (raw HTML) + **§D** (hydrated DOM) |
| 3 | A server-computed fear-greed factor narrative is SSR'd. | §C8 |
| 4 | Per-tab `<meta name="description">` is derived from snapshot content. | §F |
| 5 | OG/twitter images are blocked for Googlebot only; degraded-but-snapshotted pages stay indexable via a **tab-scoped + renderability-gated** `hasSnapshot`. | §G, §H |

> ⚠️ **Author's note (do not skip).** §C and §D are the two load-bearing cases. §C proves the prose exists in the bytes a JS-less crawler reads. §D proves it **survives hydration** — a prior audit found the prose mounted inside a `Suspense` *fallback*, which React **destroys** when the boundary resolves, making it invisible to Googlebot's renderer even though it was in the static HTML. That was fixed (prose is now a persistent server sibling). If §D regresses, the whole effort is worthless regardless of how green §C looks. Everything else is supporting evidence.

---

## 0. Preconditions

### 0.1 🛑 DO NOT SEED THE NEON DATABASE

> **`.env.local` in this worktree (and in the sibling worktrees) points `DATABASE_URL` at a shared Neon cloud database (`ep-sweet-poetry-….neon.tech/neondb`).**
>
> **You must NEVER run any `INSERT` / `UPDATE` / `DELETE` against it.** It may hold production data. Empirical validation must never mutate a database we do not positively own.
>
> Every command in §0.4 and §0.5 targets the **local docker Postgres on `localhost:5433`** by going *through the container* (`docker compose … exec -T postgres psql …`). That form cannot reach Neon even if an env var is wrong — the `psql` process runs inside the container and connects over its loopback. **Do not "simplify" any seeding command into a host-side `psql "$DATABASE_URL"`.**
>
> Before you start, verify the split explicitly:
> ```sh
> cd /Users/y0ngha/Project/siglens-seo-render
> grep -E '^DATABASE_URL=' .env.local   # expect: neon.tech  → NEVER write here
> grep -E '^DATABASE_URL=' .env.e2e     # expect: postgres://siglens:siglens@localhost:5433/siglens_e2e → the ONLY write target
> ```

### 0.2 Precondition table

| # | Precondition | How to satisfy / verify |
|---|---|---|
| **P1** | Docker running | `docker info >/dev/null && echo OK`. Required for the e2e Postgres + Redis(SRH). |
| **P2** | No `yarn e2e` run in flight | `yarn e2e` installs an `EXIT` trap that runs `yarn e2e:down -v` and would delete your seeded rows mid-validation. Also do not let Playwright's `webServer` grab port 4300. `lsof -i :4300` → empty before you start. |
| **P3** | Local backend up | `docker compose -f docker-compose.e2e.yml up -d` → `postgres` on `localhost:5433` (`siglens`/`siglens`/`siglens_e2e`), `redis` on 6380, `srh` (Upstash-compatible REST) on 8079. Wait for health: `docker compose -f docker-compose.e2e.yml ps` shows `healthy` for postgres + redis. |
| **P4** | Schema applied (incl. migration `0027`) | `run_with_e2e_env yarn e2e:db` (helper defined in §0.3). This runs the Playwright global-setup = drizzle migrate + minimal seed. Verify the table exists: see §0.4 step 0. Also seeds **`asset_translations`: `AAPL` only** (`{symbol:'AAPL', name:'Apple Inc.', koreanName:'애플', fmpSymbol:'AAPL'}`) plus the `EMPTYX` sentinel. |
| **P5** | `E2E_TEST=1` must be set **at build time AND at runtime** | Non-negotiable, and the single most common way to waste an afternoon here: `src/shared/db/client.ts` picks the **local postgres-js adapter only when `isE2E()`**; without it the app uses the **Neon HTTP driver**, which cannot talk to `localhost:5433` — every DB read (asset info, snapshots) fails, everything silently degrades, and every case below produces a false negative. The `require('./Fake*')` provider branches likewise must be bundled at build time. `run_with_e2e_env` (§0.3) handles both. |
| **P6** | No FMP key — **this is intentional** | `run_with_e2e_env` shadows every `.env.local` key to empty. Under `E2E_TEST=1` the FMP-backed providers are replaced by deterministic fakes (`FakeFundamentalDataProvider`, `FakeCongressTradesProvider`, `FakeFinancialStatementsProvider`, `FakeOptionsDataProvider`, `FakeMarketProvider`). Symbols **not** in `asset_translations` still fall through to the real FMP path → throw → `getAssetInfoResilient` returns `{assetInfo:{symbol,name:ticker}, degraded:true}` (a 200, never a 500). §H depends on exactly this behavior. |
| **P7** | Test symbols | `AAPL` — in `POPULAR_TICKERS` **and** `POPULAR_OPTIONS_TICKERS` (so all 7 tabs are applicable), and the only symbol seeded into `asset_translations` (→ non-degraded). Verify: `grep -c "'AAPL'" src/entities/sitemap-entry/config/popular-options-tickers.ts` → ≥1, and `grep -n "symbol: 'AAPL'" src/shared/config/popular-tickers.ts` → present. `MSFT` / `NVDA` — whitelisted but **not** in `asset_translations` → degraded (used by §H). `ZZZZ` — well-formed but unapproved longtail. |
| **P8** | Python 3 available | `python3 -c 'print(1)'` → `1`. Used by the text-measuring and comment-stripping helpers. |

### 0.3 Shell helpers — paste once per terminal session

These reproduce `e2e/run-e2e.sh`'s env-shadowing verbatim (do **not** invent a different mechanism). `next_env_shadow_args` emits `VAR=` for every key found in `.env.production.local` / `.env.local` / `.env.production` / `.env`; because Next never overrides an already-present `process.env` key, this **neutralizes `.env.local` (including its Neon `DATABASE_URL`)**, and `dotenv -e .env.e2e -o` then supplies the local docker values.

```sh
cd /Users/y0ngha/Project/siglens-seo-render

HOST=http://localhost:4300
COMPOSE="docker compose -f docker-compose.e2e.yml"
PSQL="$COMPOSE exec -T postgres psql -v ON_ERROR_STOP=1 -U siglens -d siglens_e2e"

next_env_shadow_args() {
    for env_file in .env.production.local .env.local .env.production .env; do
        [ -f "$env_file" ] || continue
        sed -n \
            -e 's/^[[:space:]]*export[[:space:]][[:space:]]*//' \
            -e 's/^[[:space:]]*\([A-Za-z_][A-Za-z0-9_]*\)[[:space:]]*=.*/\1=/p' \
            "$env_file"
    done | sort -u
}

run_with_e2e_env() {
    env -i \
        HOME="${HOME:-}" PATH="$PATH" SHELL="${SHELL:-/bin/sh}" \
        TMPDIR="${TMPDIR:-/tmp}" USER="${USER:-}" \
        $(next_env_shadow_args) \
        node_modules/.bin/dotenv -e .env.e2e -o -- "$@"
}

# Strip React SSR comment markers (<!--…-->) — React splits text nodes around
# interpolated values, so raw-HTML greps spuriously miss otherwise-contiguous
# sentences. Mirrors e2e/support/ssrText.ts normalizeReactSsrText().
nrm() { python3 -c "import sys,re; sys.stdout.write(re.sub(r'(?s)<!--.*?-->','',sys.stdin.read()))"; }
```

Sanity check the helper before relying on it:

```sh
run_with_e2e_env sh -c 'echo "DB=$DATABASE_URL E2E=$E2E_TEST FMP=[$FMP_API_KEY]"'
# expect: DB=postgres://siglens:siglens@localhost:5433/siglens_e2e E2E=1 FMP=[]
```

If `DB=` shows a `neon.tech` host, **stop** — the shadowing failed and nothing below is safe to run.

### 0.4 Visible-text measurement tool

Write once, reuse for every §C measurement (this is the same stripping approach as the original impressions-crash diagnosis that produced the 677-char figure):

```sh
mkdir -p /tmp/seoqa && cat > /tmp/seoqa/vtext.py <<'PY'
import html as H, re, sys
h = open(sys.argv[1], encoding='utf-8', errors='replace').read()
h = re.sub(r'(?is)<(script|style|svg|noscript|template)[^>]*>.*?</\1>', ' ', h)
h = re.sub(r'(?is)<head[^>]*>.*?</head>', ' ', h)
h = re.sub(r'(?s)<!--.*?-->', ' ', h)
h = re.sub(r'<[^>]+>', ' ', h)
h = H.unescape(h)
h = re.sub(r'\s+', ' ', h).strip()
sys.stdout.write(f"{len(h)}\n")
if len(sys.argv) > 2 and sys.argv[2] == '--dump':
    sys.stdout.write(h + "\n")
PY
```

Usage: `curl -s "$HOST/AAPL" -o /tmp/seoqa/aapl.html && python3 /tmp/seoqa/vtext.py /tmp/seoqa/aapl.html`
(add `--dump` to eyeball the extracted text).

> **Caveat that keeps this honest:** the 677-char figure came from *production* `/AAPL`. A local run has fake/absent market data, so the local unseeded number will **not** equal 677. The primary assertion in §C is therefore the **delta between the same local URL unseeded vs. seeded** (measured in Phase 1 and Phase 2 of §0.6), with the absolute numbers recorded alongside as context.

### 0.5 Seeding (local docker Postgres only) and teardown

**Step 0 — confirm the table exists on the local DB** (migration `0027`):

```sh
$PSQL -c '\d seo_analysis_snapshots'
```
Expect the columns `id, symbol, tab, content(jsonb), model, generated_at, updated_at` and the unique index `seo_analysis_snapshots_symbol_tab_uq`. If it errors with "did not find any relation", re-run `run_with_e2e_env yarn e2e:db`.

**Step 1 — seed.** Content shapes below were read off `src/views/symbol/snapshot/renderers/*SnapshotProse.tsx` (each renderer's `narrow*Content`) and match what `src/app/api/cron/seo-prewarm/harvest.ts` actually stores: `repo.upsert({ content: result.result, model: DEEPSEEK_V4_FLASH_MODEL, generatedAt: new Date() })` — i.e. the **bare core response object**, no wrapper. `model` = `deepseek-v4-flash`. Dollar-quoting (`$j$…$j$`) avoids escaping the JSON's own quotes.

Each primary prose field is prefixed with a unique ASCII marker (`QA-<TAB>-7f3a`) so greps are unambiguous regardless of shell/locale encoding. The marker sits at the **start** of the field used for the meta description so it survives the 120-code-point clamp (§F).

```sh
$PSQL <<'SQL'
INSERT INTO seo_analysis_snapshots (symbol, tab, content, model, generated_at, updated_at) VALUES

('AAPL','technical', $j${
  "summary": "[QA-TECHNICAL-7f3a] AAPL은 20일 이동평균선을 회복한 뒤 거래량을 동반한 상승 흐름을 이어가고 있습니다.\nRSI는 61선에서 과열 구간에 진입하지 않은 채 완만한 우상향을 유지하고 있어 추가 상승 여력이 남아 있는 것으로 판단됩니다. MACD는 시그널선을 상향 돌파한 이후 히스토그램이 3거래일 연속 확대되며 단기 모멘텀이 강화되는 모습입니다.\n다만 직전 고점 부근에 매물대가 두껍게 형성되어 있어 돌파 시도 과정에서 변동성이 확대될 가능성은 열어둘 필요가 있습니다.",
  "trend": "bullish",
  "patternSummaries": [
    {"patternName":"컵앤핸들","trend":"bullish","summary":"약 7주에 걸쳐 형성된 컵 구간 이후 손잡이 구간의 조정 폭이 얕게 유지되며 상방 돌파 준비 단계로 해석됩니다."}
  ],
  "strategyResults": [
    {"strategyName":"골든크로스 추세추종","trend":"bullish","summary":"50일선이 200일선을 상향 돌파한 뒤 두 이동평균선의 이격이 확대되고 있어 중기 추세추종 전략의 진입 조건을 충족합니다."}
  ]
}$j$::jsonb, 'deepseek-v4-flash', now(), now()),

('AAPL','overall', $j${
  "headlineKo": "[QA-OVERALL-7f3a] 기술적 모멘텀과 실적 체력이 동시에 개선되는 구간입니다.",
  "integratedConclusionKo": "기술적으로는 중기 추세가 살아 있고 펀더멘털도 서비스 매출 비중 확대로 이익의 질이 개선되는 흐름입니다.\n다만 밸류에이션 부담과 하드웨어 수요 둔화 우려가 상단을 제한할 수 있어 분할 접근이 유효합니다.",
  "technicalBulletsKo": ["50일선이 200일선을 상향 돌파해 중기 추세가 상방으로 전환됐습니다.","거래량이 20일 평균을 상회하며 돌파의 신뢰도를 높이고 있습니다."],
  "fundamentalBulletsKo": ["서비스 부문 매출총이익률이 전년 대비 개선됐습니다.","자사주 매입이 주당 지표를 지속적으로 끌어올리고 있습니다."],
  "newsBulletsKo": ["신규 제품 사이클 관련 보도가 투자심리를 지지하고 있습니다."],
  "optionsBulletsKo": ["근월물 콜 미결제약정이 상단 행사가에 집중되어 있습니다."],
  "financialsBulletsKo": ["영업활동 현금흐름이 안정적으로 유지되고 있습니다."],
  "scenarios": [
    {"name":"bullish","triggerConditionKo":"직전 고점을 거래량 동반으로 돌파하면 추세 연장이 가능합니다.","priceRangeKo":"상단 목표 구간"},
    {"name":"neutral","triggerConditionKo":"박스권 상단에서 매물 소화가 이어질 경우 횡보가 예상됩니다.","priceRangeKo":"중립 구간"},
    {"name":"bearish","triggerConditionKo":"20일선을 종가로 하회하면 단기 조정 국면으로 전환될 수 있습니다.","priceRangeKo":"하단 지지 구간"}
  ],
  "riskFactorsKo": ["하드웨어 수요 둔화 시 매출 성장률이 훼손될 수 있습니다.","규제 리스크가 서비스 부문 수익성에 부담으로 작용할 수 있습니다."]
}$j$::jsonb, 'deepseek-v4-flash', now(), now()),

('AAPL','fundamental', $j${
  "overallConclusionKo": "[QA-FUNDAMENTAL-7f3a] 이익의 질과 현금창출력이 견조해 펀더멘털 체력은 양호한 것으로 평가됩니다.\n다만 성장률 둔화가 밸류에이션 프리미엄을 제한하는 요인입니다.",
  "overallSentiment": "bullish",
  "categoryAssessments": [
    {"category":"valuation","sentiment":"neutral","rationaleKo":"동종업계 대비 프리미엄이 유지되고 있으나 과거 밴드 상단 대비로는 부담이 크지 않은 수준입니다."},
    {"category":"profitability","sentiment":"bullish","rationaleKo":"서비스 매출 비중 확대로 매출총이익률이 구조적으로 개선되고 있습니다."},
    {"category":"growth","sentiment":"neutral","rationaleKo":"하드웨어 성장률은 정체되어 있으나 서비스 부문이 이를 상쇄하고 있습니다."},
    {"category":"health","sentiment":"bullish","rationaleKo":"순현금 포지션과 안정적인 이자보상배율로 재무 건전성이 우수합니다."},
    {"category":"futureDirection","sentiment":"bullish","rationaleKo":"신규 카테고리 진출과 자사주 매입 기조가 주당 지표를 지지할 전망입니다."}
  ],
  "riskFactorsKo": ["중국 시장 수요 변동성이 실적 가시성을 낮출 수 있습니다.","반독점 규제 진행 경과에 따라 서비스 수익 구조가 바뀔 수 있습니다."]
}$j$::jsonb, 'deepseek-v4-flash', now(), now()),

('AAPL','financials', $j${
  "overallConclusionKo": "[QA-FINANCIALS-7f3a] 현금창출력과 안정성 축이 모두 상위권으로 재무제표 전반의 질이 우수합니다.\n성장성 축은 상대적으로 완만한 개선에 그치고 있습니다.",
  "overallSentiment": "bullish",
  "axisAssessments": [
    {"axis":"growth","sentiment":"neutral","rationaleKo":"매출 성장률은 한 자릿수에 머물러 있으나 역성장에서는 벗어났습니다."},
    {"axis":"quality","sentiment":"bullish","rationaleKo":"영업이익률이 동종업계 상위권을 유지하고 있습니다."},
    {"axis":"solvency","sentiment":"bullish","rationaleKo":"순현금 구조로 금리 상승 국면에서도 이자 부담이 제한적입니다."},
    {"axis":"cash","sentiment":"bullish","rationaleKo":"잉여현금흐름이 순이익을 지속적으로 상회하고 있습니다."}
  ],
  "riskFactorsKo": ["재고자산 회전율 둔화가 나타나면 마진 방어가 어려워질 수 있습니다."]
}$j$::jsonb, 'deepseek-v4-flash', now(), now()),

('AAPL','congress', $j${
  "summaryKo": "[QA-CONGRESS-7f3a] 최근 공시 구간에서 상원 매수와 하원 부분 매도가 함께 관측되어 방향성은 혼조로 해석됩니다.\n금액 구간이 크지 않아 시그널로서의 강도는 제한적입니다.",
  "overallSentiment": "neutral",
  "notableMembersKo": ["상원 의원 배우자 계좌의 매수 신고가 확인됩니다.","하원 의원 공동명의 계좌에서 부분 매도가 신고됐습니다."],
  "riskNoteKo": "의회 거래 공시는 약 45일의 지연이 있어 현재 시점의 판단 근거로는 보조 지표로만 활용해야 합니다."
}$j$::jsonb, 'deepseek-v4-flash', now(), now()),

('AAPL','news', $j${
  "currentDriverKo": "[QA-NEWS-7f3a] 신규 제품 사이클 기대와 서비스 부문 성장이 최근 뉴스 흐름의 핵심 동인입니다.\n규제 관련 헤드라인은 심리에 부담으로 작용하고 있습니다.",
  "overallSentiment": "bullish",
  "keyEventsKo": ["분기 실적이 시장 컨센서스를 상회했다는 보도가 있었습니다.","서비스 구독자 수 증가가 확인됐다는 분석이 제기됐습니다."],
  "upcomingEventsKo": ["다음 분기 실적 발표가 예정되어 있습니다.","연례 개발자 행사에서의 신규 발표가 대기 중입니다."]
}$j$::jsonb, 'deepseek-v4-flash', now(), now()),

('AAPL','options', $j${
  "summary": "[QA-OPTIONS-7f3a] 근월물 콜 미결제약정이 상단 행사가에 집중되어 있어 옵션 시장은 완만한 상방 기대를 반영하고 있습니다.\n내재변동성은 최근 60일 평균을 소폭 하회하는 수준입니다.",
  "perExpiration": [
    {"expirationDate":"2026-08-21","commentary":"최근접 만기에서 콜 우위 구조가 뚜렷하며 풋콜 비율이 1을 밑돌고 있습니다.","tone":"bullish"},
    {"expirationDate":"2026-09-18","commentary":"차근접 만기는 미결제약정이 넓게 분산되어 방향성 신호가 약합니다.","tone":"neutral"}
  ],
  "signals": [
    {"message":"최대 고통 가격이 현재가 위에 형성되어 만기까지 상방 압력이 유지될 수 있습니다.","kind":"bullish"},
    {"message":"내재변동성이 역사적 변동성을 하회해 옵션 매수 비용 부담은 낮은 편입니다.","kind":"volatility"}
  ]
}$j$::jsonb, 'deepseek-v4-flash', now(), now()),

-- §H fixtures ------------------------------------------------------------
-- MSFT: whitelisted, NOT in asset_translations → degraded. VALID technical row
--       → must become `index, follow` (reason: degraded-with-snapshot).
--       Deliberately technical-ONLY, so /MSFT/congress must stay noindex
--       (proves the gate is tab-scoped, not per-symbol).
('MSFT','technical', $j${
  "summary": "[QA-MSFT-7f3a] MSFT는 클라우드 부문 성장 기대를 반영하며 주요 이동평균선 위에서 안정적인 흐름을 유지하고 있습니다.",
  "trend": "bullish"
}$j$::jsonb, 'deepseek-v4-flash', now(), now()),

-- NVDA: whitelisted, NOT in asset_translations → degraded. MALFORMED row —
--       the row EXISTS but its content fails narrowTechnicalContent()
--       (no summary / patternSummaries / strategyResults), so the renderer
--       null-renders and hasProseForTab() must report false → still noindex.
('NVDA','technical', $j${"unexpectedField":"이 값은 어떤 렌더러 narrowing도 통과하지 못합니다","trend":"bullish"}$j$::jsonb,
 'deepseek-v4-flash', now(), now())

ON CONFLICT (symbol, tab) DO UPDATE SET
  content = EXCLUDED.content,
  model = EXCLUDED.model,
  generated_at = EXCLUDED.generated_at,
  updated_at = now();
SQL
```

**Step 2 — verify the seed landed:**

```sh
$PSQL -c "SELECT symbol, tab, length(content::text) AS bytes, generated_at FROM seo_analysis_snapshots ORDER BY symbol, tab;"
```
Expect **9 rows**: `AAPL` × 7 tabs, `MSFT`/`technical`, `NVDA`/`technical`. `generated_at` must be within 7 days of now (`SNAPSHOT_MAX_AGE_MS`) or `getSeoSnapshotsStatic` filters the row out and logs `dropped … row(s) older than …`.

**Teardown (run at the end, or to reset between phases):**

```sh
# Remove only what this validation wrote:
$PSQL -c "DELETE FROM seo_analysis_snapshots WHERE symbol IN ('AAPL','MSFT','NVDA');"

# Or nuke the whole local backend (safe — it is throwaway, and never Neon):
$COMPOSE down -v
```

### 0.6 Run order, and how to defeat ISR

`[symbol]*` routes are on-demand ISR (`generateStaticParams()` returns `[]`, `revalidate` 6h–24h) and the snapshot DB read is wrapped in `unstable_cache` (`getSeoSnapshotsStatic`, tags `symbol:{SYM}` + `seo-snapshot:{SYM}`). **Seeding by raw SQL cannot call `revalidateTag`**, so a route rendered *before* the seed keeps serving the pre-seed HTML for the whole TTL. A query string does **not** bust it — these pages don't read `searchParams`, so `?x=1` maps to the same cache entry.

Therefore run in **two phases with a full rebuild between them**. This is the only reset that is unambiguous (a fresh `yarn build` does `rm -rf .next`, per `package.json`'s `build` script), and it costs ~2–4 min:

| Phase | State | Cases |
|---|---|---|
| **Phase 1** — build #1, `seo_analysis_snapshots` **empty** | fail-open baseline | §A, §B, §G, §J, and the **unseeded visible-text baselines** for all 7 AAPL tabs (§C needs them) |
| *(seed §0.5, then `yarn clear:build` + rebuild)* | | |
| **Phase 2** — build #2, rows present | the payoff | §C, §D, §E, §F, §H, §I |

**Ground-truth probe that a cold read actually happened.** `getSeoSnapshotsStatic` emits, once per symbol per cache fill (inside the `unstable_cache` fetcher, not per request):

```
[getSeoSnapshotsStatic] AAPL: 7 snapshot row(s)
```

Watch the `yarn start` stdout. If you request a symbol page and **no** such line appears, you are being served a cached render — the result is not evidence. Re-run the rebuild before trusting anything.

Build + start commands (both phases):

```sh
yarn clear:build
run_with_e2e_env yarn build > /tmp/seoqa/build.log 2>&1; echo "EXIT=$?"
run_with_e2e_env yarn start -p 4300 2>&1 | tee /tmp/seoqa/server.log
```

> Capture the build exit code **directly**. Never pipe `yarn build` into `tail` — a pipeline masks a non-zero exit and a broken build will look green.

---

## A. Build / boot  *(Phase 1; re-run A1–A3 on the Phase 2 build)*

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **A1** | Prod build succeeds | `run_with_e2e_env yarn build > /tmp/seoqa/build.log 2>&1; echo "EXIT=$?"` | `EXIT=0`. |
| **A2** | No dynamic-usage bail-out introduced by the snapshot DB read | `grep -c 'DYNAMIC_SERVER_USAGE' /tmp/seoqa/build.log`; `grep -c 'Error occurred prerendering' /tmp/seoqa/build.log` | Both → `0`. A non-zero here means a snapshot read escaped `staticSymbolCache` and forced a route dynamic. |
| **A3** | All 9 `[symbol]*` routes stay SSG | `grep -E '●\s+/\[symbol\]' /tmp/seoqa/build.log` | **9** lines, all marked `●` (SSG): `/[symbol]`, `/[symbol]/overall`, `/[symbol]/fundamental`, `/[symbol]/financials`, `/[symbol]/congress`, `/[symbol]/news`, `/[symbol]/options`, `/[symbol]/fear-greed`, `/[symbol]/position`. Any `ƒ` (Dynamic) among them is a **FAIL** — the ISR/cost model depends on these staying static. |
| **A4** | Cron route is still a dynamic handler | `grep -E 'api/cron/seo-prewarm' /tmp/seoqa/build.log` | Present, marked `ƒ` (Dynamic / Route Handler). Must **not** be `○`/`●`. |
| **A5** | Server boots and serves | `run_with_e2e_env yarn start -p 4300` (leave running), then `curl -s -o /dev/null -w '%{http_code}\n' $HOST/` | `200`. Keep this server for the rest of the phase. |
| **A6** | The e2e wiring is really in effect | In `/tmp/seoqa/server.log`, after A5's request, look for DB activity; and run `curl -s -o /dev/null -w '%{http_code}\n' $HOST/AAPL` | `200`, and stdout shows `[getSeoSnapshotsStatic] AAPL: 0 snapshot row(s)` (Phase 1) — proving the app reached the **local** DB. A `[getSeoSnapshotsStatic] read failed, degrading:` line means P5 is broken (Neon driver against localhost) — **stop and fix before continuing**. |

---

## B. No-snapshot fail-open  *(Phase 1 — table empty; curl)*

Proves the "nothing got worse" half: with zero snapshot rows, every page renders exactly as it did before, the snapshot section is **absent entirely** (not an empty shell), and nothing 500s. Renderers return `null` when their `narrow*Content` fails, so the wrapping `SnapshotSummarySection` — and therefore its `<h2>` — is never mounted.

Per-tab heading strings (read from `src/views/symbol/snapshot/renderers/*`, `title=` prop on `SnapshotSummarySection`):

| tab | route | heading |
|---|---|---|
| technical | `/AAPL` | `기술적 분석 요약` |
| overall | `/AAPL/overall` | `종합 분석 결론` |
| fundamental | `/AAPL/fundamental` | `펀더멘털 종합 평가` |
| financials | `/AAPL/financials` | `재무제표 종합 평가` |
| congress | `/AAPL/congress` | `의회 거래 동향 요약` |
| news | `/AAPL/news` | `뉴스 종합 심리` |
| options | `/AAPL/options` | `옵션 시장 요약` |

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **B1** | `/AAPL` (technical): 200, no snapshot shell, existing placeholder intact | `curl -s -o /tmp/seoqa/p1-technical.html -w '%{http_code}\n' $HOST/AAPL` then `nrm < /tmp/seoqa/p1-technical.html \| grep -c '기술적 분석 요약'` | HTTP `200`. grep count → **`0`** (section absent). The page still renders its pre-existing content: `nrm < /tmp/seoqa/p1-technical.html \| grep -c '차트'` → ≥1, and the sr-only h1 is present (`grep -c 'AAPL' ` → ≥1). No `Application error` / error-boundary text. |
| **B2** | `/AAPL/overall`: 200, no snapshot shell, existing peek/placeholder chain intact | `curl -s -o /tmp/seoqa/p1-overall.html -w '%{http_code}\n' $HOST/AAPL/overall` then `nrm < /tmp/seoqa/p1-overall.html \| grep -c '종합 분석 결론'` | HTTP `200`; grep → **`0`**. The legacy fallback still renders (this is exactly the "not cached yet" placeholder path the fix is meant to *replace*, not delete): the page body is non-empty and contains the `종합` heading region from `OverallFactsSummary`/`OverallFactualFallback`. Record `python3 /tmp/seoqa/vtext.py /tmp/seoqa/p1-overall.html`. |
| **B3** | `/AAPL/news`: 200, no snapshot shell, **client AI widget still present** (XOR fallback direction) | `curl -s -o /tmp/seoqa/p1-news.html -w '%{http_code}\n' $HOST/AAPL/news` then `nrm < /tmp/seoqa/p1-news.html \| grep -c '뉴스 종합 심리'` and `nrm < /tmp/seoqa/p1-news.html \| grep -c '뉴스 AI 종합 분석'` | HTTP `200`; snapshot heading → **`0`**; widget heading `뉴스 AI 종합 분석` → **≥1** (its skeleton/heading is server-rendered). This is the *other* arm of the §E XOR: with no snapshot, the widget must still mount. |
| **B4** | No 500 on any of the 9 routes with an empty table | `for p in "" /overall /fundamental /financials /congress /news /options /fear-greed /position; do printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "$HOST/AAPL$p"; done` | All **`200`**. Any `500` is a hard FAIL (fail-open contract broken). |
| **B5** | **Baseline capture for §C** — unseeded visible-text length per tab | `for p in "" /overall /fundamental /financials /congress /news /options; do curl -s "$HOST/AAPL$p" -o /tmp/seoqa/base$(echo "$p" \| tr -d /).html; done` then run `vtext.py` on each and record the numbers in the §C table's "unseeded" column | 7 recorded integers. These are the denominators for the §C payoff claim. |
| **B6** | Empty shell never appears | `nrm < /tmp/seoqa/p1-technical.html \| grep -c '전일 장마감 기준'` | **`0`**. That caption lives inside `SnapshotSummarySection`; if it appears without prose, an empty card is being rendered — FAIL. |

---

## C. Seeded-snapshot payoff — **CORE CASE 1**  *(Phase 2; curl)*

Prerequisite: §0.5 seeded, then `yarn clear:build` + rebuild + restart (§0.6). Confirm on the first request that stdout shows `[getSeoSnapshotsStatic] AAPL: 7 snapshot row(s)`.

For each tab: fetch → assert **HTTP 200** → assert the **per-tab heading** appears → assert the **seeded marker/prose** appears → **measure visible text** and compare to the §B5 unseeded baseline.

Command template (substitute `<PATH>`, `<HEADING>`, `<MARKER>`):

```sh
curl -s "$HOST/AAPL<PATH>" -o /tmp/seoqa/s.html -w 'HTTP=%{http_code}\n'
nrm < /tmp/seoqa/s.html | grep -c '<HEADING>'     # → ≥1
nrm < /tmp/seoqa/s.html | grep -c '<MARKER>'      # → ≥1
python3 /tmp/seoqa/vtext.py /tmp/seoqa/s.html     # → visible-text length
```

| ID | Tab / route | Heading that must appear | Marker that must appear | Additional prose that must appear | Visible text |
|---|---|---|---|---|---|
| **C1** | technical — `/AAPL` | `기술적 분석 요약` | `QA-TECHNICAL-7f3a` | `AAPL 기술적 방향성: 강세` (trend lead), `차트 패턴`, `컵앤핸들`, `전략 시그널`, `골든크로스 추세추종` | ≥ unseeded + **350** |
| **C2** | overall — `/AAPL/overall` | `종합 분석 결론` | `QA-OVERALL-7f3a` | `기술적 분석`, `펀더멘털`, `뉴스`, `옵션`, `재무제표` (the five axis bullet headings), `강세 시나리오`, `중립 시나리오`, `약세 시나리오`, `위험 요인` | ≥ unseeded + **300** |
| **C3** | fundamental — `/AAPL/fundamental` | `펀더멘털 종합 평가` | `QA-FUNDAMENTAL-7f3a` | `AAPL 펀더멘털 종합 평가: 긍정`, `카테고리별 평가`, `밸류에이션`, `수익성`, `성장성`, `재무 건전성`, `미래 방향`, `위험 요인` | ≥ unseeded + **250** |
| **C4** | financials — `/AAPL/financials` | `재무제표 종합 평가` | `QA-FINANCIALS-7f3a` | `AAPL 재무제표 종합 평가: 긍정`, `축별 평가`, `성장성`, `수익성·질`, `안정성`, `현금창출력`, `위험 요인` | ≥ unseeded + **200** |
| **C5** | congress — `/AAPL/congress` | `의회 거래 동향 요약` | `QA-CONGRESS-7f3a` | `AAPL 의회 거래 동향: 중립`, `주목할 인물`, `참고 사항` | ≥ unseeded + **130** |
| **C6** | news — `/AAPL/news` | `뉴스 종합 심리` | `QA-NEWS-7f3a` | `AAPL 뉴스 종합 심리: 긍정`, `핵심 이벤트`, `다가오는 주요 일정` | ≥ unseeded + **130** |
| **C7** | options — `/AAPL/options` | `옵션 시장 요약` | `QA-OPTIONS-7f3a` | `만기별 해석`, `2026-08-21`, `(강세)` (per-expiration tone, parentheses), `시그널`, `[변동성]` (signal kind, **square** brackets — the two lists use different delimiters) | ≥ unseeded + **160** |

> **How the `+N` floors were derived — and why they are lower than the fixture size.** Each fixture's rendered prose (all rendered string values + section headings + Korean enum labels) measures: technical ≈ 476, overall ≈ 691, fundamental ≈ 485, financials ≈ 357, congress ≈ 260, news ≈ 250, options ≈ 332 characters. The floors above sit well under those numbers on purpose, because on 5 tabs the **XOR gate (§E) simultaneously removes** the client AI widget's heading/skeleton text (and on `/AAPL/overall`, the `OverallFactsSummary` / `OverallFactualFallback` placeholder chain). The net delta is therefore *prose added − placeholder removed*, which is smaller than the fixture on those tabs — and that is **correct behavior**, not a shortfall. `/AAPL` (technical) has no such subtraction: the peek result only seeds the client component, so its delta should land closest to the full fixture size.
>
> Record the **actual** unseeded → seeded numbers for every tab; the deltas are the headline evidence. Also record the absolute seeded values for `/AAPL` and `/AAPL/overall` against the **677-character production baseline** that triggered this effort, and state explicitly whether the seeded page clears it by a wide margin. If a tab's delta lands *below* its floor, do not fail it blindly — dump both texts (`vtext.py … --dump`) and diff them to confirm the shortfall is XOR subtraction rather than missing prose.

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **C8** | Fear-greed server-computed factor narrative (no snapshot involved — pure deterministic core computation) | `curl -s "$HOST/AAPL/fear-greed" -o /tmp/seoqa/fg.html -w 'HTTP=%{http_code}\n'; nrm < /tmp/seoqa/fg.html \| grep -c '공포 탐욕 지수 요약'` | `200`. Heading `AAPL 공포 탐욕 지수 요약` present (≥1). Body contains `현재 점수`, a `/ 100` score line, and per-symbol narrative sentences containing `번째 퍼센타일` plus **either** `그룹 점수(` … `우위 흐름입니다` **or** `균형 잡힌 흐름` (group-comparison line) and `가장 두드러진 지표는` (factor-ranking line). ⚠️ If the local fake market provider yields too few bars, `computeFearGreedIndex` returns `null` and the whole section is legitimately absent — in that case record **N/A (insufficient local bars)**, not FAIL, and verify only that the page is `200` with no empty shell. |
| **C9** | The prose is identical for crawlers and humans (no cloaking) | `curl -s -A 'Mozilla/5.0' "$HOST/AAPL" -o /tmp/seoqa/ua-human.html; curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' "$HOST/AAPL" -o /tmp/seoqa/ua-bot.html; python3 /tmp/seoqa/vtext.py /tmp/seoqa/ua-human.html; python3 /tmp/seoqa/vtext.py /tmp/seoqa/ua-bot.html` | The two visible-text lengths are **equal** (or within a few chars of nondeterministic numbers). Both contain `QA-TECHNICAL-7f3a`. Any UA-conditional prose would be cloaking — FAIL. |

---

## D. Persistence after hydration — **CORE CASE 2**  *(Phase 2; Chrome)*

**What this catches.** A prior audit found the snapshot prose mounted inside a `<Suspense fallback={…}>`. Next bakes the fallback into the static HTML, so `curl` sees it — but React **destroys that subtree** when the boundary resolves during hydration. Googlebot renders with JS, so it would see the prose vanish. The fix mounts every renderer as a **persistent server sibling** (chart page: after the `h-full shrink-0` chart wrapper; overall page: before the `Suspense`, with the fallback XOR'd to `null`). §C alone cannot detect a regression here — only a live-DOM check can.

Setup: Chrome, DevTools open, **JS enabled**, hard-reload (`Cmd+Shift+R`) each URL, and **wait for hydration to finish** (Network idle; the interactive chart / client widgets have appeared and React has taken over) before querying.

| ID | Validates | Action | Expected result |
|---|---|---|---|
| **D1** | Raw HTML contains the prose (re-confirm the byte-level fact for the exact URL under test) | `curl -s "$HOST/AAPL" \| nrm \| grep -c 'QA-TECHNICAL-7f3a'` | `≥1`. |
| **D2** | **Hydrated DOM still contains it** (chart page) | Open `$HOST/AAPL`, wait for the chart to become interactive, then in the Console run:<br>`document.body.innerText.includes('QA-TECHNICAL-7f3a')`<br>`[...document.querySelectorAll('h2')].map(h=>h.textContent).filter(t=>t.includes('기술적 분석 요약')).length` | → `true`; → `1`. If `true` in D1 but `false` here, **the Suspense-fallback regression is back — this is the single most important failure mode in this document.** |
| **D3** | Hydrated DOM contains it (overall page) | Open `$HOST/AAPL/overall`, wait for hydration, Console:<br>`document.body.innerText.includes('QA-OVERALL-7f3a')`<br>`document.body.innerText.includes('종합 분석 결론')` | Both → `true`. |
| **D4** | Persistence across the remaining 5 tabs | Repeat D2's `innerText.includes(...)` for `/AAPL/fundamental` (`QA-FUNDAMENTAL-7f3a`), `/AAPL/financials` (`QA-FINANCIALS-7f3a`), `/AAPL/congress` (`QA-CONGRESS-7f3a`), `/AAPL/news` (`QA-NEWS-7f3a`), `/AAPL/options` (`QA-OPTIONS-7f3a`) | All → `true`. |
| **D5** | Not a race — the prose is still there after the app has fully settled | On `$HOST/AAPL`, wait ≥10 s after network idle (client `useAnalysis`/`useBars` refetches have run), then re-run D2's expressions | Still `true` / `1`. A value that flips to `false` after a refetch means a client subtree is replacing the server prose. |
| **D6** | Exactly one heading instance (server prose was not duplicated by a client re-render) | On each of the 7 tabs, Console: `[...document.querySelectorAll('h2')].filter(h=>h.textContent.trim()===  '<per-tab heading>').length` | `1` on every tab (never `2`). |
| **D7** | No React hydration error | DevTools Console during D2–D4 | No `Hydration failed`, no `Text content does not match server-rendered HTML`, no `Minified React error #418/#423/#425`. Such an error means the server and client trees disagree around the newly-mounted prose — FAIL even if the text happens to survive. |

---

## E. Duplicate-content XOR  *(Phase 2; Chrome, hydrated DOM)*

On the 5 tabs where a client AI widget renders the *same* AI conclusion fields, the snapshot prose and the widget are mutually exclusive: when the snapshot is renderable the widget is not mounted at all (`{showXProse ? <Prose/> : <Widget/>}`, and for options via the `hasSnapshotProse` prop threaded into `OptionsPageClient`). Checking this in **raw HTML alone is insufficient** — the widget could mount at hydration — so query the **live DOM** after hydration.

| ID | Tab | Snapshot heading (must be present, ×1) | Client-widget heading (must be **absent**) |
|---|---|---|---|
| **E1** | `/AAPL/news` | `뉴스 종합 심리` | `뉴스 AI 종합 분석` |
| **E2** | `/AAPL/congress` | `의회 거래 동향 요약` | `AI 동향 해석` |
| **E3** | `/AAPL/fundamental` | `펀더멘털 종합 평가` | `AI 펀더멘털 분석` |
| **E4** | `/AAPL/financials` | `재무제표 종합 평가` | `AI 재무제표 분석` |
| **E5** | `/AAPL/options` | `옵션 시장 요약` | `AI 옵션 분석` |

Console snippet per row (run **after** hydration settles, ≥5 s past network idle so a late client mount would have happened):

```js
const t = document.body.innerText;
({ prose: t.includes('<SNAPSHOT HEADING>'), widget: t.includes('<WIDGET HEADING>') })
// expected: { prose: true, widget: false }
```

| ID | Validates | Action | Expected result |
|---|---|---|---|
| **E6** | The XOR is a real gate, not a permanent widget removal | Compare against §B3 (Phase 1, unseeded `/AAPL/news`) | Phase 1: widget heading **present**, snapshot heading absent. Phase 2: the reverse. Both directions must hold — if the widget is gone in *both* phases, the fix deleted a feature rather than gating it. |
| **E7** | Options: the stale-data notice is suppressed with the widget | On `/AAPL/options`, Console: `document.body.innerText.includes('AI 옵션 분석')` | `false`. The `OptionsAiAnalysisStaleNotice` is inside the same suppressed block, so no orphaned "stale analysis" banner should appear either. |
| **E8** | No duplicated conclusion text anywhere on the page | On each of E1–E5, Console: `(document.body.innerText.match(/<MARKER>/g)\|\|[]).length` | `1` — the seeded conclusion appears exactly once in the rendered text. |

---

## F. Meta descriptions  *(Phase 2 for seeded, Phase 1 output for the fallback; curl)*

`buildSnapshotMetaDescription(tab, content, subject)` prefixes the resolved display name and clamps at **120 code points**, preferring a sentence boundary within 40 cp of the cut. Only `<meta name="description">` is overridden — `og:description` / `twitter:description` keep the templated copy. AAPL's display name resolves to **`애플, Apple Inc. (AAPL)`** (`buildDisplayName` with the seeded `koreanName`).

Extraction helper:

```sh
desc() { curl -s "$1" | nrm | grep -o '<meta name="description" content="[^"]*"'; }
ogdesc() { curl -s "$1" | nrm | grep -o '<meta property="og:description" content="[^"]*"'; }
```

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **F1** | technical description is snapshot-derived and leads with the subject | `desc $HOST/AAPL` | Content **starts with** `애플, Apple Inc. (AAPL) — ` and **contains** `QA-TECHNICAL-7f3a`. Length ≤ 120 code points (`python3 -c "print(len('<paste>'))"`). |
| **F2** | overall description is snapshot-derived (different field → different text) | `desc $HOST/AAPL/overall` | Starts with `애플, Apple Inc. (AAPL) — `, contains `QA-OVERALL-7f3a`. **Differs** from F1's string. |
| **F3** | The other 5 tabs are each uniquely derived | `for p in /fundamental /financials /congress /news /options; do desc "$HOST/AAPL$p"; done` | 5 distinct strings, each starting with `애플, Apple Inc. (AAPL) — ` and containing its own marker (`QA-FUNDAMENTAL-7f3a`, `QA-FINANCIALS-7f3a`, `QA-CONGRESS-7f3a`, `QA-NEWS-7f3a`, `QA-OPTIONS-7f3a`). Combined with F1/F2: **7 mutually distinct descriptions** — pipe all 7 through `sort -u \| wc -l` → `7`. This is the direct counter to the "90 % identical boilerplate" diagnosis. |
| **F4** | og/twitter stay templated (only the search-facing description is overridden) | `ogdesc $HOST/AAPL`; same for `twitter:description` | Contains **no** `QA-` marker. It is the templated `buildSymbolSeoContent(...).description` copy. |
| **F5** | Unseeded symbol falls back to the templated description | Use the Phase 1 capture (or `desc $HOST/ZZZZ` in Phase 2 — never seeded): `grep -o '<meta name="description" content="[^"]*"' /tmp/seoqa/base.html` | No `QA-` marker; equals the templated copy. Backward compatibility preserved: no snapshot ⇒ nothing changes. |
| **F6** | Sentence-boundary clamp behaves (no mid-word cut, no stray ellipsis abuse) | Inspect F1–F3 strings | Each ends either at a sentence terminator (`.` / `다.` / `!` / `?`) or with `…`. No broken surrogate pairs / mojibake. No `**`, `__`, `` ` ``, or leading `- ` markdown markers anywhere (the `stripSnapshotMarkdown` sanitizer runs on every renderer field). |

---

## G. robots.txt  *(either phase; curl)*

Googlebot reads **only** the group whose user-agent matches it exactly — it does **not** inherit the `*` group. So the Googlebot group must replicate the `*` baseline **and** add the image disallows.

```sh
curl -s $HOST/robots.txt -o /tmp/seoqa/robots.txt && cat /tmp/seoqa/robots.txt
```

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **G1** | A dedicated Googlebot group exists | `grep -n '^User-Agent: Googlebot$' /tmp/seoqa/robots.txt` | Exactly one match. |
| **G2** | The Googlebot group blocks the OG/twitter image routes | In the block following the `User-Agent: Googlebot` line: `awk '/^User-Agent: Googlebot$/{f=1;next} /^User-Agent:/{f=0} f' /tmp/seoqa/robots.txt` | The block contains **all three**: `Disallow: /api/`, `Disallow: /*/opengraph-image`, `Disallow: /*/twitter-image`, plus `Allow: /`. |
| **G3** | The `*` group is unchanged and still fully crawlable | `awk '/^User-Agent: \*$/{f=1;next} /^User-Agent:/{f=0} f' /tmp/seoqa/robots.txt` | Contains `Allow: /` and **exactly one** `Disallow:` line — `Disallow: /api/`. Crucially it does **not** contain the image disallows (the block is Googlebot-only, as designed) and **not** `Disallow: /`. |
| **G4** | Search-engine crawlers were not collaterally blocked | `grep -nE '^User-Agent: (Googlebot-Image\|Yeti\|Bingbot\|Daumoa)$' /tmp/seoqa/robots.txt`; then inspect the parasite group | No `Googlebot`, `Googlebot-Image`, `Yeti`, `Bingbot`, or `Daumoa` appears in the `Disallow: /` (parasite-bot) group. `Googlebot-Image` has no group of its own — correct, it falls back to the `Googlebot` group. |
| **G5** | Sitemap still advertised | `grep -c '^Sitemap: ' /tmp/seoqa/robots.txt` | `1`, pointing at `…/sitemap.xml`. |
| **G6** | Image routes are still *reachable* (robots.txt is a crawl directive, not an auth gate — social cards must still work) | `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' $HOST/AAPL/opengraph-image` | `200 image/png`. A 403/404 here would break Twitter/Facebook card rendering — FAIL. |

---

## H. Indexability invariants  *(Phase 2; curl)*

`evaluateSymbolIndexability` order matters: invalid shape → `noindex`; missing asset → `noindex`; **degraded** → `index` only if (whitelisted **and** `hasSnapshot === true`); otherwise the whitelist tiers. `hasSnapshot` is computed in `getBlockedSymbolMetadata` as *"a row exists for **this tab** **and** its `content` passes that tab's `has*Prose` predicate"* (`hasProseForTab`) — tab-scoped **and** renderability-gated.

Locally: `AAPL` resolves from `asset_translations` → **not** degraded → `index` via the plain `popular` tier. `MSFT`/`NVDA` are whitelisted but **absent** from `asset_translations` → FMP throws (no key) → `degraded: true` with a non-null fallback `assetInfo` — which is exactly the state the snapshot gate was written for.

```sh
robots_meta() { curl -s "$1" | nrm | grep -o '<meta name="robots" content="[^"]*"'; }
```

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **H1** | Whitelisted + resolvable + seeded → indexable | `robots_meta $HOST/AAPL` | `<meta name="robots" content="index, follow">` (inherited from the root layout, since `getBlockedSymbolMetadata` returns `null` for indexable pages). A `<meta name="googlebot" content="index, follow, max-image-preview:large, …">` is also present. Must **not** be `noindex`. (Reason path: `popular` — degraded is false.) Repeat for `/AAPL/overall` and `/AAPL/news`: same result. |
| **H2** | Unapproved longtail stays blocked | `robots_meta $HOST/ZZZZ` | `<meta name="robots" content="noindex, nofollow">`. HTTP still `200` (soft-degrade, never 404/500): `curl -s -o /dev/null -w '%{http_code}\n' $HOST/ZZZZ` → `200`. |
| **H3** | **Degraded + whitelisted + VALID snapshot → indexable** (the `degraded-with-snapshot` path) | `robots_meta $HOST/MSFT`; confirm degradation first via `curl -s $HOST/MSFT \| nrm \| grep -c 'QA-MSFT-7f3a'` | Marker grep → `≥1` (prose renders on the degraded page). robots meta → **`index, follow`** (root-layout default, i.e. `getBlockedSymbolMetadata` returned `null`), and the `googlebot` meta is present. This is the payoff of the gate: a page that would otherwise be `noindex` stays indexable **because** it now carries substantive prose. Cross-check the negative control: `robots_meta $HOST/MSFT` in **Phase 1** (before seeding) would have been `noindex, nofollow`. |
| **H4** | **Degraded + whitelisted + MALFORMED snapshot row → still noindex** (the renderability gate) | `robots_meta $HOST/NVDA`; and `curl -s $HOST/NVDA \| nrm \| grep -c '기술적 분석 요약'` | Heading grep → **`0`** (renderer null-rendered on the unusable content). robots meta → **`noindex, nofollow`**. ⚠️ **This is the highest-value assertion in §H.** A row *exists* for `NVDA`/`technical`; if the gate keyed on row existence instead of renderability, this page would be falsely marked indexable while its body is the thin degraded shell — i.e. it would re-create the exact thin-content condition this whole effort exists to fix. |
| **H5** | The gate is **tab-scoped**, not per-symbol | `robots_meta $HOST/MSFT/congress` (MSFT has a `technical` row only) | `noindex, nofollow`. A `technical` row must never flip the `congress` route indexable. Also check `$HOST/MSFT/news` → `noindex, nofollow`. |
| **H6** | No route 500s under any of the above states | `for s in AAPL MSFT NVDA ZZZZ; do for p in "" /overall /news /congress; do printf '%s%s ' $s $p; curl -s -o /dev/null -w '%{http_code}\n' "$HOST/$s$p"; done; done` | All `200` (a `404` on a crypto-only-invalid tab combination is acceptable and should be noted; **any `500` is a FAIL**). |
| **H7** | Stale rows are dropped (max-age defense), if you want to exercise it | `$PSQL -c "UPDATE seo_analysis_snapshots SET generated_at = now() - interval '9 days' WHERE symbol='MSFT';"` then rebuild+restart and re-run H3 | Server log shows `dropped 1 row(s) older than …`; `/MSFT` heading grep → `0`; robots meta → `noindex, nofollow`. **Optional** (costs a rebuild). Restore with `UPDATE … SET generated_at = now() WHERE symbol='MSFT';` |

---

## I. Layout / visual regression  *(Phase 2; Chrome)*

Two specific layout changes need eyes on them: (1) the chart page's prose was moved **out of** the fixed-height `overflow-hidden` jail — `<main>` is now `overflow-y-auto` and the chart+AI wrapper is `h-full shrink-0`, so the chart must be **exactly as tall as before** and the prose must be reachable by scrolling; (2) `OptionsPageClient` dropped its duplicated `mx-auto max-w-5xl px-4`, which had been double-insetting it relative to the snapshot card above.

| ID | Validates | Action | Expected result |
|---|---|---|---|
| **I1** | Chart is not compressed by the added prose | Open `$HOST/AAPL` (desktop, ~1440×900). The chart+AI wrapper is the `h-full shrink-0` div that is `main`'s first **element** child of type `div` — Console:<br>`const m=document.querySelector('main'); const w=[...m.children].find(e=>e.tagName==='DIV'); ({h:w.getBoundingClientRect().height, mainH:m.getBoundingClientRect().height, scrollable:m.scrollHeight>m.clientHeight})`<br>Record the same in Phase 1 (unseeded) for comparison. | `h` is **the same** in both phases (within a pixel or two) and equals `mainH` — the wrapper still claims the full height of `main`, so the prose did not steal from it. In Phase 2, `scrollable` → `true` (the prose extends past the fold and `main` exposes it via `overflow-y-auto`). The chart is not squashed or clipped; no part of the timeframe bar / AI panel is cut off. |
| **I2** | Prose is reachable by scrolling, not trapped by `overflow-hidden` | On `$HOST/AAPL`, scroll the page/main container down | The `기술적 분석 요약` card scrolls into view fully — heading, paragraphs, `차트 패턴` and `전략 시그널` lists all visible and not clipped. Console cross-check: `const el=[...document.querySelectorAll('h2')].find(h=>h.textContent.includes('기술적 분석 요약')); el.scrollIntoView(); el.getBoundingClientRect().height > 0` → `true`. |
| **I3** | Heading hierarchy is not inverted | On `$HOST/AAPL`, Console: `[...document.querySelectorAll('h1,h2,h3')].map(e=>e.tagName+':'+e.textContent.trim().slice(0,24))` | The page `h1` appears **before** the `기술적 분석 요약` `h2` in document order, and there is exactly one `h1`. |
| **I4** | Options card widths line up (the removed duplicate `mx-auto max-w-5xl px-4`) | Open `$HOST/AAPL/options`. Console:<br>`const prose=[...document.querySelectorAll('section')].find(s=>s.textContent.includes('옵션 시장 요약'));`<br>`const below=prose.parentElement.querySelector('section:not([aria-labelledby="'+prose.getAttribute('aria-labelledby')+'"]), div.space-y-6') \|\| prose.nextElementSibling;`<br>`({prose:prose.getBoundingClientRect(), below:below.getBoundingClientRect()})` | The snapshot card and the options content block share the same `left` and `width` (±1 px). A ~16 px inset difference means the double `px-4` regressed. Visually confirm in the viewport: the two blocks form one column with aligned edges. |
| **I5** | No console errors on any of the 7 tabs + fear-greed | Load each of `/AAPL`, `/AAPL/overall`, `/AAPL/fundamental`, `/AAPL/financials`, `/AAPL/congress`, `/AAPL/news`, `/AAPL/options`, `/AAPL/fear-greed` with the Console open | No `Uncaught`, no React error (`#418`/`#423`/`#425`), no hydration mismatch, no error referencing `SnapshotSummarySection`, `*SnapshotProse`, `hasProseForTab`, `getSeoSnapshotsStatic`, or `seo_analysis_snapshots`. Pre-existing warnings unrelated to this change (and reproducible in Phase 1) are acceptable — note them. |
| **I6** | Mobile viewport does not overflow horizontally | In DevTools device mode (iPhone 14, 390 px), load `/AAPL` and `/AAPL/overall`. Console: `document.documentElement.scrollWidth <= window.innerWidth` | `true` on both. The bullet lists use `min-w-0 break-words`; a long unbroken token must not widen the document. |
| **I7** | Empty shell never appears in Phase 2 either | On any tab, confirm the card always has content | No card renders with only `전일 장마감 기준` and no body. (Applies especially to `/AAPL/options` — audit FIX 9 made `snapshotSlot` `undefined` rather than an always-truthy element.) |

---

## J. Cron route contract  *(brief regression re-check; curl)*

Already validated in `2026-07-25-seo-prewarm-phase1-empirical-validation.md` §B — re-run only to confirm Phase 2 did not disturb it. `CRON_SECRET` is **empty** under `run_with_e2e_env` (shadowed), which makes the route fail-closed; that is a legitimate 401 path.

| ID | Validates | Command / action | Expected result |
|---|---|---|---|
| **J1** | No auth → rejected | `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH $HOST/api/cron/seo-prewarm` | `401`, empty body. |
| **J2** | Wrong bearer → rejected | `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH -H 'Authorization: Bearer WRONG' $HOST/api/cron/seo-prewarm` | `401`. |
| **J3** | Correct bearer → accepted | Restart the server with a secret injected: `run_with_e2e_env env CRON_SECRET=localqa yarn start -p 4300`, then `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH -H 'Authorization: Bearer localqa' $HOST/api/cron/seo-prewarm` | **`202`** (Redis lock acquired via local SRH) **or** **`204`** (lock already held, or Redis unreachable → fail-closed). **Both PASS.** `401`/`403`/`500`/`200` = FAIL. Repeating the call immediately should yield `204` (lock re-entrancy). |
| **J4** | Wrong method → not allowed | `curl -s -o /dev/null -w '%{http_code}\n' -X GET $HOST/api/cron/seo-prewarm`; then `curl -sI -X GET $HOST/api/cron/seo-prewarm \| grep -i '^allow:'` | `405`, with `Allow: PATCH`. |

> After J3 returns 202, the background batch runs via `after()` and **will fail locally** — see the next section. That failure is expected and does not affect J3's verdict.

---

## Expected-and-fine locally vs. a real failure

### ✅ Expected and fine (do NOT report as failures)

| Observation | Why it's fine |
|---|---|
| `[seo-prewarm] batch failed: …` after J3's 202 | The batch calls the external AI worker and FMP. Neither exists locally and there is no FMP key. The route contract (auth/lock/202/204/405) is what §J tests; batch success is out of scope and cannot be exercised locally. |
| `[seo-prewarm] skip AAPL:technical — status=…` / `unit-error` / `fmp-402` in the log | Same reason. Per-unit fail-open isolation working as designed. |
| `[getAssetInfoResilient] infra failure, ticker fallback` suppressed / absent for unseeded symbols | Silenced under `E2E_TEST=1` by design; the degrade itself is the expected local state for `MSFT`/`NVDA`/`ZZZZ`. |
| `/MSFT`, `/NVDA`, `/ZZZZ` render a degraded shell | Only `AAPL` (+`EMPTYX`) is seeded into `asset_translations`. Degradation is the intended state for §H fixtures. |
| Charts show fake/sparse market data; fear-greed may show no score | `FakeMarketProvider` supplies deterministic fixtures, not real bars. §C8 has an explicit N/A branch for this. |
| `/AAPL/options` renders `OptionsEmptyState` instead of the full chain | The local options fake may not produce expirations. **Both** branches mount the snapshot prose (`snapshotSlot`) — §C7 passes either way. Note which branch you got. |
| `/AAPL/financials` or `/AAPL/fundamental` renders the `*Degraded` component | Those components also mount the snapshot prose (spec §7: "degraded 분기에서도 스냅샷 유지"). §C3/§C4 pass either way. |
| Local visible-text numbers ≠ 677 | 677 came from production `/AAPL`. §C asserts the **seeded-vs-unseeded delta** on the same local URL; absolute numbers are context only. |
| `/AAPL` shows `index, follow` **and** a separate `<meta name="googlebot" …max-image-preview:large…>` | The root layout (`src/app/layout.tsx`) declares both; `getBlockedSymbolMetadata` returning `null` simply lets them through. On `noindex` pages the page-level `robots` replaces it wholesale, so only `noindex, nofollow` appears and the `googlebot` meta drops out — that asymmetry is expected. |
| Console warnings that also reproduce on the Phase 1 (unseeded) build | Pre-existing, not caused by this change. Note them, don't block on them. |

### ❌ Real failures (report and stop)

| Observation | Why it's fatal |
|---|---|
| **Any `500`** on any `[symbol]*` route, in either phase | The fail-open contract is broken. `getSeoSnapshotsStatic` must degrade to `[]`, never throw. |
| §D2/§D3/§D4 `false` while §C/§D1 pass | The prose is in the HTML but **destroyed at hydration** — the Suspense-fallback regression. Googlebot's renderer would not see it. This invalidates the entire effort. |
| `DYNAMIC_SERVER_USAGE` in the build log, or any `[symbol]*` route showing `ƒ` instead of `●` | A snapshot read escaped `staticSymbolCache` and forced the route dynamic — breaks ISR and the cost model. |
| Snapshot section heading present with **no** prose (empty card / `전일 장마감 기준` alone) | Empty-shell regression: worse than the pre-fix baseline, and a thin-content signal in its own right. |
| §H4: `/NVDA` marked `index, follow` on a malformed row | Renderability gate broken — falsely indexes a thin degraded page. Exactly the failure mode that caused the impressions crash. |
| §H5: `/MSFT/congress` indexable off a `technical` row | Tab-scoping broken — same class of bug, one level up. |
| §E: both the snapshot prose **and** the client AI widget visible after hydration | Duplicate content on-page; the conclusion is rendered twice for users, screen readers, and crawlers. |
| §G3: the `*` group changed (lost `Allow: /`, or gained the image disallows) | Would apply the Googlebot-only image block to every crawler — collateral crawl damage. |
| §G2: the `Googlebot` group missing `Disallow: /api/` | robots.txt group exclusivity foot-gun: Googlebot doesn't inherit `*`, so the baseline must be replicated. |
| §F3: fewer than 7 distinct descriptions | The boilerplate-duplication problem is unfixed. |
| §D7: hydration mismatch errors around the prose | Server/client tree disagreement; unstable rendering. |
| §I: chart visibly compressed/clipped, or horizontal page scroll on mobile | Layout regression shipped alongside the SEO fix. |

---

## Result recording

Fill in as you go; the deltas in §C and the booleans in §D/§E/§H are the evidence that gets reported upward.

| Case | Result (PASS / FAIL / N/A) | Measured value / note |
|---|---|---|
| A1–A6 | | build EXIT, DSU count, SSG route count |
| B1–B6 | | unseeded visible-text per tab (7 numbers) |
| C1–C7 | | seeded visible-text per tab + **delta vs. unseeded** |
| C8 | | fear-greed narrative present? |
| C9 | | human vs. Googlebot text length |
| D1–D7 | | **hydrated-DOM booleans — the critical row** |
| E1–E8 | | prose/widget XOR per tab |
| F1–F6 | | 7 distinct descriptions? (`sort -u \| wc -l`) |
| G1–G6 | | |
| H1–H7 | | **H4 (malformed → noindex) is the critical row** |
| I1–I7 | | chart height Phase 1 vs Phase 2 |
| J1–J4 | | |

**Overall verdict**: PASS only if every ❌-listed condition is absent **and** §C shows a materially larger visible-text payload on all 7 tabs **and** §D confirms the prose survives hydration on all 7 tabs.

**Before you finish**: run the §0.5 teardown (`DELETE … WHERE symbol IN ('AAPL','MSFT','NVDA')` or `$COMPOSE down -v`), stop the `yarn start` server, and confirm you never issued a write against the Neon `DATABASE_URL`.
