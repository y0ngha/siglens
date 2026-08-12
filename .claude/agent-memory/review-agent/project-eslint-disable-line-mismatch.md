---
name: project-eslint-disable-line-mismatch
description: eslint-disable-next-line can silently fail to suppress its target when placed above the wrong line (e.g. above a deps array instead of the hook call reporting the warning) — verify gate claims by re-running eslint, don't trust the reported summary
metadata:
  type: project
---

Round 3 of `fix/chat-context-snapshot-gate` (symbol-chat dispatch-context split, PR context:
[[project-crypto-assetclass-session]] unrelated) reported "eslint 0 errors, 2 warnings, both
pre-existing" for the round. Re-running `npx eslint` on the modified files showed those 2
warnings were both freshly introduced by the new `publishLoop.test.tsx` guard test, not
pre-existing:

- `react-hooks/exhaustive-deps` still fired at the `useMemo(...)` call site (the line with the
  callback), because the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment was
  placed directly above the `[analysisState]` deps-array line instead of above the `useMemo<...>`
  call itself. ESLint anchors this rule's report to the hook call, not the deps array line.
- That produced a second, cascading "Unused eslint-disable directive" warning at the disable
  comment's own line.

Confirmed via `eslint --format json`: `suppressedMessages` showed the *other* disable comment in
the same file (`react-hooks/globals`, placed correctly one line above the mutation) worked as
intended — so this is a placement bug, not a project/config issue.

**Why:** implementer's round summary claims about lint/test gate results are not reliable without
independent verification — this is the same category of risk as [[feedback_verify_review_bot_claims]]
but in the other direction (a *clean* claim that was actually dirty).

**How to apply:** when a round's summary claims specific warning counts or "pre-existing", spot-check
by running the lint/typecheck command directly on the modified files rather than trusting the
narrative — especially when the round adds new eslint-disable comments near multi-line hook calls
(deps array vs. call site is the common split point for `exhaustive-deps`).
