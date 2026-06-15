# Financials Phase 7 — E2E (Playwright) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** financials 탭의 happy + worst(resilience) 경로를 Playwright E2E로 검증한다.

**Architecture:** 기존 E2E 스위트(Tier 1~4 + resilience, `workers:1`, HYBRID 백엔드, `E2E_TEST=1`) 패턴. `FakeFinancialStatementsProvider`(Phase 3) + `e2eCachedFinancials`/`E2E_FORCE_FINANCIALS_ERROR_COOKIE`(Phase 5)로 결정론적 구동.

**Tech Stack:** Playwright, vitest(이미 단위), `E2E_TEST=1 yarn build` + `yarn e2e`. **선행:** Phase 3·4·5·6 완료.

**상위 스펙:** §6(테스트). 메모리: project_e2e_suite_landed, feedback_e2e_*.

---

## Phase 0: 전제
- [ ] `cd /Users/y0ngha/Project/siglens-financials`. 기존 E2E 그린: `E2E_TEST=1 yarn build && yarn e2e --grep @smoke`(baseline). FakeFinancialStatementsProvider가 2년+ 행 반환 확인.

---

## Task 1: financials happy path spec

**Files:**
- Create: `e2e/financials.spec.ts`
- Test: 자체가 테스트

- [ ] **Step 1: spec 작성** — 시나리오:
```
- /[symbol]/financials 진입 → 탭 활성, h1 "재무제표"
- FinancialsScorecard SSR 노출(종합 등급 + 4축, JS 비활성에서도 보임 = SSR 확인)
- 손익/재무상태/현금흐름/성장 섹션 표 렌더(Fake 데이터 행)
- AI 분석: 폴링 후 done UI 노출(e2eCachedFinancials 캐시 히트로 즉시) 또는 skeleton→done
- 연간/분기 토글 동작(분기 선택 시 lazy fetch 후 표 갱신)
```
- [ ] **Step 2: 실행** — `E2E_TEST=1 yarn build && yarn e2e e2e/financials.spec.ts` → PASS
- [ ] **Step 3: Commit** `test(financials): add happy-path E2E spec`

---

## Task 2: worst / resilience spec

**Files:**
- Modify: `e2e/financials.spec.ts` (resilience describe)

- [ ] **Step 1: 시나리오 추가**
```
- AI 에러주입(E2E_FORCE_FINANCIALS_ERROR_COOKIE) → AiSummary 에러 UI, 단 스코어카드·표는 정상 SSR(분리 확인)
- 봇 UA(AI 봇 user-agent) → BotBlockedNotice 또는 AI 미트리거, 스코어카드·표는 노출(SEO 콘텐츠)
- 데이터 빈 심볼(Fake가 빈 반환하도록 특정 티커) → EmptySectionCard, scorecard grade 'F', 페이지 200(크래시 없음)
- 분기 토글 fetch 실패 → 토글 비활성 + 연간 유지
```
- [ ] **Step 2: 실행** → PASS. **Step 3: Commit** `test(financials): add resilience/worst-case E2E`

---

## Task 3: overall + chat 통합 E2E

**Files:**
- Modify: 기존 `e2e/overall.spec.ts` 또는 financials spec

- [ ] **Step 1~2:** overall 페이지에 재무 섹션(financialsBulletsKo) 노출 확인. chat 패널: financials 탭에서 챗 컨텍스트가 재무로 전환(질문 시 재무 맥락 응답 — Fake/stub 기반). → PASS
- [ ] **Step 3: Commit** `test(financials): E2E for overall financials section + chat context`

---

## Task 4: 전체 검증 + pre-push

- [ ] **Step 1:** 전체 E2E `E2E_TEST=1 yarn build && yarn e2e`(workers:1, 전 스위트 그린, financials flake 없음).
- [ ] **Step 2:** 단위+E2E 통합 `yarn test && yarn lint && yarn lint:style`. pre-push hook(full build+format:check+e2e) 통과 확인(메모리: --no-verify 금지).
- [ ] **Step 3: Commit (있으면)** + Phase 7 완료.

---

## Self-Review
- §6 E2E: happy(Task1) + worst(Task2) + 통합(Task3). FakeProvider·e2eCachedFinancials·FORCE cookie 사용.
- 메모리 교훈: workers:1, E2E_TEST build가 clientTest 실행, CI flake 시 trace 분석. SSR 분리(스코어카드 vs AI) 명시 검증.
