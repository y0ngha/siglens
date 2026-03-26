---
name: Workflow
description: Iterative review procedure after implementation is complete
type: feedback
---

After implementation is complete, always invoke review-agent. If findings are returned, this agent (implementation-agent) applies the fixes directly.

Workflow:
```
implementation-agent → review-agent → (if findings) implementation-agent → review-agent → (on pass) git-agent
```

**Why:** review-agent never modifies code directly. When it finds issues, it always delegates fixes back to the calling agent (here, implementation-agent).

**How to apply:** If review-agent returns findings, fix them directly and re-invoke review-agent. Once the review passes, delegate to git-agent.