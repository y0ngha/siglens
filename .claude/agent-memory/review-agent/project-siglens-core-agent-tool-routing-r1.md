---
name: project-siglens-core-agent-tool-routing-r1
description: siglens-core refactor/agent-tool-routing-prompt R1 — approved, no findings
metadata:
  type: project
---

Round 1 review of siglens-core worktree `refactor/agent-tool-routing-prompt` (3 files:
groundedNumbers.ts, buildAgentSystemPrompt.ts, tools.ts + 2 test files).

**groundedNumbers.ts fix**: `collectRegexNumbers` now also pushes `value * multiplier` when a
Korean unit char (만/억/조) immediately follows a tool-text number match, mirroring the
answer-side unit detection that already existed. Verified the math: `isGroundedWithUnit` divides
the tool number by the multiplier before rounding, so a tool string like "1,132억" previously
only contributed the raw `1132`, which never matched an answer token compared via `n/1e8`. Now
it also contributes `1132 * 1e8`, which correctly rounds to the answer's stripped digits. New
test cases would fail if the `out.push(value * multiplier)` line were reverted — verified by
reading (not just running) the assertions; also ran `yarn vitest run` live, 63/63 green.

**buildAgentSystemPrompt.ts / tools.ts restructure**: per-tool "when to call" wording moved into
tool descriptions (only 3 tools — get_quote, get_bars_indicators, get_news — actually lacked it;
the rest already had "Use for..." wording, so no sync gap). New `ROUTING_ROWS` table maps
question-type → required tool names, filtered by `available.has(t)` before rendering — checked
every `requires: [...]` entry against `AGENT_TOOL_SPECS` names via grep; no orphaned tool name in
any row. Old scattered `hasFundamentals`/`hasMarketOverview`/`hasEconomy`/`hasCongress` booleans
correctly replaced by a single `available: Set<string>`.

No findings. See [[feedback-cross-repo-resolution-claims-need-consumer-check]] for the general
pattern of not trusting cross-repo consumer claims — not applicable here since this PR doesn't
claim anything about siglens's consumption of these exports.
