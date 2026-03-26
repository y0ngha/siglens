# Issue Implementation Flow

## When This Flow Applies

Triggered when the user's request contains an issue number and an implementation intent —
e.g. `이슈 #17 확인하고 구현해줘`, `#17 이슈 확인하고 구현해줘`, or any message combining `[이슈, 구현, 확인, #{N}]`.

## Flow

```
User request
  → implementation-agent   (implements the issue)
  → review-agent           (reviews the code)
  → [if findings] implementation-agent  (applies fixes)
  → review-agent           (re-reviews)
  → [on pass] git-agent    (commits, pushes, opens PR)
```

## Agent Responsibilities

| Agent | Responsibility |
|---|---|
| `implementation-agent` | Read the issue, implement code, write tests, run validation scripts |
| `review-agent` | Review against project rules, return findings — never modifies code |
| `git-agent` | Commit, push, create PR — never modifies code |