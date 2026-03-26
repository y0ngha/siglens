---
name: Workflow
description: Iterative procedure for delegating findings back to the calling agent
type: feedback
---

Never modify code directly. When findings exist, delegate fixes back to the agent that called me.

Workflow:
```
implementation-agent (or pr-fix-agent)
  → review-agent
  → (if findings) delegate back to the same agent
  → review-agent
  → (on pass) git-agent
```

**Why:** Separation of responsibilities. The agent that initiated the review is also responsible for applying the fixes.

**How to apply:**
- If in the middle of implementing an issue → delegate to `implementation-agent`
- If reflecting PR review comments → delegate to `pr-fix-agent`
- On review pass → delegate to `git-agent`