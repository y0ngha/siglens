# 포지션 빌딩 재설계 — Implementation Plan

> REQUIRED SUB-SKILL: subagent-driven-development. 태스크별 fresh subagent + 2단계 리뷰.
> Spec: docs/superpowers/specs/2026-07-18-position-building-redesign-design.md (rev.1)
> Branch: feat/position-building-redesign (옵션 A: C 위 스택, combined net diff 리뷰)

**Goal:** B의 세로 밴드 "내 위치"를 SVG 아이소메트릭 빌딩으로 재설계하고, 분석 페이지에서 제거해 심볼 탭 `[symbol]/position` + 회원 `/portfolio`로 이전. 모바일 정합 + C 배지 모바일.

**Tech:** Next.js 16 FSD, SVG(순수, 외부 3D 의존성 없음), React Query, Tailwind v4 토큰. `computePosition`(순수 기하) 재사용.

---

### Task 1: PositionBuilding (SVG 아이소메트릭 컴포넌트)
- Create: `src/widgets/portfolio-position/ui/PositionBuilding.tsx`
- Test: `src/widgets/portfolio-position/__tests__/PositionBuilding.test.tsx`
- frontend-design → web-design-guidelines 스킬 적용.
- props `{ symbol, model: PositionModel, low52w, high52w, current, avg, className? }`. PositionGauge idiom 계승: viewBox + role="img" + aria-label(buildAriaLabel 재사용/이식), BAND_TOKENS 톤, IN_SVG_COMPACT_THRESHOLD 축약, DODGE, outOfRangeNote.
- 아이소메트릭 빌딩: 면(face)만 skew 폴리곤, **층 라벨·★평단·●현재 마커 텍스트는 평평한 upright `<text>`**. 5밴드=층 그룹. avg=★, current=●. avgClamped·currentClamped **둘 다** 옥상(하늘)/지하 처리. 마커 같은 층 dodge. 수익/손실 색+라벨(위치 서술만, good/bad entry 금지). data-testid로 층/마커 테스트.
- null model → 미렌더(호출부 가드).

### Task 2: 위젯 정리 (Gauge/Section 제거, barrel/Card 정비)
- Remove: `ui/PositionGauge.tsx`, `ui/PositionSection.tsx`, `ui/PositionSectionMounted.tsx` + 각 테스트.
- Modify: `ui/PositionCard.tsx`(readout 재사용 유지), `index.ts`(PositionBuilding·PositionCard·computePosition export, Gauge/Section export 제거).
- grep로 옛 export 소비처 0 확인.

### Task 3: 분석 페이지에서 제거
- Modify: `src/views/symbol/ChartContent.tsx` — PositionSectionMounted(240·259) + import 제거. **고아 `facts` useMemo(214–217)+buildTechnicalFacts import+dep 항목 제거**(lint no-unused). mobile sheet/useMemo 정비.
- Test: ChartContent 회귀 — 분석 페이지에 위치 위젯·facts 부재.

### Task 4: 심볼 탭 [symbol]/position ("내 위치")
- Create: `src/app/[symbol]/position/page.tsx`(+ generateMetadata noindex, crypto parity), 개인화 client island(lazy + hydration+user 게이트).
- Modify: `TabKey`(shared/config/marketProfile/types.ts) + `TABS`(symbolTabsConfig) + profile tabs(usEquity.ts, crypto.ts) + `isTabAllowedForSymbol` + SymbolTabs.
- 서버 데이터 = `getBarsStatic`→buildTechnicalFacts(cookies 없음). 회원+보유→★빌딩, 비회원/미보유→가격층+CTA. connection()/cookies() 금지.
- Test: 분기별, SSR ★/수익률 부재, shell cookies/connection 없음, noindex.

### Task 5: 회원 /portfolio 페이지
- Create: `src/app/portfolio/page.tsx`(auth, noindex), 보유 그리드, per-card lazy island(bars fetch, degrade), 빈 상태 CTA.
- Modify: `src/proxy.ts` — AUTH_REQUIRED_PATHS에 `/portfolio` + RESERVED_FIRST_SEGMENTS에 `'portfolio'`(둘 다 필수). `src/app/account/page.tsx`에 진입 링크.
- Test: auth 가드, 그리드, 빈 상태, card degrade, noindex, RESERVED 라우팅.

### Task 6: 모바일 정합 + 배지
- PositionBuilding 반응형(viewBox, 라벨 겹침) 최종 확인(탭/portfolio 좁은 뷰포트).
- C 배지: 좁은 뷰포트 재현 확인 후 **필요 시에만** 우측 그룹 내부 한정 수정(col→row 스위치 불변).

### Task 7: e2e
- Create: `e2e/specs/position-building.spec.ts` — 탭(회원 보유→★, 미보유→CTA), /portfolio(회원 그리드/비로그인 리다이렉트), 분석 페이지 위치 부재, 배지 모바일.

---
각 태스크: 구현→spec 리뷰→code-quality 리뷰→다음. 전체 후 6종 fresh-context 감사(loop-to-0)→변경범위 Spec+TestCase→실증(prod빌드+curl+Chrome).
