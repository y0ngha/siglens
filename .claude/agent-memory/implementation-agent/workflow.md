# Issue Implementation Flow

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