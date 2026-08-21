---
name: extract-write-can-prune-preexisting-unrelated-keys
description: yarn i18n:extract --write regenerates the whole ko.json and can silently delete keys unrelated to your own change if an earlier session left a dynamic-key reference (including a ternary key argument, not just t(MAP[value])) unregistered in manualKeys.json — always diff the FULL key set before/after, not just your own additions.
metadata:
  type: reference
---

Found on `feat/i18n-multilingual` (siglens-i18n worktree, 2026-08-20) while
fixing 4 unrelated i18n leak defects and, per the task's own instructions,
running `yarn i18n:extract --write` at the end to verify zero key loss.

**What happened:** I added 3 new `shared.enumLabel` sub-groups (all covered
by the already-blanket-`preserve`d `shared.enumLabel` prefix in
`messages/_meta/manualKeys.json` — nesting under an *already-preserved
ancestor namespace* needs zero extra registration, no need to add the leaf
path too). Running `--write` afterward still dropped 4 KEYS I never touched:
`app.symbol.page.{newsSrOnlyEquity,newsSrOnlyCrypto,newsArticleDescEquity,
newsArticleDescCrypto}`. Root cause: an earlier (uncommitted, same-branch)
session had added `t(isEquity ? 'page.newsArticleDescEquity' :
'page.newsArticleDescCrypto', {...})` in `[symbol]/news/page.tsx` — a
**ternary as the key argument**. This is the same "key isn't a literal
string" class as `t(MAP[value])` but it's easy to miss because it doesn't
look like a lookup-table pattern; `collectReferencedKeys`'s regex only
matches `t\w*\(\s*'literal'`, so a ternary head is invisible to it too, and
nobody had registered those 4 keys in `manualKeys.preserve`. See
[[extract-mjs-dynamic-key-widening]] for the sibling `t(MAP[value])` gotcha.

**Lesson:** the task's "confirm zero loss" instruction means diff the full
key SET (`flatten(ko.json)` before vs after `--write`), not just grep for
your own new keys. If keys you never touched vanish, that's still your
problem to fix before finishing — leaving it broken fails the explicit
"zero loss" requirement, and you're the one who ran the command that
manifested a pre-existing latent bug (whether or not you introduced it).

**Recovery when the source KO text is genuinely gone with no git backup**
(uncommitted branch, no staged/HEAD copy exists): check whether any test you
ran *earlier in the same session* (before the `--write` that deleted it)
happened to dump the rendered tree/JSON containing the live KO value
(`JSON.stringify(tree)`-style assertions are a jackpot here) — that's a
verbatim recovery, not a reconstruction. For values you truly don't have
verbatim, `en.json`/`ja.json`/`zh.json` are **not** touched by `--write`
(only `ko.json` is regenerated), so triangulating a KO reconstruction from
3 independently-translated locales plus this file's existing phrasing
conventions is defensible — but disclose in the handoff which values were
verbatim-recovered vs reconstructed, and flag the reconstructed ones for a
native-speaker pass. Then register the newly-discovered dynamic-key paths in
`manualKeys.preserve` and re-run `--write` to confirm the count is now
stable (idempotent) before finishing.
