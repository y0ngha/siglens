---
name: project-core-agent-adaptive-depth-r2
description: siglens-core feat/agent-adaptive-depth R2 — approved; both R1 findings fixed and mutation-verified
metadata:
  type: project
---

R2 (2026-09-19), uncommitted worktree `/Users/y0ngha/Project/siglens-core-wt-depth`. Result: approved.

R1 found: null-confluence handled only at the Detailed level in `buildAgentSystemPrompt.ts`'s rule
lines (Plain level had no fallback, could guess agreement); missing PUBLIC_API.md changelog row for
`AGENT_PROMPT_VERSION` bump to `2026-09-19.3`.

R2 fix: the rule line now says "If it is null, never guess an agreement: at both levels say briefly
that the trading history is too short for this indicator tally." New test asserts both phrases are
in the static prompt text. Mutation-verified: stripped the null-handling clause from source with
`sed`, re-ran `./node_modules/.bin/vitest run <file>` — the new test failed as expected, then
restored the file and confirmed `git diff --name-only` still matches the 3 modified_files exactly
(no stray residue from the mutation edit). PUBLIC_API row for 2026-09-19 (`.3`) is present, well
formed, and last in the changelog table.
