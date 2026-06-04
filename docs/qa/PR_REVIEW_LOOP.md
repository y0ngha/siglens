# PR 리뷰 수정 루프 (외부 리뷰봇 자동 반영)

> PR 생성 후 외부 리뷰봇(claude-code-review GitHub Action + Gemini)의 코멘트를 자동으로 반영하고
> 머지까지 가는 루프. 내부 에이전트 라우팅(review-agent/mistake-managing-agent/git-agent)은
> [../workflows/PR_FIX_FLOW.md](../workflows/PR_FIX_FLOW.md)를 따른다(여기서는 외부 봇 루프만 다룬다).

---

## 1. 루프 개요

```
PR 생성/푸시
  → claude-code-review Action 실행 (PR opened/ready_for_review/reopened 트리거)
  → 백그라운드 모니터로 리뷰 결과 폴링 (60s 간격, 최대 ~20min)
  → 코멘트 전수 확인 → 검증 → 반영/반려
      ├─ Changes Requested  → 수정 후 Draft ↔ Ready 토글로 재리뷰 트리거 → 재폴링
      └─ Approved           → 열린 Suggestion/Question까지 반영 → 머지
```

---

## 2. 코멘트 처리 규칙

- **전수 확인**: Blocker/Suggestion/Question을 빠짐없이 확인. Approved여도 Suggestion·Question은 반영 검토.
- **검증 후 반영**: 각 주장을 코드/문서로 확인([EMPIRICAL_VERIFICATION.md](./EMPIRICAL_VERIFICATION.md)).
  - 유효 → 반영.
  - false-positive → 근거와 함께 PR 코멘트로 **반려**.
  - stale(이미 수정됨) → 현재 코드로 확인 후 "이미 반영됨" 표기.
- **회귀 발견 시**: 조용히 고치지 말고 사용자에게 먼저 보고(어느 라운드가 원인인지 포함).

---

## 3. 재리뷰 트리거 (Draft ↔ Ready 토글)

claude-code-review는 `pull_request: [opened, ready_for_review, reopened]`에 트리거된다. 같은 PR을
다시 리뷰받으려면 **Draft로 내렸다가 즉시 Ready for Review로** 되돌린다(스크립트: `scripts/pr_toggle_ready.sh <PR>`).

---

## 4. 머지 규칙

- **APPROVED 전 머지 금지.** Changes Requested 반영 후엔 재리뷰 → APPROVED 확인 후에만.
- 병합은 **일반 merge**(`gh pr merge <PR> --merge`) — squash 아님. branch protection 차단 시 `--admin`.
- **push 반영 검증**: git-agent의 push 성공 보고를 그대로 믿지 말고 `git ls-remote origin <branch>`로
  remote SHA를 직접 확인한다(pre-push hook의 full build가 timeout으로 오보를 낼 수 있음).

---

## 5. CI 실패 대응

PR의 CI가 실패하면 **원인을 분류**한다.

- **실제 회귀** → 수정.
- **flake** → [EMPIRICAL_VERIFICATION.md](./EMPIRICAL_VERIFICATION.md) §4 절차로 입증한 뒤 race를 타깃 수정.
- pre-push hook 게이트 = CI와 동일(format/lint/typecheck/test/build). e2e는 `SIGLENS_RELEASE_E2E=1`일
  때만. `--no-verify`는 사용자 허락 없이 금지(우회하면 CI에서 터진다).

> 토글 없이 곧장 머지해도 되는 경우(사용자가 "토글 불필요, CI 통과 확인 후 머지"라고 지시): 수정 push →
> CI(ci/e2e) 폴링 → 전부 pass + reviewDecision APPROVED 확인 → `--merge`.
