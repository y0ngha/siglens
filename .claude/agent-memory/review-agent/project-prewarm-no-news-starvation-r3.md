---
name: prewarm-no-news-starvation-r3
description: R3 of fix/prewarm-no-news-starvation — core 1.14.0 no_news abstention verified in dist; all 7 R2 fixes mutation-killed; residual = 6 stale comments/docs still describing the pre-1.14.0 overall behavior
metadata:
  type: project
---

Branch `fix/prewarm-no-news-starvation` (worktree `/Users/y0ngha/Project/siglens-fmp-guard`), round 3.
No blocking findings; code is correct. Residual is doc/comment drift only.

Verified in `node_modules/@y0ngha/siglens-core/dist/application/overall/runOverallAnalysis.js` (1.14.0):
`newsAxisAbsent = newsResult.status==='error' && newsResult.code==='no_news'` gates BOTH the
`axis:'news'` early return and the later `newsData===null` guard. So overall genuinely abstains —
the `tab === 'news'` narrowing of the 24h tier is correct.

Mutations run in a `cp -al` scratch copy (`./node_modules/.bin/vitest run <file>`) — **all killed**:
memo `.then(()=>undefined)` (drop onRejected), drop `tab==='news'`, re-add `axis==='news'` overall
branch, drop `newsFetchFailed!==true`, replace `!hasAnalyzableNews(...)` with `true`,
drop `await runtime.ensureSymbolData(symbol)` in getNews, `QUOTE_MAX_AGE_MS` 14d→30d.

Note: `cp -al` + `perl -0pi` breaks the hardlink (new inode) — safe for read-only review. Verify with `ls -i`.

Surviving/untested: the `(never)` suffix-omission branch when `missingTabs` is empty
(`logStarvationWatch`) has no test — all starvation tests use a non-empty tab list.

Stale comments found (all assert the pre-1.14.0 "overall loses the no_news code / requires the news axis"):
`hasAnalyzableNews.ts:7`, `harvest.ts:71`, `harvest.ts:255` (self-contradicts its own inline comment
9 lines below), `lock.ts:42`, `docs/reference/CRON.md:88`. Plus `index.ts:43` still says
`run_fresh_analysis` calls `ensureSymbolData` for kind news/overall — the gate was removed from that tool.

Related: [[prewarm-no-news-starvation-r2]], [[project-core-overall-optional-news-axis-r4]].
