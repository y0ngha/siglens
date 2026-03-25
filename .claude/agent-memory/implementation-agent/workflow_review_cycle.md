---
name: 리뷰 루프 워크플로우
description: 구현 완료 후 review-agent와의 순환 검토 절차
type: feedback
---

구현 완료 후 반드시 review-agent를 호출하고, 지적사항이 있으면 다시 이 에이전트(implementation-agent)가 수정한다.

워크플로우:
```
implementation-agent → review-agent → (지적사항 있으면) implementation-agent → review-agent → (통과) git-agent
```

**Why:** review-agent는 코드를 직접 수정하지 않는다. 지적사항을 발견하면 항상 호출한 에이전트(여기선 implementation-agent)에게 되돌려 수정을 위임한다.

**How to apply:** review-agent 결과에 수정 사항이 있으면 직접 수정하고 다시 review-agent를 호출한다. 리뷰 통과 후 git-agent에 위임한다.
