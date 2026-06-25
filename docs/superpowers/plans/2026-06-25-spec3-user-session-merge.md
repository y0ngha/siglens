# Spec-3 — entities user ⇄ session 사이클 해소 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** `entities/user` ⇄ `entities/session` import 사이클(deep-`lib/` 경로로만 acyclic 유지)을 해소하고, 해소 방식에 따라 ESLint `src/entities/*/lib/**` ignore 범위를 정밀화한다.

**Architecture:** **Phase 0(안 A 병합 vs 안 B 인정 결정)이 선결 게이트.** 결정에 따라 후속 Task가 갈리므로 그 전엔 상세 코드를 확정하지 않는다(추측 금지). ⚠️ `entities→entities` allow 룰 자체는 analysis 멀티엔티티 조합에 필요하므로 **제거 대상이 아니다** — Spec-3의 재봉인은 user/session 결합 제거 + ignore 범위 축소에 한정.

**Tech Stack:** Next.js 16, FSD, Drizzle, eslint-plugin-boundaries.

**Spec:** `docs/superpowers/specs/2026-06-25-user-session-merge-design.md`
**선행:** 메인 plan(PR1~8) 머지 후. Spec-2와 독립(병렬 가능하나 auth 영향 크니 순차 권장).

---

## Phase 0 — 방식 결정 (선결 게이트)

- [ ] **0-1. 현 결합 전수 캡처** — `entities/user/lib/* → @/entities/session/lib/{tokenUtils,sessionCookie}`(7파일)과 `entities/session/lib/getCurrentUser.ts:4 → @/entities/user` 실측 목록화.
- [ ] **0-2. 소비처 규모 측정** — `@/entities/user`(~28) / `@/entities/session`(~23) import 사이트 수 실측(병합 시 영향 범위).
- [ ] **0-3. 안 A(병합) vs 안 B(인정) 결정** — 사용자 확인:
  - **안 A**: `entities/auth`로 병합 → 사이클 근본 제거, barrel 사용 가능. 큰 이동.
  - **안 B**: deep-path 결합을 의도된 예외로 공식 문서화(ESLint 주석+CLAUDE.md). 저위험, 사이클 잔존.

> 결정 후 해당 분기만 실행. 아래는 분기별 윤곽.

## 분기 A — entities/auth 병합

- [ ] A-1. `entities/auth/` 생성, user+session 모듈 이전(model/api/lib/hooks). 내부 결합은 슬라이스 내부가 되어 cross-import 소멸.
- [ ] A-2. public API(`index.ts`) 재설계: client-safe(hooks) vs server-only(getCurrentUser, repos) 배럴 분리(메인 PR2의 server-only 원칙 준수).
- [ ] A-3. ~50 소비처 import 경로 갱신(`@/entities/user`·`@/entities/session` → `@/entities/auth`). 단계적 PR로 쪼개고 각 단계 전체 test+build+e2e(Tier 1~4 auth 커버).
- [ ] A-4. 재봉인(제한적): `entities→entities` 룰 **유지**(analysis 필요). `src/entities/*/lib/**` ignore에서 user↔session 결합분 소거 후, 잔존 entities lib cross-import 실측해 ignore 범위 축소.
- [ ] A-5. PR 리뷰 플로우(review-agent Opus 4.8).

## 분기 B — 결합 공식 인정

- [ ] B-1. `eslint.config.mjs`의 `src/entities/*/lib/**` ignore에 user↔session 의도 결합 사유 주석 보강. `entities/CLAUDE.md`에 의도적 예외로 명문화.
- [ ] B-2. 구조 변경 없음 → 게이트는 lint+test만. (사이클 잔존을 명시적으로 수용)

## 비범위

- 인증 정책/세션 수명/쿠키 동작 변경 없음.
