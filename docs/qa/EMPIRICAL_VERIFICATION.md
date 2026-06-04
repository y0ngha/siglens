# 실증(Empirical) 프로세스

> **무언가를 적용/주장하기 전에 항상 실증하고 자료조사한다.** 추측-사이클을 돌지 않는다.
> 1차 증거(실측·trace·로그·코드)로 ground truth를 확보한 뒤 결론을 낸다.

---

## 1. 원칙

- **적용 전 실증**: 코드/설정을 바꾸기 전에, 그 변경이 옳다는 근거를 실측이나 자료조사로 확보한다.
- **주장 ≠ 사실**: 문서·리뷰봇·에이전트의 주장은 코드/런타임으로 **검증한 뒤** 반영한다.
- **추측 루프 금지**: 같은 가설로 빌드·재시도를 반복하지 말고, 한 번 멈춰 1차 증거를 확보한다.

---

## 2. 리뷰봇 주장 검증 (false-positive 다발)

이 레포의 리뷰봇(claude-code-review / Gemini)은 false-positive blocker를 자주 낸다. 프레임워크/사실
주장은 **문서 + 실측**으로 확인하고, 거짓이면 근거와 함께 PR 코멘트로 반려한다([PR_REVIEW_LOOP.md](./PR_REVIEW_LOOP.md)).

- 과거 false-positive 사례: force-static 단일 이미지, revalidate 리터럴 규칙 오해, env 누수 오탐,
  Hydration Mismatch(해당 컴포넌트가 `ssr:false`라 hydration 자체가 없음).
- **stale 인라인 식별**: 이미 수정된 항목을 봇이 다시 지적하기도 한다(이전 커밋 기준). 현재 코드와 대조.
- 무한 추격 금지: 봇이 같은 류를 반복 지적하면 근거로 일괄 반려하고 진행.

---

## 3. ground truth 확보 수단

- **Playwright trace.zip** — `0-trace.network`에 실제 요청/응답 헤더(Cookie/Set-Cookie 등)가 있다.
  6분짜리 E2E 사이클을 반복 추측하는 대신 trace로 root-cause를 실증한다.
- **빌드 로그 직접 캡처** — `yarn build | tail`은 빌드 실패를 exit 0으로 가린다.
  `> log 2>&1; echo $?`로 exit code를 직접 본다.
- **DB journal / 실제 쿼리** — prod 미변경 확인은 journal에 당일 엔트리 없음으로.
- **playwright-report 아티팩트** — error-context의 a11y 스냅샷 + 스크린샷으로 실패 시점 DOM을 본다.

---

## 4. CI 전용 flake 판별 절차

"로컬은 통과, CI만 실패"는 추측하지 말고 단계적으로 좁힌다.

1. **격리 단독 반복** — 실패 테스트만 N회 반복. 격리에서 안정적이면 단독 결함은 아님.
2. **로컬 full-suite** — 전체 스위트를 로컬에서 돌려 부하/상호작용으로 재현되는지.
3. **CI 차이 요인** — 위 둘이 통과인데 CI만 실패면 CI 머신 부하/타이밍 또는 pool 이슈.
   - 이 레포는 vitest `pool: vmThreads` 사용 — 워커 내 파일 간 `process.env` 누수 이력이 있다(과거 해결됨).
   - 부하 타이밍 flake의 전형: `findByText` 기본 1000ms를 CI에서 근소하게 초과(예: 1010ms).

**flake 수정은 race 원인을 타깃**한다(블라인드 timeout 상향 금지).
- *사례*: `useEffectEvent`로 등록되는 document keydown 리스너는 passive effect라, CI 부하에서 리스너
  부착 전 이벤트가 발사되면 유실된다. → 같은 effect 배치의 산물(예: dialog 포커스)을 기다려 부착을
  보장한 뒤 이벤트를 발사한다. (직접 핸들러인 버튼 클릭은 이 race가 없다.)

---

## 5. 잔존 시드 데이터 오염 주의

수동 검증에서 공유 docker DB에 시딩한 데이터(높은 priority 등)가 남으면, 그 데이터가 기존 E2E의
기대 데이터를 가려 **엉뚱한 실패**를 만든다. 검증 후 시드는 반드시 정리한다([QA_ENV_SETUP.md](./QA_ENV_SETUP.md) §7).
- *사례*: 수동 시딩한 마크다운 공지(priority 100)가 남아, priority 99로 시딩하는 기존 공지 E2E 3건이
  엉뚱한 공지를 보고 실패. 시드 삭제 후 정상화.
