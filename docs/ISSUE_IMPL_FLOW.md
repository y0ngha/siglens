# Issue Implementation Flow

## Orchestration Rules

You (the main orchestrator) own this workflow end-to-end.
Invoke agents one at a time, read their exit signal, and route accordingly.
Never ask the user "shall I proceed?" between steps — route automatically.

### Routing Table

| Signal received | Next action |
|---|---|
| `implementation-agent` · `status: done` | Invoke `review-agent` (round 1) |
| `review-agent` · `status: approved` | Invoke `git-agent` |
| `review-agent` · `status: changes_requested` | Invoke `implementation-agent` with findings (Type B) |
| `review-agent` · `status: loop_limit_reached` | Stop and report to user |
| `git-agent` · `status: done` | Report PR URL to user and stop |
| Any · `status: failed` | Stop and report the failure reason to user |

---

## Step-by-Step Flow

### Step 1 — Invoke implementation-agent (Type A)

```
"이슈 #{N}을 구현해줘."
```

Wait for exit signal.

```
status: done   → proceed to Step 2
status: failed → stop, report to user
```

### Step 2 — Invoke review-agent (round 1)

```
"현재 브랜치 {branch}의 코드를 리뷰해줘. 이번이 1라운드야."
```

Wait for exit signal.

```
status: approved           → proceed to Step 3
status: changes_requested  → proceed to Step 2a
status: loop_limit_reached → stop, report to user
```

#### Step 2a — Findings exist: invoke implementation-agent (Type B)

```
"리뷰 결과 수정이 필요해. 이슈를 다시 읽지 말고 아래 findings만 수정해줘.
브랜치: {branch}
findings: {findings JSON from review-agent}"
```

Wait for exit signal.

```
status: done   → return to Step 2 with round incremented by 1
status: failed → stop, report to user
```

**Round tracking:** pass the incremented round number each time review-agent is invoked.
```
1st review → "이번이 1라운드야"
2nd review → "이번이 2라운드야"
3rd review → "이번이 3라운드야"
```

### Step 3 — Invoke git-agent (Case 1)

```
"브랜치 {branch}의 구현을 커밋하고 PR을 열어줘. 이슈 제목: {issue title}"
```

Wait for exit signal.

```
status: done   → report pr_url to user and stop
status: failed → stop, report to user
```