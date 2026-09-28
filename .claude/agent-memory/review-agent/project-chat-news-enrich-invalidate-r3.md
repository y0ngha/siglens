---
name: project-chat-news-enrich-invalidate-r3
description: R3 of fix/chat-news-enrich-and-invalidate — sync news enrichment landed inside get_news's 30s core tool timeout; stale contract JSDoc; STALE_FRESHNESS_DETAIL_LIMIT zero coverage
metadata:
  type: project
---

Branch `fix/chat-news-enrich-and-invalidate` (worktree siglens-fmp-guard), round 3.
Design change between R2 and R3: enrichment of newly ingested articles became **synchronous**
(awaited before `get_news` reads the DB), capped at `CHAT_SYNC_NEWS_CARD_LIMIT` (=4 = one
`NEWS_CARD_ANALYSIS_PARALLEL_LIMIT` chunk); the remainder stays in `after()`.

**Blocking finding — the sync LLM call has no bound, and it lives inside a 30s tool timeout.**
`get_news` has core `costClass: 'free'` → `TOOL_TIMEOUT_MS.free = 30_000`
(`dist/domain/agent/tools.js`, `dist/application/agent/limits.js`). `runAgentTurn.executeOne`
wraps every executor in `withTimeout(...)`; on overrun the model gets `{error:'timeout'}` and the
whole news answer is lost — strictly worse than the pre-change behaviour (unenriched rows still
rendered). No timeout exists anywhere below: `analyzeNewsCards` passes no `signal`,
`runNewsCardAnalysis` → `NEWS_CARD_MODEL_ID = GEMINI_FLASH_LITE`, and the Gemini adapter has only
`GEMINI_TIMEOUT_MS = 3_600_000` with **no stall watchdog** (only DeepSeek has
`DEEPSEEK_STALL_TIMEOUT_MS = 90s`); `withRetry` allows 5 attempts under a 240s wall-clock budget.
Measured happy path 3.2s ingest + 2.86s enrich ≈ 6s of 30s.
Repo already owns the countermeasure pattern: `quoteWithTimeout`/`QUOTE_LOOKUP_TIMEOUT_MS` and
`HUB_UNIT_TIMEOUT_MS` — MISTAKES §6.7 (guard applied to one of N siblings).
Amplifier: `run_fresh_analysis` calls the same gate **inside** the `MAX_CONCURRENT_FRESH` slot and
`registerActiveStream()` handle, and `withTimeout` abandons rather than cancels, so a stalled card
pins a slot well past the 300s expensive-tool timeout.
SSE is *not* a constraint — `agentEventStream` heartbeats on an independent `setInterval`.

**Stale doc:** the `## 계약` bullet at `ensureSymbolDataFresh.ts:42-47` ("카드 보강은 여기서 하지
않는다. 백그라운드로 띄우지도 않는다") is inherited verbatim from master and is now false in both
halves. R2 item 13 rewrote the `scheduleEnrichAndRevalidate` section and missed this one.

**Mutation results (scratch copy: rsync src, symlink node_modules, `./node_modules/.bin/vitest`).**
Killed: sync-batch→0, leftover→all, sync try/catch removal, trust-all-kinds, drop-technical,
stale→false, source→fresh, gate-all-kinds, gate-off, `FUNDAMENTAL_CACHE_LAYERS` 2→1,
`staleFreshnessOrNull` always-return, priceFreshness-never-attached.
**Survived:** `STALE_FRESHNESS_DETAIL_LIMIT` 5→999; deleting `stalePriceCount` entirely;
oldest-first sort reversed; adding `'news'` to `GENERATED_AT_TRUSTWORTHY_KINDS` (the news fixture
carries no `analyzedAt`, so that per-kind test can never fail on the kind gate — the same
unfalsifiable-fixture trap as asset-class-nav R5).

Core claims all verified in dist: `filterAnalysisResult` copies `analyzedAt`;
`normalizeOverall` passes it through; `normalizeOptions` overwrites with `now`;
`NewsAnalysisResponse` has no `analyzedAt` field.
