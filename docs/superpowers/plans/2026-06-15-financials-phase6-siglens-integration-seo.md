# Financials Phase 6 — siglens overall · chat · SEO 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** financials를 overall 종합 분석(스코어카드 주입)에 통합하고, SEO(generateMetadata·JsonLd·OG·sitemap·CrossLink) + 탭 내부 링크를 완성한다.

**Architecture:** overall은 financials를 폴링 축이 아니라 **동기 스코어카드**로 주입(Phase 2 core 슬롯 사용). SEO는 fundamental 패턴 미러, AI peek seed 없이 룰 데이터 SSR로 충족.

**Tech Stack:** Next 16, vitest 90%. **선행:** Phase 2(core overall/chat), Phase 4·5(페이지·AI), core overlay.

**상위 스펙:** §4.7(SEO), §4.8(overall), §4.9(chat).

---

## Phase 0: 전제
- [ ] `cd /Users/y0ngha/Project/siglens-financials`, core overlay에 `OverallAnalysisResponse.financialsBulletsKo`·`OverallDependencyInputs.financialsScorecard` 존재 확인.

---

## Task 1: overall FinancialsSummary 섹션

**Files:**
- Create: `src/widgets/overall/sections/FinancialsSummary.tsx`
- Test: `__tests__/FinancialsSummary.test.tsx`

`FundamentalSummary` 패턴(bullets 렌더).

- [ ] **Step 1~4: TDD** — `FinancialsSummary({ bullets })`: `bullets.length===0`이면 미렌더(또는 생략), else 카드 + 제목 "재무 분석" + `ul`. **Step 5: Commit** `feat(financials): add overall FinancialsSummary section`

---

## Task 2: submitOverallAnalysisAction — 스코어카드 수집·전달

**Files:**
- Modify: `src/entities/analysis/actions/submitOverallAnalysisAction.ts`
- Test: 보강

- [ ] **Step 1: 실패 테스트** — overall submit 시 financials snapshot fetch + `computeFinancialsScorecard` 호출, core `submitOverallAnalysis`에 `financialsScorecard` 전달. 봇(skipEnqueueIfMiss)이면 financials fetch 생략(비용).
- [ ] **Step 2: 구현** — 기존 `Promise.all` 데이터 수집에 `getFinancialsSnapshot(symbol)`(Phase 4) 추가(봇이면 skip → undefined) → `computeFinancialsScorecard` → `submitOverallAnalysis({ ..., financialsScorecard })`.
- [ ] **Step 3: 통과** → PASS. **Step 4: Commit** `feat(financials): inject scorecard into overall analysis action`

---

## Task 3: OverallContent — financialsBulletsKo 렌더

**Files:**
- Modify: `src/widgets/overall/OverallContent.tsx`
- Test: 보강

- [ ] **Step 1~4:** done 상태 렌더에 `<FinancialsSummary bullets={r.financialsBulletsKo} />` 추가(FundamentalSummary 다음). 테스트: financialsBulletsKo 있으면 섹션 표시. (DependencyProgress는 축 추가 아니므로 변경 없음.)
- [ ] **Step 5: Commit** `feat(financials): render financials section in overall`

---

## Task 4: generateMetadata + SEO content

**Files:**
- Modify: `src/shared/lib/seo.ts` (`buildSymbolFinancialsSeoContent`)
- Modify: `src/app/[symbol]/financials/page.tsx` (`generateMetadata`)
- Test: `src/shared/lib/__tests__/seo.test.ts` 보강

`buildSymbolFundamentalSeoContent` 패턴.

- [ ] **Step 1: 실패 테스트** — `buildSymbolFinancialsSeoContent('AAPL','Apple')` → title에 "재무제표"+티커, desc ≤120자. 미존재 심볼 page는 `NOINDEX_SYMBOL_METADATA`.
- [ ] **Step 2: 구현** — `buildSymbolFinancialsSeoContent`: title `"{TICKER} 재무제표 — 매출·이익·현금흐름 5년 추이"`, description `clampSeoDescription(`{name}({TICKER})의 손익·재무상태·현금흐름과 성장성·수익성·안정성 점수`, 120)`. page `generateMetadata`: ticker 검증→asset fetch→존재 분기→canonical `/{symbol}/financials`+OG(label '재무제표')+ko_KR+summary_large_image; 미존재 `NOINDEX_SYMBOL_METADATA`.
- [ ] **Step 3: 통과** → PASS. **Step 4: Commit** `feat(financials): add SEO metadata + canonical`

---

## Task 5: JSON-LD

**Files:**
- Modify: `src/app/[symbol]/financials/page.tsx` (JsonLd)
- Test: 보강

- [ ] **Step 1~4:** `WebPage` + `buildBreadcrumbJsonLd` + `FAQPage`(3문항: "이 회사 재무는 건전한가/성장 추세는/현금 창출력은"). 기존 fundamental JsonLd 빌더 패턴 재사용. 테스트: JsonLd 스크립트에 3 스키마 type 존재.
- [ ] **Step 5: Commit** `feat(financials): add WebPage/Breadcrumb/FAQ JSON-LD`

---

## Task 6: OG image · sitemap · CrossLinkCards

**Files:**
- Modify: OG image route(또는 `buildSymbolOgImage` 호출), `src/app/sitemap.ts`(`LONGTAIL_ENTRIES_PER_TICKER`), CrossLinkCards 컴포넌트
- Test: sitemap·crosslink 테스트 보강

- [ ] **Step 1~4:** OG label '재무제표'(force-static). sitemap `LONGTAIL_ENTRIES_PER_TICKER` 5→6 + financials 엔트리. CrossLinkCards 6→7(financials 카드, 현재 페이지 `aria-current="page"`). 테스트: sitemap에 `/financials` 포함, crosslink에 재무제표.
- [ ] **Step 5: Commit** `feat(financials): add OG image, sitemap entry, cross-link card`

---

## Task 7: ISR_REVALIDATE 문서

**Files:**
- Modify: `docs/architecture/ISR_REVALIDATE.md`

- [ ] **Step 1~2:** financials 행 추가(revalidate 86400, 근거: 재무 분기성, AI 클라 폴링). **Commit** `docs(financials): add financials ISR revalidate row`

---

## Task 8: 검증
- [ ] `yarn lint` + `yarn test`(전체, 커버리지 ≥90%) + `E2E_TEST=1 yarn build`(prerender·sitemap 회귀 없음). overall/chat/SEO 회귀 확인.

---

## Self-Review
- §4.8 overall(섹션·액션·렌더) Task 1·2·3. §4.7 SEO(metadata·JsonLd·OG·sitemap·CrossLink·ISR doc) Task 4·5·6·7. chat은 Phase 5 Task 6에서 완료.
- 봇 시 overall financials fetch skip(비용). 타입: core financialsBulletsKo/financialsScorecard 일치.
