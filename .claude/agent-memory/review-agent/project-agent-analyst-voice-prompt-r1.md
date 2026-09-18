---
name: project-agent-analyst-voice-prompt-r1
description: siglens-core feat/agent-analyst-voice R1 — directional-analyst prompt rewrite, no internal contradictions found, missing PUBLIC_API.md changelog entry
metadata:
  type: project
---

Reviewed siglens-core worktree (/Users/y0ngha/Project/siglens-core-wt-voice, branch feat/agent-analyst-voice on refactor/agent-tool-routing-prompt) round 1. Change: "## What you are" section rewritten so the agent commits to a directional read, relays SIGLENS's own verdict/action rating/scenarios with attribution+timestamp, adapts vocabulary to user level, and holds its read under mere disagreement. AGENT_PROMPT_VERSION → 2026-09-17.1.

Verified no contradiction with Scope/Output/data-boundary sections: the "one-line caveat" embedded in a directional read (What-you-are) and the Output section's "no second closing disclaimer" rule are complementary, not duplicated. Sizing/stop/order-split/money-decision ban preserved verbatim in spirit (4 items named in one bullet, matches old scattered ban). buildSuggestionsPrompt.ts has its own separate "not investment advice" line — different prompt/feature, not required to sync.

Test quality: every new assertion (`Commit to a view whenever...`, `relay its verdict, action rating...`, `do not switch to agree with them`, etc.) quotes exact new phrasing that does not exist in the pre-change prompt — all would fail on revert (non-vacuous). Old assertions referencing replaced text ('not investment advice', 'never recommend position sizing', 'only when the user asks for a prediction or a buy/sell decision') were updated in the same diff, no stale duplicates left.

Only finding (recommended): this repo has a strict precedent (2026-09-13, 2026-09-15 entries in docs/PUBLIC_API.md) of logging every AGENT_PROMPT_VERSION bump in the PUBLIC_API.md changelog table since it's a Tier-1 public export (`src/index.ts` re-exports it). This diff bumps the version but does not add a changelog row — inconsistent with established convention, not a functional break.

See also [[project-deepseek-stall-gemini-fallback-r2-closed]] for the sibling changelog-row precedent this diff should follow.
