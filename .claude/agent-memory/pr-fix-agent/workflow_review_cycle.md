---
name: Workflow
description: Iterative review procedure after PR review comment fixes are complete
type: feedback
---

After fixes are complete, always invoke review-agent. If findings are returned, this agent (pr-fix-agent) applies the fixes directly.

Workflow:
```
pr-fix-agent → review-agent → (if findings) pr-fix-agent → review-agent → (on pass) git-agent
```

**Why:** review-agent never modifies code directly. When it finds issues, it always delegates fixes back to the calling agent (here, pr-fix-agent).

**How to apply:** If review-agent returns findings, fix them directly and re-invoke review-agent. Once the review passes, delegate to git-agent.