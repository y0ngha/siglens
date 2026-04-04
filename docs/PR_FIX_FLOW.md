# PR Fix Flow

## Orchestration Rules

You (the main orchestrator) own this workflow end-to-end.
Invoke agents one at a time, read their exit signal, and route accordingly.
Never ask the user "shall I proceed?" between steps — route automatically.

### Routing Table

| Signal received | Next action |
|---|---|
| `pr-fix-agent` · `status: done` | Invoke `mistake-managing-agent` |
| `mistake-managing-agent` · `status: done` | Invoke `git-agent` |
| `git-agent` · `status: done` | Report completion to user and stop |
| Any · `status: failed` | Stop and report the failure reason to user |

---

## Step-by-Step Flow

### Step 1 — Invoke pr-fix-agent

```
"PR #{N}의 리뷰 코멘트를 확인하고 수정해줘."
```

Wait for exit signal.

```
status: done   → proceed to Step 2
status: failed → stop, report to user
```

### Step 2 — Invoke mistake-managing-agent

```
"docs/__agents_only__/fix-log.md를 읽고 반복 위반 패턴을 MISTAKES.md에 반영해줘."
```

Wait for exit signal.

```
status: done   → proceed to Step 3
status: failed → stop, report to user
```

### Step 3 — Invoke git-agent

```
"PR #{N} 브랜치 {branch}에 수정사항을 커밋하고 푸시해줘."
```

Wait for exit signal.

```
status: done   → report completion to user and stop
status: failed → stop, report to user
```
