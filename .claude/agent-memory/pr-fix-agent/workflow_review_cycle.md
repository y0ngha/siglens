---
name: 리뷰 루프 워크플로우
description: PR 코멘트 수정 완료 후 review-agent와의 순환 검토 절차 및 git 작업 위임 규칙
type: feedback
---

수정 완료 후 반드시 review-agent를 호출하고, 지적사항이 있으면 다시 이 에이전트(pr-fix-agent)가 수정한다.

워크플로우:
```
pr-fix-agent → review-agent → (지적사항 있으면) pr-fix-agent → review-agent → (통과) git-agent
```

**Why:** review-agent는 코드를 직접 수정하지 않는다. 지적사항을 발견하면 항상 호출한 에이전트(여기선 pr-fix-agent)에게 되돌려 수정을 위임한다.

**How to apply:** review-agent 결과에 수정 사항이 있으면 직접 수정하고 다시 review-agent를 호출한다. 리뷰 통과 후 git-agent에 위임한다.

## Git 작업 위임 규칙

push, 브랜치 관리 등 모든 git 작업은 직접 처리하지 않고 반드시 git-agent에게 위임한다.

**Why:** 각 에이전트는 역할이 분리되어 있으며, git 작업은 git-agent의 전담 영역이다.

**How to apply:** 커밋 후 push가 필요하면 git-agent를 호출하여 위임한다. 사용자에게 직접 push하라고 요청하지 않는다.
