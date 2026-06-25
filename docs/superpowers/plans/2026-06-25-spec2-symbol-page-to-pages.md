# Spec-2 — symbol-page → pages 레이어 승격 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** `symbol-page` ⇄ `analysis` 양방향 위젯 사이클과 9-위젯 fan-in을 FSD `pages`(실디렉토리 미정) 레이어로 composition root를 올려 해소하고, 해소 후 ESLint `widgets→widgets` 예외를 재봉인한다.

**Architecture:** 순수 구조 이동(렌더/동작 불변). 단계적 PR. **Phase 0(네이밍 충돌 실증)이 모든 후속의 선결 게이트** — 결과에 따라 디렉토리·boundaries pattern이 확정되므로 그 전엔 후속 Phase의 상세 코드를 확정하지 않는다(추측 금지).

**Tech Stack:** Next.js 16 App Router, FSD, eslint-plugin-boundaries.

**Spec:** `docs/superpowers/specs/2026-06-25-symbol-page-to-pages-layer-design.md`
**선행:** 메인 plan(PR1~8) 전부 머지 후 착수.

---

## Phase 0 — 네이밍 충돌 실증 (선결 게이트, 추측 금지)

- [ ] **0-1. Next.js 라우팅 모드 확인** — `src/app`이 App Router임을 확인하고, `src/pages/` 추가 시 Pages Router가 활성화되는지 **실측**: 빈 `src/pages/_probe.tsx` 추가 → `yarn build` → Pages Router 활성/충돌 로그 확인 → 제거.
- [ ] **0-2. 디렉토리 네이밍 확정** — 충돌하면 FSD pages 레이어 실디렉토리를 `src/views/`(또는 `src/screens/`)로 결정. `eslint.config.mjs:119`의 `{ type: 'pages', pattern: 'src/pages/*' }`를 확정 디렉토리로 갱신.
- [ ] **0-3. 다른 widget↔widget import 전수 조사** — symbol-page 외에 widget→widget import가 있는지 `grep -rn "from '@/widgets/" src/widgets`로 실측. 있으면(news 패밀리 등) 재봉인 범위에서 제외 처리 결정.
- [ ] **0-4. 현 의존 그래프 캡처** — `symbol-page` 소비처(9 위젯 fan-in)와 `analysis → symbol-page` 역방향 import 지점을 목록화(이후 Phase의 정확한 대상).

> Phase 0 산출물(확정 디렉토리명 + 대상 목록)이 나온 뒤에만 Phase 1+ 상세 Task를 확정한다. 아래는 Phase 0 결과에 종속된 **작업 윤곽**이다.

## Phase 1 — pages 레이어 스캐폴드

- [ ] 확정 디렉토리(예 `src/views/symbol/`) 생성 + `index.ts` barrel. boundaries `pages` element pattern 갱신 확인.
- [ ] 게이트: `yarn build`+`yarn lint`(boundaries 규칙 인식) green.

## Phase 2 — composition root + context 이동

- [ ] `SymbolPageProvider`/`useSymbolPageContext`를 widgets/symbol-page → pages 레이어로 이동. barrel/소비처 import 갱신(순수 경로 이동).
- [ ] 게이트: 전체 test+build, 렌더 트리·context 값 불변 확인.

## Phase 3 — 역방향 import 제거

- [ ] `analysis → symbol-page` 역참조(`AnalysisPanel.tsx:33`, `AnalysisProgress.tsx`, `AnalysisToast.tsx`) 제거: context를 pages 레이어에서 하향 주입(props 또는 레이어 provider).
- [ ] 게이트: 전체 test+build.

## Phase 4 — fan-in 재배치

- [ ] 9 위젯이 symbol-page barrel에서 deep-path로 끌던 공통 hook(`useDefaultModelId`/`useBars`/`useAssetInfo`)의 소유권 재배치(다수 공유 → entities/shared 또는 pages context). widget→widget import 소거.
- [ ] 게이트: 전체 test+build.

## Phase 5 — ESLint 재봉인

- [ ] `eslint.config.mjs:146-153`의 `from: { type: 'widgets' }, allow`에서 `{ to: { type: 'widgets' } }` 제거.
- [ ] `no-restricted-imports`의 `src/widgets/**` ignore(212-214행) 제거 또는 최소화. (Phase 0-3에서 잔존 widget↔widget import 없음 확인 전제)
- [ ] 게이트: `yarn lint`가 위반 0으로 통과(재봉인이 실제 잡히는지 = 의도된 위반 1건 임시 삽입 후 error 확인 → 되돌림).
- [ ] PR 리뷰 플로우(review-agent Opus 4.8 → 자동 반영 → 머지).

## 비범위

- 기능/렌더 변경 없음. 순수 레이어 재배치 + 룰 재봉인.
