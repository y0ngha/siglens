# Financials 실행 프로토콜 — 7 Phase 공통 (PR 리뷰 자동 반영 + 다음 Phase 자동 진행)

> 모든 Phase(1~7)에 동일 적용. 사용자 지시(2026-06-15) 고정.

## 레포 매핑

| Phase | 레포 | 워크트리 | PR 대상 |
|---|---|---|---|
| 1, 2 | siglens-core (`/Users/y0ngha/Project/siglens-core`) | `siglens-core-financials` | siglens-core 레포 |
| 3, 4, 5, 6, 7 | siglens (`/Users/y0ngha/Project/siglens`) | `siglens-financials` | siglens 레포 |

- **core(1·2) 머지·릴리스는 사용자 담당**(메모리). 머지 후 `yarn build` 산출물을 siglens 워크트리 `node_modules/@y0ngha/siglens-core/dist`에 **overlay**해 릴리스 전 병목 최소화. 최종 배포 시 사용자가 core tag 릴리스 → siglens `package.json` 핀 갱신.
- siglens(3~7) 각 Phase는 master 기준 워크트리 재분리 → 구현 → PR → 리뷰 루프 → 머지 → 다음 Phase.

## Phase별 사이클

### 1. 구현 (subagent-driven)
- 해당 Phase plan을 task 단위로 subagent dispatch. task 간 2-stage 리뷰.
- TDD(실패 테스트→구현→통과→커밋), 커버리지 ≥90%, happy+worst.

### 2. 구현 완료 → 리뷰 에이전트 (Opus 4.8)
- **`Agent(subagent_type: 'review-agent', model: 'opus')`** 로 spawn (Opus 4.8). 영어 프롬프트, modified_files 전달.
- `changes_requested`면 **내가 직접** 수정 → review-agent 재invoke(round++). `approved`면 다음.
- `loop_limit_reached`면 사용자 보고·중단.

### 3. git-agent → PR 생성
- review approved 후 `mistake-managing-agent` → `git-agent`로 커밋·푸시·PR 생성.
- push 반영은 `git ls-remote`로 검증(메모리: pre-push hook timeout 오보 주의).
- 일반 머지 정책(squash 아님, `--merge`; branch protection 시 `--admin`).

### 4. PR 리뷰 자동 반영 (백그라운드 모니터)
- PR 생성 후 **백그라운드 모니터**로 GitHub API 폴링: claude-code-review Action(+최초 1회 Gemini) review 상태.
- 리뷰 없으면 **60초 간격, 최대 20분** 폴링. 모니터는 MAIN 세션에 리뷰 내용을 응답 형식으로 전달.
- 리뷰 완료 시(Changes Requested 또는 Approved with comments):
  - **모든 코멘트**(Blocker/Suggestion/Question 구분 없이, Gemini 포함) 수집.
  - 각 코멘트 **의도 해석** 후 해당 파일/라인 수정(텍스트 붙여넣기 금지). 리뷰 봇 false-positive는 문서·실측으로 검증 후 거짓이면 반려(메모리: feedback_verify_review_bot_claims).
  - 수정 불가/판단 필요는 건너뛰고 이유 출력. 코멘트 충돌 시 사용자에게 질문.
  - 회귀(이전 라운드 수정 재유입) 발견 시 **조용히 고치지 말고 사용자에게 먼저 보고**(메모리).
  - 수정 커밋·같은 브랜치 푸시.
- **분기**:
  - **Changes Requested**: 수정 후 PR Draft 토글 → 즉시 Ready(re-review 트리거). 재리뷰 대기(루프). APPROVED까지 반복.
  - **Approved (with Suggestion/Question)**: Suggestion·Question 모두 확인·수정 후 **토글하지 않음**(무한 추격 방지). 수정 push 후 **모니터 종료**.

### 5. 모니터 종료 조건
- PR Approved(코멘트 반영 완료) / Merged / Closed → 모니터 제외.

### 6. 머지 → 다음 Phase
- master(또는 core main) 머지 확인(`git ls-remote`/PR state). 미머지면 머지(리뷰 미완 시 4번 따름). core는 사용자 머지 대기.
- 머지 확인 후 **다음 Phase**: master 기준 워크트리 재분리 → 구현 → 본 사이클 반복.

## Phase 의존 순서

```
Phase1(core) ─┐
Phase2(core) ─┴→ [사용자 머지 + core build overlay] ─→ Phase3(siglens)
Phase3 → Phase4 → Phase5 → Phase6 → Phase7   (각 master 머지 후 다음)
```
- Phase 1·2는 core 레포라 함께 PR(또는 순차). siglens Phase는 core export에 의존 → core overlay 선행 필수.
- Phase 4는 Phase 3(provider), Phase 5는 Phase 2(chat kind)+Phase 4(페이지), Phase 6은 Phase 2(overall)+Phase 4·5, Phase 7은 전부에 의존.

## 주의 (메모리 반영)
- `--no-verify` 금지(pre-push=CI 게이트). 막히면 재시도/STOP·보고.
- 워크트리 node_modules는 `cp -al` 하드링크(symlink 금지) + 잔여 `node_modules/node_modules` 제거. core 버전 불일치 시 `rm -rf node_modules && yarn install`.
- 빌드 exit code는 파이프 없이 직접 캡처. E2E build는 clientTest 실행.
- 리뷰 에이전트는 항상 Opus 4.8.
