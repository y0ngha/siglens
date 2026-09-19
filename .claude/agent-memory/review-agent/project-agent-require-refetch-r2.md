---
name: project-agent-require-refetch-r2
description: feat/agent-require-refetch R2 — PUBLIC_API.md changelog row closed, verified against source
metadata:
  type: project
---

R1 flagged a missing changelog row for `CallAgentProviderOptions.toolChoice` and the
`TECHNICAL_RESPONSE_SCHEMA`/`reconciledLevels` removal. R2 fix added the 2026-09-19 row
(3rd for that date, after "Agent answer depth"). Verified against siglens-core-wt-refetch
source: `toolChoice: 'required'` appears in `runAgentTurn.ts:528` and
`agentProvider.ts:103`; `reconciledLevels` confirmed removed from
`TECHNICAL_RESPONSE_SCHEMA` in `responseSchemas.ts` (test at
`responseSchemas.test.ts:761` asserts `not.toContain('reconciledLevels')`). Approved.
