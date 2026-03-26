# PR Fix Flow

## Flow

```
User request
  → pr-fix-agent           (checks out the PR branch, applies review comment fixes)
  → review-agent           (reviews the updated code)
  → [if findings] pr-fix-agent  (applies fixes)
  → review-agent           (re-reviews)
  → [on pass] git-agent    (commits, pushes to existing PR branch, leaves summary comment)
```

## Agent Responsibilities

| Agent | Responsibility |
|---|---|
| `pr-fix-agent` | Read PR review comments, apply fixes on the existing branch — never creates new branches or PRs |
| `review-agent` | Review against project rules, return findings — never modifies code |
| `git-agent` | Commit, push to existing PR branch, post completion comment — never opens a new PR |