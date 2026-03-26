# PR Fix Flow

## When This Flow Applies

Triggered when the user's request contains a PR number and a fix intent —
e.g. `PR #17 코멘트 확인하고 수정해줘`, `#17 PR 코멘트 확인하고 수정해줘`, or any message combining `[PR, 수정, 확인, #{N}]`.

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