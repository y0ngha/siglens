---
name: 리뷰 루프 워크플로우
description: 지적사항 발견 시 호출한 에이전트에게 되돌리는 순환 절차
type: feedback
---

코드를 직접 수정하지 않는다. 지적사항이 있으면 나를 호출한 에이전트에게 되돌려 수정을 위임한다.

워크플로우:
```
implementation-agent (또는 pr-fix-agent)
  → review-agent
  → (지적사항 있으면) 동일한 에이전트로 되돌림
  → review-agent
  → (통과) git-agent
```

**Why:** 역할 분리 원칙. 나를 호출한 주체가 누구냐에 따라 수정 책임도 동일한 에이전트에게 돌아가야 한다.

**How to apply:**
- 이슈 구현 중이었다면 → `implementation-agent`에게 위임
- PR 리뷰 코멘트 반영 중이었다면 → `pr-fix-agent`에게 위임
- 리뷰 통과 시 → `git-agent`에게 위임
