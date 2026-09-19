---
name: ai-about-page-r1-r2
description: feat/ai-about-page R1-R2 — worktree siglens-ai-about, /about landing page for ai.siglens.io
metadata:
  type: project
---

R1 found 3 findings (proxy.ts JSDoc drift, duplicate getAboutFaq call, 20x `t.raw(...) as string` repetition, missing non-default-locale test).
R2 verified all fixed: `tRaw` helper named deliberately (not `raw`) because `scripts/i18n/extract.mjs`'s
key-reference regex is `\bt\w*(?:\.(?:rich|markup|raw))?\(` — a helper literally named `raw` would not
match `t\w*` and previously caused `extract --write` to silently delete 25 answer keys from messages/*.json
(they were restored). Confirmed regex still matches `tRaw(` directly.

messages/{ko,en,ja,zh}.json `views.ai-about` key sets confirmed identical (137 keys each) via a flattening
script — worth reusing this technique (`node -e` walk + JSON.stringify(sorted) equality) whenever an i18n
finding claims "key set restored/matches".

Note: at R2, `git status -uall` showed additional unstaged modifications (messages/en.json, ja.json,
zh.json, aiSeo.ts, replayScript.ts, ChatReplay.tsx, ChatReplay.test.tsx, EmptyState.test.tsx) beyond the
orchestrator's `modified_files` list for this round. Did not review them since the round-2 instructions
explicitly scope to the given list — these are presumably round-1 files not touched in this fix pass.
Flagging here only as a note in case a later round needs to sanity-check they weren't silently changed
again without being listed.
