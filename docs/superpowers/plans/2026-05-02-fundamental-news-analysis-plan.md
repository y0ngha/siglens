# Fundamental & News Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** siglens에 기본적 분석(`/[symbol]/fundamental`), 뉴스 분석(`/[symbol]/news`), AI 종합 분석(`/[symbol]/overall`) 페이지를 추가하고, 차트 페이지에 가벼운 뉴스 보강 섹션을 추가한다.

**Architecture:** Cross-repo. siglens-core(npm)에 새 use-case 3종(submit/poll/cancel × Fundamental/News/Overall) + 프롬프트 빌더 + 응답 정규화 + Provider 인터페이스(`FundamentalDataProvider`, `NewsProvider`) + Skills loader 확장 + 챗봇 프롬프트 빌더 확장을 추가. siglens(Next.js)는 FMP `/stable/*` 어댑터, Drizzle 스키마 3개(`news`, `earnings_calendar`, `earnings_reports`), Vercel Cron, 페이지 라우트 3개 + 차트 페이지 보강, 헤더 세그먼트 탭 + cross-link 카드, 챗봇 컨텍스트 전환 UI, Skills `.md` 카탈로그 신규 카테고리 2종(`fundamental/`, `news/`)를 추가.

**Tech Stack:** TypeScript, Next.js 16(App Router, RSC + Suspense streaming), React 19, `@y0ngha/siglens-core`(분석 도메인), Drizzle ORM(Neon Postgres), `@upstash/redis`(분석 캐시 + Job 큐), Vercel Cron, Gemini SDK(`gemini-2.5-flash-lite` 번역/sentiment 전용 + 사용자 노출 모델), Jest(단위/통합).

---

## Repo / Worktree Map

| Repo | 경로 | 브랜치 |
|---|---|---|
| siglens-core | `/Users/y0ngha/Project/siglens-core-fund-news` (워크트리, Task 0.1에서 생성) | `feat/fundamental-news-analysis` (base: `main`) |
| siglens | `/Users/y0ngha/Project/siglens-fund-news-analysis` (워크트리, 이미 생성됨) | `feat/fundamental-news-analysis` (base: `master`) |
| siglens-worker | 변경 없음 (일반화된 prompt → AI 호출 패턴이라 새 분석 종류 추가에 코드 변경 불필요) | — |

**Phase 순서**: Phase 1 (siglens-core)을 먼저 완성 → npm publish (예: `0.8.0-beta.1`) → Phase 2 (siglens)에서 새 버전 import.

---

## Per-task Skill Invocation Rules (필독)

각 task 진행 전 아래 스킬을 **반드시 invoke**해서 가이드를 컨텍스트에 적재한 뒤 코드 작성. 모든 subagent에 동일 적용.

| Task 종류 | 의무 스킬 (순서대로 invoke) |
|---|---|
| **UI 컴포넌트 / 페이지 / 라우트 / 디자인** (예: Phase 2 Task 2.9–2.16) | `frontend-design` → `web-design-guidelines` → `seo-audit` → `vercel-react-best-practices` → `next-cache-components` |
| **TypeScript 타입 / 도메인 함수 / 응답 정규화 / use-case / Server Action / Repository / Provider** (예: Phase 1 전체, Phase 2 Task 2.1–2.8, 2.17) | `typescript-expert` → `typescript-advanced-types` |
| **신규 기능 검토 (해당 시)** | `brainstorming` — 이미 완료됨. 추가 큰 결정이 필요해지면 재개. |

CLAUDE.md Skill Usage Rules와 일관. 각 task 시작 시 subagent dispatch prompt에 의무 스킬을 명시적으로 박아 호출.

---

## Worktree Isolation (필독)

모든 코드 변경은 **워크트리 내에서만** 발생해야 함. 메인 브랜치(`master`/`main`) 또는 메인 폴더(`/Users/y0ngha/Project/siglens`, `/Users/y0ngha/Project/siglens-core`) 절대 수정 금지.

| 항목 | 메인 (수정 금지) | 워크트리 (작업) |
|---|---|---|
| siglens | `/Users/y0ngha/Project/siglens` (master) | `/Users/y0ngha/Project/siglens-fund-news-analysis` (`feat/fundamental-news-analysis`) |
| siglens-core | `/Users/y0ngha/Project/siglens-core` (main) | `/Users/y0ngha/Project/siglens-core-fund-news` (`feat/fundamental-news-analysis`) — Phase 0 Task 0.1에서 생성 |

**Subagent dispatch 시 cwd 명시 필수**. 모든 git 명령은 워크트리 경로에서. 메인 폴더에서 `git status`만 확인하는 것은 OK이나 `git add`/`git commit`은 워크트리에서.

워크트리 정리는 PR 머지 + 배포 검증 완료 후 (Task 3.3) 일괄 진행.

---

## File Map

### Phase 1 — siglens-core (워크트리: `/Users/y0ngha/Project/siglens-core-fund-news`)

| 파일 | 역할 | 생성/수정 |
|------|------|----------|
| `src/domain/types.ts` | 새 타입 추가: `FundamentalAnalysisResponse`, `NewsAnalysisResponse`, `NewsCardAnalysis`, `OverallAnalysisResponse`, `NewsItem`, `NewsSentiment`, `NewsCategory`, `EarningsCalendarItem`, `EarningsReport`, `GradesEvent`, `FundamentalSnapshot`, `OverallScenario`, Skill 카테고리 union 확장 | 수정 |
| `src/domain/analysis/fundamentalPrompt.ts` | `buildFundamentalAnalysisPrompt(symbol, data, skills)` 순수 함수 | 생성 |
| `src/domain/analysis/newsPrompt.ts` | `buildNewsAnalysisPrompt(symbol, news, eventCalendar, skills)` 순수 함수 | 생성 |
| `src/domain/analysis/newsCardPrompt.ts` | `buildNewsCardAnalysisPrompt(item)` — 1뉴스 = 1호출용 (번역 + 요약 + sentiment 묶음). 출력은 영어 그대로/한국어/sentiment 라벨 JSON | 생성 |
| `src/domain/analysis/overallPrompt.ts` | `buildOverallAnalysisPrompt(symbol, technical, fundamental, news, timeframe)` — 3축 통합 + 타임프레임 맥락 | 생성 |
| `src/domain/analysis/normalizeFundamental.ts` | `normalizeFundamentalAnalysisResponse(raw)` | 생성 |
| `src/domain/analysis/normalizeNews.ts` | `normalizeNewsAnalysisResponse(raw)`, `normalizeNewsCardAnalysis(raw)` | 생성 |
| `src/domain/analysis/normalizeOverall.ts` | `normalizeOverallAnalysisResponse(raw)` | 생성 |
| `src/domain/chat/buildChatPrompt.ts` | `currentAnalysisContext?` 파라미터 추가. union 타입(`{ kind: 'technical' \| 'fundamental' \| 'news' \| 'overall', payload }`) | 수정 |
| `src/domain/tier.ts` | `TIER_CONFIG.infoDepth`에 새 분석 4종 매핑 정의 (siglens 미 enforce지만 source-of-truth 보유) | 수정 |
| `src/infrastructure/cache/config.ts` | `buildFundamentalCacheKey`, `buildNewsCacheKey`, `buildNewsCardCacheKey`, `buildOverallCacheKey` + 각 TTL 상수 | 수정 |
| `src/infrastructure/skills/loader.ts` | 새 카테고리 (`fundamental`, `news`) 스캔. 기존 `confidence_weight < 0.5` 룰 그대로 | 수정 |
| `src/infrastructure/skills/types.ts` | `SkillCategory` union 확장 | 수정 |
| `src/infrastructure/fundamental/types.ts` | `FundamentalDataProvider` 인터페이스 (16개 메서드 — profile, keyMetricsTtm, ratiosTtm, incomeStatement, balanceSheetStatement, cashFlowStatement, incomeStatementGrowth, financialScores, stockPeers, analystEstimates, gradesConsensus, priceTargetConsensus, priceTargetSummary, sectorPerformanceSnapshot, historicalSectorPerformance, earnings) | 생성 |
| `src/infrastructure/news/types.ts` | `NewsProvider` 인터페이스 (3개 메서드: `fetchNews(symbol, range)`, `fetchEarningsCalendarAll()`, `fetchEarningsReport(symbol)`) | 생성 |
| `src/application/fundamental/types.ts` | `SubmitFundamentalAnalysisOptions`, `SubmitFundamentalAnalysisResult` | 생성 |
| `src/application/fundamental/submitFundamentalAnalysis.ts` | tier check → cache → fetch via `FundamentalDataProvider` → buildPrompt → enqueue job | 생성 |
| `src/application/fundamental/pollFundamentalAnalysis.ts` | getJobStatus → result → normalize → cache → return | 생성 |
| `src/application/fundamental/cancelFundamentalAnalysisJob.ts` | 기존 `cancelAnalysisJob` 패턴 재사용 | 생성 |
| `src/application/news/submitNewsAnalysis.ts` | News use-case (종합) | 생성 |
| `src/application/news/pollNewsAnalysis.ts` | | 생성 |
| `src/application/news/cancelNewsAnalysisJob.ts` | | 생성 |
| `src/application/news/submitNewsCardAnalysis.ts` | 카드별 LLM 1회 (gemini-2.5-flash-lite). 영구 캐시 (key=`news_id`+model) | 생성 |
| `src/application/news/pollNewsCardAnalysis.ts` | | 생성 |
| `src/application/overall/submitOverallAnalysis.ts` | 의존성 자동 처리 + 단계별 상태 보고 | 생성 |
| `src/application/overall/pollOverallAnalysis.ts` | `running_dependencies \| processing \| done \| error` 상태 | 생성 |
| `src/application/overall/cancelOverallAnalysisJob.ts` | | 생성 |
| `src/application/overall/dependencyResolver.ts` | 인풋 의존성 캐시 룩업 + miss 분석만 백그라운드 트리거 | 생성 |
| `src/index.ts` | 새 use-case + 타입 + Provider 인터페이스 + 캐시 키 빌더 + 프롬프트 빌더 export | 수정 |
| `src/__tests__/domain/analysis/fundamentalPrompt.test.ts` | | 생성 |
| `src/__tests__/domain/analysis/newsPrompt.test.ts` | | 생성 |
| `src/__tests__/domain/analysis/newsCardPrompt.test.ts` | | 생성 |
| `src/__tests__/domain/analysis/overallPrompt.test.ts` | | 생성 |
| `src/__tests__/domain/analysis/normalizeFundamental.test.ts` | | 생성 |
| `src/__tests__/domain/analysis/normalizeNews.test.ts` | | 생성 |
| `src/__tests__/domain/analysis/normalizeOverall.test.ts` | | 생성 |
| `src/__tests__/application/fundamental/submitFundamentalAnalysis.test.ts` | | 생성 |
| `src/__tests__/application/news/submitNewsAnalysis.test.ts` | | 생성 |
| `src/__tests__/application/news/submitNewsCardAnalysis.test.ts` | | 생성 |
| `src/__tests__/application/overall/dependencyResolver.test.ts` | | 생성 |
| `src/__tests__/application/overall/submitOverallAnalysis.test.ts` | | 생성 |
| `src/__tests__/infrastructure/cache/config.test.ts` | 새 캐시 키 빌더 테스트 | 수정 |
| `src/__tests__/infrastructure/skills/loader.test.ts` | 새 카테고리 스캔 테스트 | 수정 |
| `src/__tests__/domain/chat/buildChatPrompt.test.ts` | currentAnalysisContext 파라미터 테스트 | 수정 |
| `package.json` | version bump (`0.7.1` → `0.8.0-beta.1`) | 수정 |
| `CHANGELOG.md` | 0.8.0-beta.1 변경 항목 | 수정 |
| `docs/PUBLIC_API.md` | 새 export 인벤토리 갱신 | 수정 |

### Phase 2 — siglens (워크트리: `/Users/y0ngha/Project/siglens-fund-news-analysis`)

| 파일 | 역할 | 생성/수정 |
|------|------|----------|
| `package.json` | `@y0ngha/siglens-core` 0.8.0-beta.1로 업데이트 | 수정 |
| `src/infrastructure/fmp/fundamentalClient.ts` | `FundamentalDataProvider` 구현 (16개 fetch) | 생성 |
| `src/infrastructure/fmp/newsClient.ts` | `NewsProvider` 구현 (news, earnings-calendar, earnings) | 생성 |
| `src/infrastructure/fmp/types.ts` | FMP 응답 타입 (raw + 정규화 변환 함수) | 생성 |
| `src/infrastructure/db/schema/news.ts` | Drizzle schema | 생성 |
| `src/infrastructure/db/schema/earningsCalendar.ts` | Drizzle schema | 생성 |
| `src/infrastructure/db/schema/earningsReports.ts` | Drizzle schema | 생성 |
| `drizzle/0001_fund_news.sql` | 마이그레이션 (네이밍은 `drizzle-kit` 출력 따름) | 생성 |
| `src/infrastructure/db/repositories/newsRepository.ts` | upsert/get/listBySymbol | 생성 |
| `src/infrastructure/db/repositories/earningsCalendarRepository.ts` | upsert/getNextForSymbol/listForRange | 생성 |
| `src/infrastructure/db/repositories/earningsReportsRepository.ts` | upsert/getLatestForSymbol | 생성 |
| `src/app/api/cron/earnings-calendar-sync/route.ts` | Vercel Cron 핸들러: FMP fetch → upsert | 생성 |
| `vercel.json` | crons 항목 추가 (`/api/cron/earnings-calendar-sync` 1일 1회 06:00 UTC) | 수정 |
| `src/infrastructure/market/submitFundamentalAnalysisAction.ts` | Server Action — siglens-core `submitFundamentalAnalysis` 호출 | 생성 |
| `src/infrastructure/market/pollFundamentalAnalysisAction.ts` | Server Action | 생성 |
| `src/infrastructure/market/cancelFundamentalAnalysisJobAction.ts` | Server Action | 생성 |
| `src/infrastructure/market/submitNewsAnalysisAction.ts` | | 생성 |
| `src/infrastructure/market/pollNewsAnalysisAction.ts` | | 생성 |
| `src/infrastructure/market/cancelNewsAnalysisJobAction.ts` | | 생성 |
| `src/infrastructure/market/submitOverallAnalysisAction.ts` | | 생성 |
| `src/infrastructure/market/pollOverallAnalysisAction.ts` | | 생성 |
| `src/infrastructure/market/cancelOverallAnalysisJobAction.ts` | | 생성 |
| `src/infrastructure/ai/gemini.ts` | 모델 파라미터화 — 분석용 모델 vs `gemini-2.5-flash-lite` 분기 | 수정 |
| `src/lib/preferredModel.ts` | 사용자 전역 모델 선호 (localStorage 키 `siglens.preferredModel` + 회원이면 user 설정 호환) | 생성 |
| `src/components/chat/hooks/usePreferredModel.ts` | React hook — preferredModel get/set | 생성 |
| `src/app/[symbol]/fundamental/page.tsx` | RSC, Suspense 경계로 섹션별 streaming | 생성 |
| `src/app/[symbol]/fundamental/loading.tsx` | | 생성 |
| `src/app/[symbol]/news/page.tsx` | RSC + 자동 트리거 (server action 호출 + client polling) | 생성 |
| `src/app/[symbol]/news/loading.tsx` | | 생성 |
| `src/app/[symbol]/overall/page.tsx` | RSC + 명시 트리거 (CTA + 의존성 진행 UI) | 생성 |
| `src/app/[symbol]/overall/loading.tsx` | | 생성 |
| `src/components/symbol-page/SymbolTabs.tsx` | 헤더 세그먼트 탭 (4개, ARIA tablist) | 생성 |
| `src/components/symbol-page/CrossLinkCards.tsx` | 페이지 끝 cross-link 카드 컴포넌트 | 생성 |
| `src/components/fundamental/FundamentalContent.tsx` | 클라이언트 컴포넌트 — RSC props 받아 렌더 | 생성 |
| `src/components/fundamental/sections/*.tsx` | ProfileCard, ValuationCard, PeersTable, ProfitabilityCard, GrowthChart, FinancialHealthCard, FutureDirectionCard, SectorDirectionCard, FundamentalAiSummary | 생성 (9개 파일) |
| `src/components/news/NewsContent.tsx` | | 생성 |
| `src/components/news/NewsList.tsx` | sentiment 뱃지 + KO 요약 | 생성 |
| `src/components/news/NewsAiSummary.tsx` | 종합 AI 분석 섹션 | 생성 |
| `src/components/news/EventCalendar.tsx` | 다음 어닝 + 최근 결과 | 생성 |
| `src/components/news/AnalystActions.tsx` | grades 이벤트 | 생성 |
| `src/components/overall/OverallContent.tsx` | | 생성 |
| `src/components/overall/OverallTriggerCta.tsx` | 첫 진입 CTA | 생성 |
| `src/components/overall/DependencyProgress.tsx` | 단계별 진행 UI (1/3 → 2/3 → 3/3) | 생성 |
| `src/components/overall/sections/*.tsx` | OverallSummary, TechnicalSummary, FundamentalSummary, NewsSummary, ThreeAxisConclusion, ScenarioAnalysis, RiskFactors | 생성 (7개 파일) |
| `src/components/symbol-page/ChartContent.tsx` | 뉴스 보강 섹션 추가 | 수정 |
| `src/components/symbol-page/NewsAugment.tsx` | A2+A3 보강 섹션 (5건 카드 + sentiment + KO 요약 + News 종합 분석 결과의 첫 단락 인용) | 생성 |
| `src/components/chat/hooks/useChat.ts` | `usePathname` 감지 → 컨텍스트 교체 + 시스템 메시지 enqueue | 수정 |
| `src/components/chat/ChatPanel.tsx` | 시스템 메시지 렌더링 | 수정 |
| `src/components/chat/ContextSwitchSystemMessage.tsx` | 시스템 메시지 컴포넌트 | 생성 |
| `src/lib/seo.ts` | 펀더/뉴스/종합 페이지별 메타 빌더 추가 | 수정 |
| `src/app/sitemap.ts` | 4개 페이지 모두 등록 | 수정 |
| `src/components/ui/JsonLd.tsx` 또는 `src/lib/seo.ts` | breadcrumb 4개 페이지 확장 | 수정 |
| `skills/fundamental/value-investing.md` | Skill 카탈로그 | 생성 |
| `skills/fundamental/growth-investing.md` | | 생성 |
| `skills/fundamental/quality-investing.md` | | 생성 |
| `skills/news/event-driven.md` | | 생성 |
| `skills/news/macro-impact.md` | | 생성 |
| `skills/news/earnings-reaction.md` | | 생성 |
| `src/__tests__/infrastructure/db/newsRepository.test.ts` | | 생성 |
| `src/__tests__/infrastructure/db/earningsCalendarRepository.test.ts` | | 생성 |
| `src/__tests__/infrastructure/db/earningsReportsRepository.test.ts` | | 생성 |
| `src/__tests__/infrastructure/fmp/fundamentalClient.test.ts` | fetch mock 테스트 | 생성 |
| `src/__tests__/infrastructure/fmp/newsClient.test.ts` | | 생성 |
| `src/__tests__/app/api/cron/earnings-calendar-sync.test.ts` | | 생성 |
| `src/__tests__/lib/preferredModel.test.ts` | | 생성 |

---

## Phase 0: 워크트리 셋업

### Task 0.1: siglens-core 워크트리 생성

**Files:** 없음 (외부 명령)

- [ ] **Step 1: 워크트리 생성**

```bash
cd /Users/y0ngha/Project/siglens-core
git fetch origin
git worktree add /Users/y0ngha/Project/siglens-core-fund-news -b feat/fundamental-news-analysis main
```

Expected: `작업 트리 준비 중 (새 브랜치 'feat/fundamental-news-analysis')`

- [ ] **Step 2: 의존성 설치**

```bash
cd /Users/y0ngha/Project/siglens-core-fund-news
yarn install
```

Expected: `Done`

- [ ] **Step 3: 베이스라인 테스트 통과 확인**

```bash
yarn test 2>&1 | tail -20
```

Expected: 모든 기존 테스트 PASS

- [ ] **Step 4: 워크트리 등록 확인**

```bash
git worktree list
```

Expected: `siglens-core-fund-news` 항목이 `feat/fundamental-news-analysis` 브랜치로 등록됨

### Task 0.2: spec 인벤토리 재확인

**Files:** 읽기만

- [ ] **Step 1: spec 한 번 더 정독 (특히 §10 Cross-repo Work Split 표)**

Run: `cat /Users/y0ngha/Project/siglens-fund-news-analysis/docs/superpowers/specs/2026-05-02-fundamental-news-analysis-design.md`

- [ ] **Step 2: SCOPE.md 결정 트리 §3 재확인** — 모든 Phase 1 task가 Step 4(분석 도메인) 또는 Step 5(분석 직결 인프라)에 정확히 매핑되는지 점검

Run: `cat /Users/y0ngha/Project/siglens-core/docs/SCOPE.md`

---

## Phase 1: siglens-core (cwd: `/Users/y0ngha/Project/siglens-core-fund-news`)

> 모든 Phase 1 작업은 siglens-core 워크트리에서 실행. cwd 명시 필수.
>
> AI-facing 프롬프트 문자열은 **반드시 영어** (기존 컨벤션 — `domain/analysis/prompt.ts` 첫 줄 주석 참고). 한국어 응답을 원하더라도 system prompt나 후처리에서 처리.

### Task 1.1: 도메인 타입 추가

**Files:**
- Modify: `src/domain/types.ts`
- Test: 다음 task들의 테스트가 이 타입을 사용

- [ ] **Step 1: 새 타입 정의 추가**

`src/domain/types.ts` 끝(또는 적절한 섹션)에 추가:

```typescript
// ─────────────────────────────────────────
// Fundamental analysis
// ─────────────────────────────────────────

export type FundamentalSentiment = 'bullish' | 'neutral' | 'bearish';

export interface FundamentalCategoryAssessment {
    /** 'valuation' | 'profitability' | 'growth' | 'health' | 'futureDirection' */
    category:
        | 'valuation'
        | 'profitability'
        | 'growth'
        | 'health'
        | 'futureDirection';
    sentiment: FundamentalSentiment;
    /** 한 단락 평가 (한국어). */
    rationaleKo: string;
}

export interface FundamentalAnalysisResponse {
    /** 종합 결론 (한 단락, 한국어). */
    overallConclusionKo: string;
    /** 카테고리별 평가. */
    categoryAssessments: FundamentalCategoryAssessment[];
    /** 위험 요인 bullets (한국어). */
    riskFactorsKo: string[];
    /** 종합 sentiment (강세/중립/약세). */
    overallSentiment: FundamentalSentiment;
}

/** Fundamental 분석 prompt에 들어가는 정규화된 데이터. */
export interface FundamentalSnapshot {
    profile: {
        symbol: string;
        companyName: string;
        sector: string;
        industry: string;
        marketCap: number;
        ceo: string | null;
        website: string | null;
        description: string | null;
    };
    valuation: {
        per: number | null;
        psr: number | null;
        pbr: number | null;
        peg: number | null;
        evToEbitda: number | null;
        eps: number | null;
        sectorAverages?: {
            per: number | null;
            psr: number | null;
        };
    };
    peers: Array<{ symbol: string; companyName: string; marketCap: number }>;
    profitability: {
        roe: number | null;
        roa: number | null;
        operatingMargin: number | null;
        netMargin: number | null;
    };
    growth: {
        revenueYoy: number | null;
        epsYoy: number | null;
    };
    health: {
        debtRatio: number | null;
        currentRatio: number | null;
        operatingCashFlow: number | null;
        altmanZScore: number | null;
        piotroskiScore: number | null;
    };
    futureDirection: {
        nextEarningsAt: string | null; // ISO date
        analystEstimateEps: number | null;
        analystEstimateRevenue: number | null;
        gradesConsensus: {
            strongBuy: number;
            buy: number;
            hold: number;
            sell: number;
            strongSell: number;
        } | null;
        priceTargetConsensus: {
            high: number | null;
            low: number | null;
            median: number | null;
            consensus: number | null;
        } | null;
        priceTargetSummary: {
            month1Avg: number | null;
            month3Avg: number | null;
            year1Avg: number | null;
        } | null;
    };
    sectorDirection: {
        todayChangePct: number | null;
        historical: Array<{ date: string; changePct: number }>;
    };
}

// ─────────────────────────────────────────
// News analysis
// ─────────────────────────────────────────

export type NewsSentiment = 'bullish' | 'neutral' | 'bearish';

export type NewsCategory =
    | 'earnings'
    | 'm_and_a'
    | 'guidance'
    | 'regulation'
    | 'macro'
    | 'product'
    | 'other';

export interface NewsItem {
    id: string;
    symbol: string;
    source: string;
    url: string;
    publishedAt: string; // ISO
    titleEn: string;
    bodyEn: string | null;
}

export interface NewsCardAnalysis {
    titleKo: string;
    bodyKo: string | null;
    summaryKo: string; // 한 줄 요약
    sentiment: NewsSentiment;
    category: NewsCategory;
}

export interface NewsAnalysisResponse {
    /** 종합 분석 첫 단락 (한국어): "현재 가격 흐름의 뉴스 원인". A 보강에서 인용. */
    currentDriverKo: string;
    /** 핵심 이벤트 3-5개 bullets. */
    keyEventsKo: string[];
    /** 향후 주의 이벤트 bullets. */
    upcomingEventsKo: string[];
    overallSentiment: NewsSentiment;
}

export interface EarningsCalendarItem {
    symbol: string;
    earningsDate: string; // ISO date
    epsActual: number | null;
    epsEstimated: number | null;
    revenueActual: number | null;
    revenueEstimated: number | null;
    lastUpdated: string; // ISO date
}

export interface EarningsReport {
    symbol: string;
    earningsDate: string;
    raw: unknown;
}

export interface GradesEvent {
    symbol: string;
    date: string;
    gradingCompany: string;
    previousGrade: string | null;
    newGrade: string;
    action: 'upgrade' | 'downgrade' | 'maintained' | 'initiated' | 'other';
}

// ─────────────────────────────────────────
// Overall analysis
// ─────────────────────────────────────────

export type OverallScenarioName = 'bullish' | 'neutral' | 'bearish';

export interface OverallScenario {
    name: OverallScenarioName;
    triggerConditionKo: string;
    priceRangeKo: string;
}

export interface OverallAnalysisResponse {
    /** 한 줄 정의 + 현재 상태 1단락. */
    headlineKo: string;
    /** 기술 분석 요약 bullets. */
    technicalBulletsKo: string[];
    /** 펀더 요약 bullets. */
    fundamentalBulletsKo: string[];
    /** 뉴스 요약 bullets. */
    newsBulletsKo: string[];
    /** 3축 종합 결론 큰 박스 (한 단락 또는 두 단락). */
    threeAxisConclusionKo: string;
    /** 시나리오 분석. */
    scenarios: OverallScenario[];
    /** 위험 요인 bullets. */
    riskFactorsKo: string[];
}
```

- [ ] **Step 2: SkillCategory union 확장**

`src/infrastructure/skills/types.ts`(또는 SkillCategory가 정의된 파일)에서 union 갱신:

```typescript
export type SkillCategory =
    | 'patterns'
    | 'strategies'
    | 'indicators'
    | 'fundamental'  // 신규
    | 'news';        // 신규
```

- [ ] **Step 3: 타입 컴파일 확인**

Run: `yarn tsc --noEmit`

Expected: 새 타입 추가만으로는 다른 곳을 깨지 않음. 컴파일 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts src/infrastructure/skills/types.ts
git commit -m "feat: 펀더/뉴스/종합 분석 도메인 타입 추가"
```

### Task 1.2: TIER_CONFIG infoDepth 매핑

**Files:**
- Modify: `src/domain/tier.ts`

- [ ] **Step 1: 새 분석 4종 InfoDepth 매핑 정의**

기존 `TIER_CONFIG.infoDepth` 형태 확인 후 (Free/Member/Pro 각각 허용 InfoDepth 배열) — 새 분석은 기존 기술 분석과 동일한 매핑을 적용. 즉 변경 없이 기존 `infoDepth`가 새 분석에도 그대로 적용된다는 사실만 명세에 적힌 코멘트로 기록.

```typescript
// src/domain/tier.ts 위쪽 주석에 추가:
/**
 * NOTE: TIER_CONFIG.infoDepth는 기술적 분석에 더해 새로 추가된
 * Fundamental / News / Overall 분석에도 동일하게 적용된다.
 * siglens 측은 enforce 안 함 (Phase 4에서 master switch 켤 때 자동 적용).
 */
```

- [ ] **Step 2: 테스트 — 변경 없음 확인**

Run: `yarn test src/__tests__/domain/tier.test.ts -- 2>&1 | tail`

Expected: 기존 tier 테스트 PASS

- [ ] **Step 3: Commit**

```bash
git add src/domain/tier.ts
git commit -m "docs: TIER_CONFIG infoDepth 새 분석 4종 적용 명시"
```

### Task 1.3: 캐시 키 빌더 + TTL 상수

**Files:**
- Modify: `src/infrastructure/cache/config.ts`
- Test: `src/__tests__/infrastructure/cache/config.test.ts`

- [ ] **Step 1: failing test 작성**

`src/__tests__/infrastructure/cache/config.test.ts`에 추가:

```typescript
import {
    buildFundamentalCacheKey,
    buildNewsCacheKey,
    buildNewsCardCacheKey,
    buildOverallCacheKey,
    FUNDAMENTAL_CACHE_TTL_SECONDS,
    NEWS_CACHE_TTL_SECONDS,
    NEWS_CARD_CACHE_TTL_SECONDS,
    OVERALL_CACHE_TTL_SECONDS,
} from '@/infrastructure/cache/config';

describe('new analysis cache keys', () => {
    test('buildFundamentalCacheKey is symbol+model+input_hash deterministic', () => {
        const a = buildFundamentalCacheKey('AAPL', 'gemini-2.5-pro', 'h1');
        const b = buildFundamentalCacheKey('AAPL', 'gemini-2.5-pro', 'h1');
        expect(a).toBe(b);
        expect(a).toMatch(/^analysis:fundamental:AAPL:gemini-2\.5-pro:h1$/);
    });

    test('buildNewsCacheKey same shape', () => {
        expect(
            buildNewsCacheKey('AAPL', 'gemini-2.5-pro', 'h2')
        ).toMatch(/^analysis:news:AAPL:gemini-2\.5-pro:h2$/);
    });

    test('buildNewsCardCacheKey is per-news-id (model fixed flash-lite)', () => {
        const k = buildNewsCardCacheKey('news-12345');
        expect(k).toBe(
            'analysis:news-card:news-12345:gemini-2.5-flash-lite'
        );
    });

    test('buildOverallCacheKey includes timeframe', () => {
        expect(
            buildOverallCacheKey('AAPL', '5m', 'gemini-2.5-pro', 'h3')
        ).toBe('analysis:overall:AAPL:5m:gemini-2.5-pro:h3');
    });

    test('TTL constants are sane', () => {
        expect(FUNDAMENTAL_CACHE_TTL_SECONDS).toBeGreaterThan(0);
        expect(NEWS_CACHE_TTL_SECONDS).toBeGreaterThan(0);
        expect(NEWS_CARD_CACHE_TTL_SECONDS).toBeGreaterThan(0);
        expect(OVERALL_CACHE_TTL_SECONDS).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: Run failing test**

Run: `yarn test src/__tests__/infrastructure/cache/config.test.ts`

Expected: FAIL — 함수/상수 미정의

- [ ] **Step 3: 구현 추가**

`src/infrastructure/cache/config.ts`에 추가:

```typescript
/** Fundamental 분석 결과 캐시 키. T3 동적 TTL — 호출 측에서 next_earnings_at 기준으로 계산. 디폴트는 24h. */
export const FUNDAMENTAL_CACHE_TTL_SECONDS = 24 * 60 * 60;
/** News 종합 분석 캐시 키 TTL — 24h (재호출 비용 절감). */
export const NEWS_CACHE_TTL_SECONDS = 24 * 60 * 60;
/** News 카드별 분석 (flash-lite) 영구 캐시 — 30일 (Redis 공간 회수용 상한). */
export const NEWS_CARD_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Overall 종합 분석 TTL — 24h. */
export const OVERALL_CACHE_TTL_SECONDS = 24 * 60 * 60;

export function buildFundamentalCacheKey(
    symbol: string,
    modelId: string,
    inputHash: string
): string {
    return `analysis:fundamental:${symbol}:${modelId}:${inputHash}`;
}

export function buildNewsCacheKey(
    symbol: string,
    modelId: string,
    inputHash: string
): string {
    return `analysis:news:${symbol}:${modelId}:${inputHash}`;
}

export function buildNewsCardCacheKey(newsId: string): string {
    return `analysis:news-card:${newsId}:gemini-2.5-flash-lite`;
}

export function buildOverallCacheKey(
    symbol: string,
    timeframe: string,
    modelId: string,
    inputHash: string
): string {
    return `analysis:overall:${symbol}:${timeframe}:${modelId}:${inputHash}`;
}
```

- [ ] **Step 4: Run test — pass**

Run: `yarn test src/__tests__/infrastructure/cache/config.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/cache/config.ts src/__tests__/infrastructure/cache/config.test.ts
git commit -m "feat: 새 분석 4종 캐시 키 빌더 + TTL 상수 추가"
```

### Task 1.4: FundamentalDataProvider 인터페이스

**Files:**
- Create: `src/infrastructure/fundamental/types.ts`

- [ ] **Step 1: 인터페이스 작성**

```typescript
// src/infrastructure/fundamental/types.ts
import type {
    FundamentalSnapshot,
    GradesEvent,
} from '@/domain/types';

export interface RawProfile {
    symbol: string;
    companyName: string;
    sector: string;
    industry: string;
    mktCap: number;
    ceo: string | null;
    website: string | null;
    description: string | null;
}

export interface RawKeyMetricsTtm {
    peRatioTTM: number | null;
    priceToSalesRatioTTM: number | null;
    pbRatioTTM: number | null;
    pegRatioTTM: number | null;
    enterpriseValueOverEBITDATTM: number | null;
    epsTTM: number | null;
}

export interface RawRatiosTtm {
    returnOnEquityTTM: number | null;
    returnOnAssetsTTM: number | null;
    operatingProfitMarginTTM: number | null;
    netProfitMarginTTM: number | null;
    debtRatioTTM: number | null;
    currentRatioTTM: number | null;
}

export interface RawIncomeGrowth {
    growthRevenue: number | null;
    growthEPS: number | null;
}

export interface RawFinancialScore {
    altmanZScore: number | null;
    piotroskiScore: number | null;
}

export interface RawStockPeer {
    symbol: string;
    companyName: string;
    marketCap: number;
}

export interface RawAnalystEstimate {
    estimatedEpsAvg: number | null;
    estimatedRevenueAvg: number | null;
}

export interface RawGradesConsensus {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
}

export interface RawPriceTargetConsensus {
    targetHigh: number | null;
    targetLow: number | null;
    targetMedian: number | null;
    targetConsensus: number | null;
}

export interface RawPriceTargetSummary {
    lastMonth: { avgPriceTarget: number | null };
    lastQuarter: { avgPriceTarget: number | null };
    lastYear: { avgPriceTarget: number | null };
}

export interface RawSectorPerformance {
    sector: string;
    changesPercentage: number;
}

export interface RawHistoricalSectorPerformance {
    date: string;
    sector: string;
    changesPercentage: number;
}

export interface RawCashFlowStatement {
    operatingCashFlow: number | null;
}

export interface RawEarningsReport {
    symbol: string;
    date: string;
    raw: unknown;
}

/**
 * Fundamental data fetcher abstraction. Consumer (siglens) implements via
 * FMP `/stable/*` endpoints. Core only depends on this interface.
 *
 * Each method returns the raw FMP response shape (or null if unavailable).
 * Normalization to domain `FundamentalSnapshot` happens in the use-case
 * layer via `normalizeFundamentalSnapshot()` (Task 1.12 helper).
 */
export interface FundamentalDataProvider {
    getProfile(symbol: string): Promise<RawProfile | null>;
    getKeyMetricsTtm(symbol: string): Promise<RawKeyMetricsTtm | null>;
    getRatiosTtm(symbol: string): Promise<RawRatiosTtm | null>;
    getIncomeStatement(symbol: string): Promise<unknown | null>;
    getBalanceSheetStatement(symbol: string): Promise<unknown | null>;
    getCashFlowStatement(symbol: string): Promise<RawCashFlowStatement | null>;
    getIncomeStatementGrowth(symbol: string): Promise<RawIncomeGrowth | null>;
    getFinancialScores(symbol: string): Promise<RawFinancialScore | null>;
    getStockPeers(symbol: string): Promise<RawStockPeer[]>;
    getAnalystEstimates(symbol: string): Promise<RawAnalystEstimate | null>;
    /** Latest grading actions for the symbol (used by News page, but exposed here too). */
    getGrades(symbol: string, limit?: number): Promise<GradesEvent[]>;
    getGradesConsensus(symbol: string): Promise<RawGradesConsensus | null>;
    getPriceTargetConsensus(
        symbol: string
    ): Promise<RawPriceTargetConsensus | null>;
    getPriceTargetSummary(
        symbol: string
    ): Promise<RawPriceTargetSummary | null>;
    /** date format: YYYY-MM-DD. FMP date-range limited to last 1 year. */
    getSectorPerformanceSnapshot(
        date: string
    ): Promise<RawSectorPerformance[]>;
    getHistoricalSectorPerformance(
        sector: string
    ): Promise<RawHistoricalSectorPerformance[]>;
    getEarningsReport(symbol: string): Promise<RawEarningsReport | null>;
}

/** Normalize raw FMP responses into the domain `FundamentalSnapshot`. */
export function normalizeFundamentalSnapshot(input: {
    profile: RawProfile;
    keyMetricsTtm: RawKeyMetricsTtm | null;
    ratiosTtm: RawRatiosTtm | null;
    cashFlow: RawCashFlowStatement | null;
    incomeGrowth: RawIncomeGrowth | null;
    financialScores: RawFinancialScore | null;
    peers: RawStockPeer[];
    analystEstimate: RawAnalystEstimate | null;
    gradesConsensus: RawGradesConsensus | null;
    priceTargetConsensus: RawPriceTargetConsensus | null;
    priceTargetSummary: RawPriceTargetSummary | null;
    nextEarningsAt: string | null;
    sectorTodayChangePct: number | null;
    sectorHistorical: Array<{ date: string; changePct: number }>;
}): FundamentalSnapshot {
    return {
        profile: {
            symbol: input.profile.symbol,
            companyName: input.profile.companyName,
            sector: input.profile.sector,
            industry: input.profile.industry,
            marketCap: input.profile.mktCap,
            ceo: input.profile.ceo,
            website: input.profile.website,
            description: input.profile.description,
        },
        valuation: {
            per: input.keyMetricsTtm?.peRatioTTM ?? null,
            psr: input.keyMetricsTtm?.priceToSalesRatioTTM ?? null,
            pbr: input.keyMetricsTtm?.pbRatioTTM ?? null,
            peg: input.keyMetricsTtm?.pegRatioTTM ?? null,
            evToEbitda:
                input.keyMetricsTtm?.enterpriseValueOverEBITDATTM ?? null,
            eps: input.keyMetricsTtm?.epsTTM ?? null,
        },
        peers: input.peers.map((p) => ({
            symbol: p.symbol,
            companyName: p.companyName,
            marketCap: p.marketCap,
        })),
        profitability: {
            roe: input.ratiosTtm?.returnOnEquityTTM ?? null,
            roa: input.ratiosTtm?.returnOnAssetsTTM ?? null,
            operatingMargin: input.ratiosTtm?.operatingProfitMarginTTM ?? null,
            netMargin: input.ratiosTtm?.netProfitMarginTTM ?? null,
        },
        growth: {
            revenueYoy: input.incomeGrowth?.growthRevenue ?? null,
            epsYoy: input.incomeGrowth?.growthEPS ?? null,
        },
        health: {
            debtRatio: input.ratiosTtm?.debtRatioTTM ?? null,
            currentRatio: input.ratiosTtm?.currentRatioTTM ?? null,
            operatingCashFlow: input.cashFlow?.operatingCashFlow ?? null,
            altmanZScore: input.financialScores?.altmanZScore ?? null,
            piotroskiScore: input.financialScores?.piotroskiScore ?? null,
        },
        futureDirection: {
            nextEarningsAt: input.nextEarningsAt,
            analystEstimateEps: input.analystEstimate?.estimatedEpsAvg ?? null,
            analystEstimateRevenue:
                input.analystEstimate?.estimatedRevenueAvg ?? null,
            gradesConsensus: input.gradesConsensus,
            priceTargetConsensus: input.priceTargetConsensus
                ? {
                      high: input.priceTargetConsensus.targetHigh,
                      low: input.priceTargetConsensus.targetLow,
                      median: input.priceTargetConsensus.targetMedian,
                      consensus: input.priceTargetConsensus.targetConsensus,
                  }
                : null,
            priceTargetSummary: input.priceTargetSummary
                ? {
                      month1Avg:
                          input.priceTargetSummary.lastMonth.avgPriceTarget,
                      month3Avg:
                          input.priceTargetSummary.lastQuarter.avgPriceTarget,
                      year1Avg:
                          input.priceTargetSummary.lastYear.avgPriceTarget,
                  }
                : null,
        },
        sectorDirection: {
            todayChangePct: input.sectorTodayChangePct,
            historical: input.sectorHistorical,
        },
    };
}
```

- [ ] **Step 2: Compile check**

Run: `yarn tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/fundamental/types.ts
git commit -m "feat: FundamentalDataProvider 인터페이스 + snapshot 정규화 함수"
```

### Task 1.5: NewsProvider 인터페이스

**Files:**
- Create: `src/infrastructure/news/types.ts`

- [ ] **Step 1: 인터페이스 작성**

```typescript
// src/infrastructure/news/types.ts
import type {
    EarningsCalendarItem,
    EarningsReport,
    NewsItem,
} from '@/domain/types';

export type NewsTimeRange = '24h' | '7d' | '30d';

/**
 * News + earnings calendar fetcher. Consumer (siglens) implements via
 * FMP `/stable/news/stock`, `/stable/earnings-calendar`, `/stable/earnings`.
 *
 * `fetchEarningsCalendarAll` returns the entire calendar (no symbol filter
 * available on FMP). Consumer must DB-cache it via Cron (Phase 2 Task 2.5).
 */
export interface NewsProvider {
    fetchNews(
        symbol: string,
        range: NewsTimeRange
    ): Promise<NewsItem[]>;
    fetchEarningsCalendarAll(): Promise<EarningsCalendarItem[]>;
    fetchEarningsReport(symbol: string): Promise<EarningsReport | null>;
}
```

- [ ] **Step 2: Compile check**

Run: `yarn tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/news/types.ts
git commit -m "feat: NewsProvider 인터페이스 정의"
```

### Task 1.6: Skills loader — fundamental/news 카테고리 확장

**Files:**
- Modify: `src/infrastructure/skills/loader.ts`
- Test: `src/__tests__/infrastructure/skills/loader.test.ts`

- [ ] **Step 1: failing test 추가**

기존 `loader.test.ts` 파악 후 추가 테스트:

```typescript
test('loads fundamental category skills', async () => {
    // 가짜 skills 디렉토리 mock 또는 실제 fixture에 fundamental/sample.md 추가
    const loader = new FileSkillsLoader('./test-fixtures/skills');
    const skills = await loader.loadSkills();
    const fundamental = skills.filter((s) => s.category === 'fundamental');
    expect(fundamental.length).toBeGreaterThanOrEqual(1);
});

test('loads news category skills', async () => {
    const loader = new FileSkillsLoader('./test-fixtures/skills');
    const skills = await loader.loadSkills();
    const news = skills.filter((s) => s.category === 'news');
    expect(news.length).toBeGreaterThanOrEqual(1);
});
```

테스트 fixture 디렉토리 셋업: `test-fixtures/skills/fundamental/sample.md`, `test-fixtures/skills/news/sample.md` (각각 frontmatter + 짧은 body).

- [ ] **Step 2: Run failing test**

Run: `yarn test src/__tests__/infrastructure/skills/loader.test.ts`

Expected: FAIL — loader가 새 카테고리를 인식하지 못하거나 fixture 미존재

- [ ] **Step 3: loader 확장**

`src/infrastructure/skills/loader.ts`에서 카테고리 화이트리스트가 있으면 `'fundamental'`, `'news'` 추가. 없고 디렉토리명을 그대로 사용한다면 `SkillCategory` union 갱신만으로 통과.

```typescript
// 만약 ALLOWED_CATEGORIES 같은 상수가 있다면:
const ALLOWED_CATEGORIES: readonly SkillCategory[] = [
    'patterns',
    'strategies',
    'indicators',
    'fundamental',
    'news',
] as const;
```

- [ ] **Step 4: Run test — pass**

Run: `yarn test src/__tests__/infrastructure/skills/loader.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/skills/loader.ts src/__tests__/infrastructure/skills/loader.test.ts test-fixtures/skills/
git commit -m "feat: Skills loader fundamental/news 카테고리 지원"
```

### Task 1.7: buildFundamentalAnalysisPrompt

**Files:**
- Create: `src/domain/analysis/fundamentalPrompt.ts`
- Test: `src/__tests__/domain/analysis/fundamentalPrompt.test.ts`

- [ ] **Step 1: failing test**

```typescript
import { buildFundamentalAnalysisPrompt } from '@/domain/analysis/fundamentalPrompt';
import type { FundamentalSnapshot, Skill } from '@/domain/types';

describe('buildFundamentalAnalysisPrompt', () => {
    const snapshot: FundamentalSnapshot = {
        profile: {
            symbol: 'AAPL',
            companyName: 'Apple Inc.',
            sector: 'Technology',
            industry: 'Consumer Electronics',
            marketCap: 3_000_000_000_000,
            ceo: 'Tim Cook',
            website: 'https://apple.com',
            description: 'Designs and sells consumer electronics.',
        },
        valuation: {
            per: 30, psr: 8, pbr: 50, peg: 2.5, evToEbitda: 22, eps: 6.5,
        },
        peers: [{ symbol: 'MSFT', companyName: 'Microsoft', marketCap: 3e12 }],
        profitability: { roe: 0.5, roa: 0.25, operatingMargin: 0.3, netMargin: 0.25 },
        growth: { revenueYoy: 0.05, epsYoy: 0.08 },
        health: {
            debtRatio: 0.4, currentRatio: 1.1, operatingCashFlow: 1.2e11,
            altmanZScore: 5.2, piotroskiScore: 7,
        },
        futureDirection: {
            nextEarningsAt: '2026-05-15',
            analystEstimateEps: 1.55,
            analystEstimateRevenue: 95e9,
            gradesConsensus: { strongBuy: 12, buy: 8, hold: 5, sell: 1, strongSell: 0 },
            priceTargetConsensus: { high: 250, low: 180, median: 220, consensus: 215 },
            priceTargetSummary: { month1Avg: 218, month3Avg: 215, year1Avg: 240 },
        },
        sectorDirection: {
            todayChangePct: 0.012,
            historical: [{ date: '2026-04-30', changePct: 0.006 }],
        },
    };

    test('includes symbol and key valuation numbers', () => {
        const prompt = buildFundamentalAnalysisPrompt('AAPL', snapshot, []);
        expect(prompt).toContain('AAPL');
        expect(prompt).toContain('PER');
        expect(prompt).toContain('30');
    });

    test('filters skills with confidence_weight < 0.5', () => {
        const skills: Skill[] = [
            { name: 'high', category: 'fundamental', confidenceWeight: 0.8, body: 'INCLUDE' } as Skill,
            { name: 'low', category: 'fundamental', confidenceWeight: 0.3, body: 'EXCLUDE' } as Skill,
        ];
        const prompt = buildFundamentalAnalysisPrompt('AAPL', snapshot, skills);
        expect(prompt).toContain('INCLUDE');
        expect(prompt).not.toContain('EXCLUDE');
    });

    test('only includes fundamental category skills', () => {
        const skills: Skill[] = [
            { name: 'fund', category: 'fundamental', confidenceWeight: 0.8, body: 'FUNDBODY' } as Skill,
            { name: 'pat', category: 'patterns', confidenceWeight: 0.8, body: 'PATBODY' } as Skill,
        ];
        const prompt = buildFundamentalAnalysisPrompt('AAPL', snapshot, skills);
        expect(prompt).toContain('FUNDBODY');
        expect(prompt).not.toContain('PATBODY');
    });
});
```

- [ ] **Step 2: Run failing test**

Run: `yarn test src/__tests__/domain/analysis/fundamentalPrompt.test.ts`

Expected: FAIL — module 미존재

- [ ] **Step 3: 구현**

```typescript
// src/domain/analysis/fundamentalPrompt.ts
// All AI-facing prompt strings must be in English — Korean reduces analysis quality.

import { MIN_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';
import type { FundamentalSnapshot, Skill } from '@/domain/types';

const SYSTEM_INSTRUCTION = `You are a senior equity research analyst. Analyze the company fundamentals and return JSON matching this shape:
{
  "overallConclusionKo": "한국어 한 단락",
  "categoryAssessments": [
    {"category":"valuation","sentiment":"bullish|neutral|bearish","rationaleKo":"한 단락"},
    {"category":"profitability","sentiment":"...","rationaleKo":"..."},
    {"category":"growth","sentiment":"...","rationaleKo":"..."},
    {"category":"health","sentiment":"...","rationaleKo":"..."},
    {"category":"futureDirection","sentiment":"...","rationaleKo":"..."}
  ],
  "riskFactorsKo": ["...", "..."],
  "overallSentiment": "bullish|neutral|bearish"
}
Do not recommend buy/sell. Stay analytical.`;

function formatSkills(skills: readonly Skill[]): string {
    const filtered = skills.filter(
        (s) =>
            s.category === 'fundamental' &&
            s.confidenceWeight >= MIN_CONFIDENCE_WEIGHT
    );
    if (filtered.length === 0) return '';
    return [
        '\n## Active analyst frameworks',
        ...filtered.map(
            (s) => `### ${s.name} (weight ${s.confidenceWeight})\n${s.body}`
        ),
    ].join('\n');
}

function formatSnapshot(s: FundamentalSnapshot): string {
    return `
## Company
- ${s.profile.companyName} (${s.profile.symbol}) — ${s.profile.sector} / ${s.profile.industry}
- Market cap: ${s.profile.marketCap}
- CEO: ${s.profile.ceo ?? 'n/a'}
- Description: ${s.profile.description ?? 'n/a'}

## Valuation (TTM)
- PER: ${s.valuation.per ?? 'n/a'}
- PSR: ${s.valuation.psr ?? 'n/a'}
- PBR: ${s.valuation.pbr ?? 'n/a'}
- PEG: ${s.valuation.peg ?? 'n/a'}
- EV/EBITDA: ${s.valuation.evToEbitda ?? 'n/a'}
- EPS: ${s.valuation.eps ?? 'n/a'}

## Peers
${s.peers.map((p) => `- ${p.symbol} (${p.companyName}) mcap=${p.marketCap}`).join('\n')}

## Profitability
- ROE: ${s.profitability.roe ?? 'n/a'}
- ROA: ${s.profitability.roa ?? 'n/a'}
- Operating margin: ${s.profitability.operatingMargin ?? 'n/a'}
- Net margin: ${s.profitability.netMargin ?? 'n/a'}

## Growth (YoY)
- Revenue: ${s.growth.revenueYoy ?? 'n/a'}
- EPS: ${s.growth.epsYoy ?? 'n/a'}

## Financial health
- Debt ratio: ${s.health.debtRatio ?? 'n/a'}
- Current ratio: ${s.health.currentRatio ?? 'n/a'}
- Operating cash flow: ${s.health.operatingCashFlow ?? 'n/a'}
- Altman Z: ${s.health.altmanZScore ?? 'n/a'}
- Piotroski: ${s.health.piotroskiScore ?? 'n/a'}

## Future direction
- Next earnings: ${s.futureDirection.nextEarningsAt ?? 'n/a'}
- Analyst EPS estimate: ${s.futureDirection.analystEstimateEps ?? 'n/a'}
- Analyst revenue estimate: ${s.futureDirection.analystEstimateRevenue ?? 'n/a'}
- Grades consensus: ${JSON.stringify(s.futureDirection.gradesConsensus)}
- Price target consensus: ${JSON.stringify(s.futureDirection.priceTargetConsensus)}
- Price target summary (1m/3m/12m avg): ${JSON.stringify(s.futureDirection.priceTargetSummary)}

## Sector direction
- Today change: ${s.sectorDirection.todayChangePct ?? 'n/a'}
- Recent history: ${JSON.stringify(s.sectorDirection.historical.slice(0, 30))}
`.trim();
}

export function buildFundamentalAnalysisPrompt(
    symbol: string,
    snapshot: FundamentalSnapshot,
    skills: readonly Skill[]
): string {
    return `${SYSTEM_INSTRUCTION}

# Symbol: ${symbol}
${formatSnapshot(snapshot)}
${formatSkills(skills)}`;
}
```

- [ ] **Step 4: Run test — pass**

Run: `yarn test src/__tests__/domain/analysis/fundamentalPrompt.test.ts`

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/fundamentalPrompt.ts src/__tests__/domain/analysis/fundamentalPrompt.test.ts
git commit -m "feat: buildFundamentalAnalysisPrompt 추가"
```

### Task 1.8: buildNewsAnalysisPrompt

**Files:**
- Create: `src/domain/analysis/newsPrompt.ts`
- Test: `src/__tests__/domain/analysis/newsPrompt.test.ts`

- [ ] **Step 1: failing test**

```typescript
import { buildNewsAnalysisPrompt } from '@/domain/analysis/newsPrompt';
import type {
    EarningsCalendarItem,
    NewsCardAnalysis,
    NewsItem,
    Skill,
} from '@/domain/types';

const news: Array<NewsItem & { card: NewsCardAnalysis }> = [
    {
        id: 'n1',
        symbol: 'AAPL',
        source: 'Reuters',
        url: 'https://r.com/n1',
        publishedAt: '2026-05-01T10:00:00Z',
        titleEn: 'Apple beats Q2 estimates',
        bodyEn: 'Apple reported earnings...',
        card: {
            titleKo: '애플 2분기 어닝 서프라이즈',
            bodyKo: '애플이 …',
            summaryKo: '애플 EPS 컨센 상회',
            sentiment: 'bullish',
            category: 'earnings',
        },
    },
];
const calendar: EarningsCalendarItem[] = [
    {
        symbol: 'AAPL',
        earningsDate: '2026-08-01',
        epsActual: null,
        epsEstimated: 1.6,
        revenueActual: null,
        revenueEstimated: 95e9,
        lastUpdated: '2026-04-30',
    },
];

test('prompt includes symbol, news titles, upcoming events', () => {
    const p = buildNewsAnalysisPrompt('AAPL', news, calendar, []);
    expect(p).toContain('AAPL');
    expect(p).toContain('Apple beats Q2 estimates');
    expect(p).toContain('2026-08-01');
});

test('skills filtered to news category and weight >= 0.5', () => {
    const skills: Skill[] = [
        { name: 'a', category: 'news', confidenceWeight: 0.8, body: 'NEWSBODY' } as Skill,
        { name: 'b', category: 'news', confidenceWeight: 0.3, body: 'WEAKBODY' } as Skill,
        { name: 'c', category: 'patterns', confidenceWeight: 0.9, body: 'PATBODY' } as Skill,
    ];
    const p = buildNewsAnalysisPrompt('AAPL', news, calendar, skills);
    expect(p).toContain('NEWSBODY');
    expect(p).not.toContain('WEAKBODY');
    expect(p).not.toContain('PATBODY');
});
```

- [ ] **Step 2: Run failing test**

Run: `yarn test src/__tests__/domain/analysis/newsPrompt.test.ts`
Expected: FAIL — module 미존재

- [ ] **Step 3: 구현**

```typescript
// src/domain/analysis/newsPrompt.ts
// All AI-facing prompt strings must be in English — Korean reduces analysis quality.

import { MIN_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';
import type {
    EarningsCalendarItem,
    NewsCardAnalysis,
    NewsItem,
    Skill,
} from '@/domain/types';

const SYSTEM_INSTRUCTION = `You are a senior market analyst. Synthesize the news flow + upcoming events into a Korean summary. Return JSON:
{
  "currentDriverKo": "현재 가격 흐름의 뉴스 원인 한 단락",
  "keyEventsKo": ["...", "..."],
  "upcomingEventsKo": ["...", "..."],
  "overallSentiment": "bullish|neutral|bearish"
}
Do not recommend buy/sell. Stay analytical.`;

function formatSkills(skills: readonly Skill[]): string {
    const f = skills.filter(
        (s) =>
            s.category === 'news' && s.confidenceWeight >= MIN_CONFIDENCE_WEIGHT
    );
    if (f.length === 0) return '';
    return [
        '\n## Active news frameworks',
        ...f.map((s) => `### ${s.name} (weight ${s.confidenceWeight})\n${s.body}`),
    ].join('\n');
}

export function buildNewsAnalysisPrompt(
    symbol: string,
    news: ReadonlyArray<NewsItem & { card: NewsCardAnalysis }>,
    upcomingCalendar: readonly EarningsCalendarItem[],
    skills: readonly Skill[]
): string {
    const newsBlock = news
        .map(
            (n) =>
                `- [${n.publishedAt}] ${n.titleEn}\n  KO: ${n.card.titleKo} (${n.card.sentiment}, ${n.card.category})\n  summary: ${n.card.summaryKo}`
        )
        .join('\n');
    const eventsBlock = upcomingCalendar
        .map(
            (c) =>
                `- ${c.earningsDate} earnings (est EPS ${c.epsEstimated ?? 'n/a'} / est rev ${c.revenueEstimated ?? 'n/a'})`
        )
        .join('\n');
    return `${SYSTEM_INSTRUCTION}

# Symbol: ${symbol}

## Recent news
${newsBlock || '(none)'}

## Upcoming events
${eventsBlock || '(none)'}

${formatSkills(skills)}`;
}
```

- [ ] **Step 4: Run test — pass**

Run: `yarn test src/__tests__/domain/analysis/newsPrompt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/newsPrompt.ts src/__tests__/domain/analysis/newsPrompt.test.ts
git commit -m "feat: buildNewsAnalysisPrompt 추가"
```

### Task 1.9: buildNewsCardAnalysisPrompt (flash-lite 묶음 호출용)

**Files:**
- Create: `src/domain/analysis/newsCardPrompt.ts`
- Test: `src/__tests__/domain/analysis/newsCardPrompt.test.ts`

- [ ] **Step 1: failing test**

```typescript
import { buildNewsCardAnalysisPrompt } from '@/domain/analysis/newsCardPrompt';

test('prompt includes title, body, and asks for translation+summary+sentiment', () => {
    const p = buildNewsCardAnalysisPrompt({
        id: 'n1',
        symbol: 'AAPL',
        source: 'Reuters',
        url: 'https://r.com',
        publishedAt: '2026-05-01T10:00:00Z',
        titleEn: 'Apple beats Q2 estimates',
        bodyEn: 'Apple reported strong earnings ...',
    });
    expect(p).toContain('Apple beats Q2 estimates');
    expect(p).toContain('Apple reported strong earnings');
    expect(p).toContain('titleKo');
    expect(p).toContain('summaryKo');
    expect(p).toContain('sentiment');
    expect(p).toContain('category');
});

test('omits body when null', () => {
    const p = buildNewsCardAnalysisPrompt({
        id: 'n1', symbol: 'AAPL', source: 'r', url: 'u',
        publishedAt: '2026-05-01T10:00:00Z',
        titleEn: 'Title only',
        bodyEn: null,
    });
    expect(p).toContain('Title only');
    expect(p).toContain('bodyKo": null');
});
```

- [ ] **Step 2: Run failing test**

Run: `yarn test src/__tests__/domain/analysis/newsCardPrompt.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/domain/analysis/newsCardPrompt.ts
// All AI-facing prompt strings must be in English.

import type { NewsItem } from '@/domain/types';

const SYSTEM_INSTRUCTION = `Translate the following English news to Korean and return STRICT JSON:
{
  "titleKo": "<한국어 제목>",
  "bodyKo": "<한국어 본문 또는 null>",
  "summaryKo": "<한 문장 한국어 요약>",
  "sentiment": "bullish" | "neutral" | "bearish",
  "category": "earnings" | "m_and_a" | "guidance" | "regulation" | "macro" | "product" | "other"
}
Sentiment is from a stock investor's perspective on this single news (not the broader market). Category is the dominant theme. Do not include any prose outside JSON.`;

export function buildNewsCardAnalysisPrompt(item: NewsItem): string {
    const bodyHint = item.bodyEn ?? '(no body provided — bodyKo must be null)';
    return `${SYSTEM_INSTRUCTION}

Title: ${item.titleEn}
Body: ${bodyHint}
Source: ${item.source}
Published: ${item.publishedAt}`;
}
```

- [ ] **Step 4: Run test — pass**

Run: `yarn test src/__tests__/domain/analysis/newsCardPrompt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/newsCardPrompt.ts src/__tests__/domain/analysis/newsCardPrompt.test.ts
git commit -m "feat: buildNewsCardAnalysisPrompt 추가 (flash-lite 묶음 호출용)"
```

### Task 1.10: buildOverallAnalysisPrompt

**Files:**
- Create: `src/domain/analysis/overallPrompt.ts`
- Test: `src/__tests__/domain/analysis/overallPrompt.test.ts`

- [ ] **Step 1: failing test**

```typescript
import { buildOverallAnalysisPrompt } from '@/domain/analysis/overallPrompt';
import type {
    AnalysisResponse,
    FundamentalAnalysisResponse,
    NewsAnalysisResponse,
    Timeframe,
} from '@/domain/types';

const technical: AnalysisResponse = {
    summary: 'Uptrend with strong momentum',
    trend: 'bullish',
    indicatorResults: [],
    riskLevel: 'medium',
    keyLevels: { support: [180], resistance: [220] },
    priceTargets: { bullish: { targets: [], condition: '' }, bearish: { targets: [], condition: '' } },
    patternSummaries: [],
    strategyResults: [],
    candlePatterns: [],
    trendlines: [],
};
const fundamental: FundamentalAnalysisResponse = {
    overallConclusionKo: '밸류에이션 부담은 있으나 펀더 견조',
    categoryAssessments: [],
    riskFactorsKo: [],
    overallSentiment: 'bullish',
};
const news: NewsAnalysisResponse = {
    currentDriverKo: '어닝 서프라이즈에 따른 단기 랠리',
    keyEventsKo: [],
    upcomingEventsKo: [],
    overallSentiment: 'bullish',
};

test('prompt includes timeframe context for 5m', () => {
    const p = buildOverallAnalysisPrompt('AAPL', technical, fundamental, news, '5m' as Timeframe);
    expect(p).toContain('AAPL');
    expect(p).toContain('5m');
    // 타임프레임 맥락 (단타) 키워드
    expect(p.toLowerCase()).toMatch(/intraday|short-term|단타|short/);
});

test('prompt includes timeframe context for daily', () => {
    const p = buildOverallAnalysisPrompt('AAPL', technical, fundamental, news, '1d' as Timeframe);
    expect(p.toLowerCase()).toMatch(/long-term|swing|장기|positional/);
});

test('prompt embeds tech/fund/news summaries', () => {
    const p = buildOverallAnalysisPrompt('AAPL', technical, fundamental, news, '1d' as Timeframe);
    expect(p).toContain('Uptrend with strong momentum');
    expect(p).toContain('밸류에이션 부담은 있으나');
    expect(p).toContain('어닝 서프라이즈');
});
```

- [ ] **Step 2: Run failing test**

Run: `yarn test src/__tests__/domain/analysis/overallPrompt.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/domain/analysis/overallPrompt.ts
// All AI-facing prompt strings must be in English (timeframe label retained).

import type {
    AnalysisResponse,
    FundamentalAnalysisResponse,
    NewsAnalysisResponse,
    Timeframe,
} from '@/domain/types';

const TIMEFRAME_CONTEXT: Record<string, string> = {
    '1m': 'Intraday scalping context. Focus on micro-structure, tape, news reactions in minutes.',
    '5m': 'Intraday short-term trading context. Focus on momentum bursts and news reactions within hours.',
    '15m': 'Intraday swing context. Focus on session-level trends.',
    '30m': 'Day-trading context. Focus on session reversals and continuation patterns.',
    '1h': 'Short-term swing context (multi-day).',
    '4h': 'Multi-day swing context.',
    '1d': 'Long-term positional context (weeks to months). Macro/fundamental signals weigh heavily.',
};

const SYSTEM_INSTRUCTION = `You are a senior multi-axis equity analyst integrating technical, fundamental, and news flow into one decision-support narrative. Return JSON:
{
  "headlineKo": "한 줄 정의 + 현재 상태 한 단락",
  "technicalBulletsKo": ["..."],
  "fundamentalBulletsKo": ["..."],
  "newsBulletsKo": ["..."],
  "threeAxisConclusionKo": "3축 종합 결론 (한 단락 또는 두 단락)",
  "scenarios": [
    {"name":"bullish","triggerConditionKo":"...","priceRangeKo":"..."},
    {"name":"neutral","triggerConditionKo":"...","priceRangeKo":"..."},
    {"name":"bearish","triggerConditionKo":"...","priceRangeKo":"..."}
  ],
  "riskFactorsKo": ["..."]
}
Do not recommend buy/sell. Stay analytical.`;

export function buildOverallAnalysisPrompt(
    symbol: string,
    technical: AnalysisResponse,
    fundamental: FundamentalAnalysisResponse,
    news: NewsAnalysisResponse,
    timeframe: Timeframe
): string {
    const tfContext =
        TIMEFRAME_CONTEXT[timeframe] ??
        'General multi-day analytical context.';
    return `${SYSTEM_INSTRUCTION}

# Symbol: ${symbol}
# Timeframe: ${timeframe}
# Timeframe context: ${tfContext}

## Technical (from chart analysis)
- Trend: ${technical.trend}
- Risk: ${technical.riskLevel}
- Summary: ${technical.summary}
- Support: ${technical.keyLevels.support.join(', ')}
- Resistance: ${technical.keyLevels.resistance.join(', ')}

## Fundamental
- Overall sentiment: ${fundamental.overallSentiment}
- Conclusion: ${fundamental.overallConclusionKo}
- Risks: ${fundamental.riskFactorsKo.join(' / ')}

## News
- Overall sentiment: ${news.overallSentiment}
- Current driver: ${news.currentDriverKo}
- Key events: ${news.keyEventsKo.join(' / ')}
- Upcoming: ${news.upcomingEventsKo.join(' / ')}`;
}
```

- [ ] **Step 4: Run test — pass**

Run: `yarn test src/__tests__/domain/analysis/overallPrompt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/overallPrompt.ts src/__tests__/domain/analysis/overallPrompt.test.ts
git commit -m "feat: buildOverallAnalysisPrompt 추가 (3축 통합 + 타임프레임 맥락)"
```

### Task 1.11: 응답 정규화 함수 3종

**Files:**
- Create: `src/domain/analysis/normalizeFundamental.ts`, `normalizeNews.ts`, `normalizeOverall.ts`
- Test: 각각의 `__tests__/domain/analysis/normalize*.test.ts`

각 정규화 함수는 LLM이 반환한 raw JSON 문자열을 파싱·검증·필드 보정하여 도메인 타입으로 변환. 잘못된 JSON 또는 필드 누락 시 명확한 에러를 throw (호출 측 `pollXxx`에서 catch → `error` 상태).

- [ ] **Step 1: normalizeFundamental — failing test**

```typescript
import { normalizeFundamentalAnalysisResponse } from '@/domain/analysis/normalizeFundamental';

test('parses valid JSON', () => {
    const raw = JSON.stringify({
        overallConclusionKo: '결론',
        categoryAssessments: [
            { category: 'valuation', sentiment: 'bullish', rationaleKo: '근거' },
        ],
        riskFactorsKo: ['리스크1'],
        overallSentiment: 'bullish',
    });
    const r = normalizeFundamentalAnalysisResponse(raw);
    expect(r.overallSentiment).toBe('bullish');
    expect(r.categoryAssessments).toHaveLength(1);
});

test('throws on missing required field', () => {
    const raw = JSON.stringify({ overallConclusionKo: '결론' });
    expect(() => normalizeFundamentalAnalysisResponse(raw)).toThrow();
});

test('throws on invalid sentiment', () => {
    const raw = JSON.stringify({
        overallConclusionKo: '결론',
        categoryAssessments: [],
        riskFactorsKo: [],
        overallSentiment: 'invalid',
    });
    expect(() => normalizeFundamentalAnalysisResponse(raw)).toThrow();
});
```

- [ ] **Step 2: normalizeFundamental — 구현**

```typescript
// src/domain/analysis/normalizeFundamental.ts
import type {
    FundamentalAnalysisResponse,
    FundamentalSentiment,
} from '@/domain/types';

const SENTIMENTS: readonly FundamentalSentiment[] = [
    'bullish',
    'neutral',
    'bearish',
];

function isSentiment(v: unknown): v is FundamentalSentiment {
    return typeof v === 'string' && (SENTIMENTS as readonly string[]).includes(v);
}

function extractJson(raw: string): unknown {
    const trimmed = raw.trim().replace(/^```json\s*/, '').replace(/```\s*$/, '');
    return JSON.parse(trimmed);
}

export function normalizeFundamentalAnalysisResponse(
    raw: string
): FundamentalAnalysisResponse {
    const parsed = extractJson(raw) as Record<string, unknown>;
    if (typeof parsed.overallConclusionKo !== 'string') {
        throw new Error('overallConclusionKo missing or not a string');
    }
    if (!Array.isArray(parsed.categoryAssessments)) {
        throw new Error('categoryAssessments missing or not array');
    }
    if (!Array.isArray(parsed.riskFactorsKo)) {
        throw new Error('riskFactorsKo missing or not array');
    }
    if (!isSentiment(parsed.overallSentiment)) {
        throw new Error('overallSentiment invalid');
    }
    return {
        overallConclusionKo: parsed.overallConclusionKo,
        categoryAssessments: parsed.categoryAssessments as FundamentalAnalysisResponse['categoryAssessments'],
        riskFactorsKo: parsed.riskFactorsKo as string[],
        overallSentiment: parsed.overallSentiment,
    };
}
```

- [ ] **Step 3: normalizeNews + normalizeNewsCardAnalysis — failing test + 구현**

```typescript
// src/domain/analysis/normalizeNews.ts
import type { NewsAnalysisResponse, NewsCardAnalysis, NewsCategory, NewsSentiment } from '@/domain/types';

const SENTIMENTS: readonly NewsSentiment[] = ['bullish', 'neutral', 'bearish'];
const CATEGORIES: readonly NewsCategory[] = [
    'earnings', 'm_and_a', 'guidance', 'regulation', 'macro', 'product', 'other',
];

function extractJson(raw: string): unknown {
    return JSON.parse(raw.trim().replace(/^```json\s*/, '').replace(/```\s*$/, ''));
}

export function normalizeNewsAnalysisResponse(raw: string): NewsAnalysisResponse {
    const p = extractJson(raw) as Record<string, unknown>;
    if (typeof p.currentDriverKo !== 'string') throw new Error('currentDriverKo missing');
    if (!Array.isArray(p.keyEventsKo)) throw new Error('keyEventsKo missing');
    if (!Array.isArray(p.upcomingEventsKo)) throw new Error('upcomingEventsKo missing');
    if (!SENTIMENTS.includes(p.overallSentiment as NewsSentiment)) {
        throw new Error('overallSentiment invalid');
    }
    return {
        currentDriverKo: p.currentDriverKo,
        keyEventsKo: p.keyEventsKo as string[],
        upcomingEventsKo: p.upcomingEventsKo as string[],
        overallSentiment: p.overallSentiment as NewsSentiment,
    };
}

export function normalizeNewsCardAnalysis(raw: string): NewsCardAnalysis {
    const p = extractJson(raw) as Record<string, unknown>;
    if (typeof p.titleKo !== 'string') throw new Error('titleKo missing');
    if (!(typeof p.bodyKo === 'string' || p.bodyKo === null)) throw new Error('bodyKo invalid');
    if (typeof p.summaryKo !== 'string') throw new Error('summaryKo missing');
    if (!SENTIMENTS.includes(p.sentiment as NewsSentiment)) throw new Error('sentiment invalid');
    if (!CATEGORIES.includes(p.category as NewsCategory)) throw new Error('category invalid');
    return {
        titleKo: p.titleKo,
        bodyKo: p.bodyKo as string | null,
        summaryKo: p.summaryKo,
        sentiment: p.sentiment as NewsSentiment,
        category: p.category as NewsCategory,
    };
}
```

- [ ] **Step 4: normalizeOverall — failing test + 구현**

```typescript
// src/domain/analysis/normalizeOverall.ts
import type { OverallAnalysisResponse, OverallScenarioName } from '@/domain/types';

const SCENARIOS: readonly OverallScenarioName[] = ['bullish', 'neutral', 'bearish'];

function extractJson(raw: string): unknown {
    return JSON.parse(raw.trim().replace(/^```json\s*/, '').replace(/```\s*$/, ''));
}

export function normalizeOverallAnalysisResponse(raw: string): OverallAnalysisResponse {
    const p = extractJson(raw) as Record<string, unknown>;
    if (typeof p.headlineKo !== 'string') throw new Error('headlineKo missing');
    for (const k of ['technicalBulletsKo', 'fundamentalBulletsKo', 'newsBulletsKo', 'riskFactorsKo']) {
        if (!Array.isArray(p[k])) throw new Error(`${k} missing`);
    }
    if (typeof p.threeAxisConclusionKo !== 'string') throw new Error('threeAxisConclusionKo missing');
    if (!Array.isArray(p.scenarios)) throw new Error('scenarios missing');
    for (const s of p.scenarios as Array<Record<string, unknown>>) {
        if (!SCENARIOS.includes(s.name as OverallScenarioName)) {
            throw new Error(`scenario name invalid: ${String(s.name)}`);
        }
        if (typeof s.triggerConditionKo !== 'string') throw new Error('triggerConditionKo missing');
        if (typeof s.priceRangeKo !== 'string') throw new Error('priceRangeKo missing');
    }
    return p as unknown as OverallAnalysisResponse;
}
```

- [ ] **Step 5: 모든 normalize 테스트 PASS 확인**

Run: `yarn test src/__tests__/domain/analysis/normalize`
Expected: PASS (3 파일)

- [ ] **Step 6: Commit**

```bash
git add src/domain/analysis/normalize{Fundamental,News,Overall}.ts src/__tests__/domain/analysis/normalize*.test.ts
git commit -m "feat: 새 분석 3종 응답 정규화 함수 추가"
```

### Task 1.12: Fundamental analysis use-case

**Files:**
- Create: `src/application/fundamental/types.ts`
- Create: `src/application/fundamental/submitFundamentalAnalysis.ts`
- Create: `src/application/fundamental/pollFundamentalAnalysis.ts`
- Create: `src/application/fundamental/cancelFundamentalAnalysisJob.ts`
- Test: `src/__tests__/application/fundamental/submitFundamentalAnalysis.test.ts`

> 기준 패턴: 기존 `src/application/market/submitAnalysis.ts`의 흐름을 그대로 차용. tier check → cache lookup → fetch → buildPrompt → enqueue job → fireAndForget worker dispatch.

- [ ] **Step 1: types.ts 작성**

```typescript
// src/application/fundamental/types.ts
import type { AnalysisUsageOptions } from '@/application/market/types';
import type {
    FundamentalAnalysisResponse,
    Tier,
    TierConfig,
} from '@/domain/types';
import type { FundamentalDataProvider } from '@/infrastructure/fundamental/types';

export interface SubmitFundamentalAnalysisOptions {
    symbol: string;
    tier?: Tier;
    tierConfig?: TierConfig;
    modelId: string;
    dataProvider: FundamentalDataProvider;
    /** Optional usage tracking. */
    usage?: AnalysisUsageOptions;
    /** For tests — inject clock. */
    now?: Date;
}

export type SubmitFundamentalAnalysisResult =
    | { status: 'cached'; result: FundamentalAnalysisResponse }
    | { status: 'submitted'; jobId: string }
    | {
          status: 'error';
          code: 'usage_limit_exceeded' | 'fetch_failed';
          message: string;
      };

export type PollFundamentalAnalysisResult =
    | { status: 'processing' }
    | { status: 'done'; result: FundamentalAnalysisResponse }
    | { status: 'error'; error: string };
```

- [ ] **Step 2: submitFundamentalAnalysis — failing test (mock 기반)**

```typescript
// src/__tests__/application/fundamental/submitFundamentalAnalysis.test.ts
import { submitFundamentalAnalysis } from '@/application/fundamental/submitFundamentalAnalysis';
import type { FundamentalDataProvider } from '@/infrastructure/fundamental/types';

const mockProvider: FundamentalDataProvider = {
    getProfile: jest.fn().mockResolvedValue({
        symbol: 'AAPL', companyName: 'Apple', sector: 'Technology',
        industry: 'CE', mktCap: 3e12, ceo: 'Tim', website: null, description: null,
    }),
    getKeyMetricsTtm: jest.fn().mockResolvedValue(null),
    getRatiosTtm: jest.fn().mockResolvedValue(null),
    getIncomeStatement: jest.fn().mockResolvedValue(null),
    getBalanceSheetStatement: jest.fn().mockResolvedValue(null),
    getCashFlowStatement: jest.fn().mockResolvedValue(null),
    getIncomeStatementGrowth: jest.fn().mockResolvedValue(null),
    getFinancialScores: jest.fn().mockResolvedValue(null),
    getStockPeers: jest.fn().mockResolvedValue([]),
    getAnalystEstimates: jest.fn().mockResolvedValue(null),
    getGrades: jest.fn().mockResolvedValue([]),
    getGradesConsensus: jest.fn().mockResolvedValue(null),
    getPriceTargetConsensus: jest.fn().mockResolvedValue(null),
    getPriceTargetSummary: jest.fn().mockResolvedValue(null),
    getSectorPerformanceSnapshot: jest.fn().mockResolvedValue([]),
    getHistoricalSectorPerformance: jest.fn().mockResolvedValue([]),
    getEarningsReport: jest.fn().mockResolvedValue(null),
};

jest.mock('@/infrastructure/cache/redis', () => ({
    createCacheProvider: () => ({
        get: jest.fn().mockResolvedValue(null), // cache miss
        set: jest.fn().mockResolvedValue(undefined),
    }),
}));

jest.mock('@/infrastructure/jobs/queue', () => ({
    setJobMeta: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/application/background', () => ({
    fireAndForget: jest.fn(),
}));

test('submits a job when cache miss', async () => {
    const r = await submitFundamentalAnalysis({
        symbol: 'AAPL',
        modelId: 'gemini-2.5-pro',
        dataProvider: mockProvider,
    });
    expect(r.status).toBe('submitted');
    if (r.status === 'submitted') {
        expect(r.jobId).toMatch(/.+/);
    }
});

test('returns cached when cache hit', async () => {
    jest.resetModules();
    jest.doMock('@/infrastructure/cache/redis', () => ({
        createCacheProvider: () => ({
            get: jest.fn().mockResolvedValue({
                overallConclusionKo: '캐시된 결론',
                categoryAssessments: [],
                riskFactorsKo: [],
                overallSentiment: 'neutral',
            }),
            set: jest.fn(),
        }),
    }));
    const { submitFundamentalAnalysis: fresh } = await import(
        '@/application/fundamental/submitFundamentalAnalysis'
    );
    const r = await fresh({
        symbol: 'AAPL',
        modelId: 'gemini-2.5-pro',
        dataProvider: mockProvider,
    });
    expect(r.status).toBe('cached');
});
```

- [ ] **Step 3: 구현 — submitFundamentalAnalysis**

```typescript
// src/application/fundamental/submitFundamentalAnalysis.ts
import { createHash } from 'node:crypto';
import { fireAndForget } from '@/application/background';
import { buildFundamentalAnalysisPrompt } from '@/domain/analysis/fundamentalPrompt';
import { DEFAULT_TIER, TIER_CONFIG } from '@/domain/tier';
import type { FundamentalSnapshot, Skill, Tier, TierConfig } from '@/domain/types';
import {
    buildFundamentalCacheKey,
    FUNDAMENTAL_CACHE_TTL_SECONDS,
} from '@/infrastructure/cache/config';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    normalizeFundamentalSnapshot,
} from '@/infrastructure/fundamental/types';
import { setJobMeta } from '@/infrastructure/jobs/queue';
import { readWorkerConfig } from '@/infrastructure/market/config';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import type {
    SubmitFundamentalAnalysisOptions,
    SubmitFundamentalAnalysisResult,
} from './types';

function hashSnapshot(s: FundamentalSnapshot): string {
    return createHash('sha256').update(JSON.stringify(s)).digest('hex').slice(0, 16);
}

async function loadSkillsBestEffort(): Promise<Skill[]> {
    try {
        const loader = new FileSkillsLoader();
        return await loader.loadSkills();
    } catch {
        return [];
    }
}

async function fetchSnapshot(
    opts: SubmitFundamentalAnalysisOptions
): Promise<FundamentalSnapshot> {
    const p = opts.dataProvider;
    const symbol = opts.symbol;
    const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
    const profile = await p.getProfile(symbol);
    if (!profile) {
        throw new Error('profile_not_found');
    }
    const [
        keyMetricsTtm, ratiosTtm, cashFlow, incomeGrowth, financialScores,
        peers, analystEstimate, gradesConsensus, priceTargetConsensus,
        priceTargetSummary, earningsReport, sectorSnapshot, sectorHistorical,
    ] = await Promise.all([
        p.getKeyMetricsTtm(symbol),
        p.getRatiosTtm(symbol),
        p.getCashFlowStatement(symbol),
        p.getIncomeStatementGrowth(symbol),
        p.getFinancialScores(symbol),
        p.getStockPeers(symbol),
        p.getAnalystEstimates(symbol),
        p.getGradesConsensus(symbol),
        p.getPriceTargetConsensus(symbol),
        p.getPriceTargetSummary(symbol),
        p.getEarningsReport(symbol),
        p.getSectorPerformanceSnapshot(today),
        // sector lookup — sector name from profile
        p.getHistoricalSectorPerformance(profile.sector),
    ]);
    const todaySector = sectorSnapshot.find((s) => s.sector === profile.sector);
    return normalizeFundamentalSnapshot({
        profile,
        keyMetricsTtm, ratiosTtm, cashFlow, incomeGrowth, financialScores,
        peers, analystEstimate, gradesConsensus, priceTargetConsensus,
        priceTargetSummary,
        nextEarningsAt: earningsReport?.date ?? null,
        sectorTodayChangePct: todaySector?.changesPercentage ?? null,
        sectorHistorical: sectorHistorical.map((h) => ({
            date: h.date, changePct: h.changesPercentage,
        })),
    });
}

export async function submitFundamentalAnalysis(
    options: SubmitFundamentalAnalysisOptions
): Promise<SubmitFundamentalAnalysisResult> {
    const tier = options.tier ?? DEFAULT_TIER;
    const tierConfig = options.tierConfig ?? TIER_CONFIG;
    void tier;
    void tierConfig;
    // tier-specific checks omitted — analysisPerDay 통합 정책 (Phase 4 enforce)

    let snapshot: FundamentalSnapshot;
    try {
        snapshot = await fetchSnapshot(options);
    } catch (error) {
        return {
            status: 'error',
            code: 'fetch_failed',
            message: error instanceof Error ? error.message : 'fetch_failed',
        };
    }

    const inputHash = hashSnapshot(snapshot);
    const cacheKey = buildFundamentalCacheKey(
        options.symbol, options.modelId, inputHash
    );
    const cache = createCacheProvider();
    const cached = (await cache.get(cacheKey)) as
        | (typeof snapshot extends never ? never : import('@/domain/types').FundamentalAnalysisResponse)
        | null;
    if (cached) {
        return { status: 'cached', result: cached };
    }

    const skills = await loadSkillsBestEffort();
    const prompt = buildFundamentalAnalysisPrompt(options.symbol, snapshot, skills);
    const jobId = `fund-${options.symbol}-${inputHash}-${options.modelId}-${Date.now()}`;
    await setJobMeta(jobId, {
        type: 'fundamental',
        symbol: options.symbol,
        modelId: options.modelId,
        cacheKey,
        promptLength: prompt.length,
    });
    fireAndForget(
        fetch(`${readWorkerConfig().url}/analyze`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jobId, prompt, model: options.modelId }),
        })
    );
    return { status: 'submitted', jobId };
}
```

- [ ] **Step 4: 구현 — pollFundamentalAnalysis**

```typescript
// src/application/fundamental/pollFundamentalAnalysis.ts
import { normalizeFundamentalAnalysisResponse } from '@/domain/analysis/normalizeFundamental';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    FUNDAMENTAL_CACHE_TTL_SECONDS,
} from '@/infrastructure/cache/config';
import {
    getJobError, getJobMeta, getJobResult, getJobStatus,
} from '@/infrastructure/jobs/queue';
import type { PollFundamentalAnalysisResult } from './types';

export async function pollFundamentalAnalysis(
    jobId: string
): Promise<PollFundamentalAnalysisResult> {
    const status = await getJobStatus(jobId);
    if (status === 'pending' || status === 'running') return { status: 'processing' };
    if (status === 'failed') {
        const err = await getJobError(jobId);
        return { status: 'error', error: err ?? 'unknown' };
    }
    const raw = await getJobResult(jobId);
    if (!raw) return { status: 'error', error: 'missing_result' };
    let normalized;
    try {
        normalized = normalizeFundamentalAnalysisResponse(raw);
    } catch (e) {
        return { status: 'error', error: e instanceof Error ? e.message : 'normalize_failed' };
    }
    const meta = await getJobMeta(jobId);
    if (meta?.cacheKey) {
        const cache = createCacheProvider();
        await cache.set(meta.cacheKey, normalized, FUNDAMENTAL_CACHE_TTL_SECONDS);
    }
    return { status: 'done', result: normalized };
}
```

- [ ] **Step 5: 구현 — cancelFundamentalAnalysisJob**

```typescript
// src/application/fundamental/cancelFundamentalAnalysisJob.ts
import { cancelAnalysisJob } from '@/application/market/cancelAnalysisJob';

/** Thin alias — the underlying job-queue cancel is type-agnostic. */
export const cancelFundamentalAnalysisJob = cancelAnalysisJob;
```

- [ ] **Step 6: Run tests**

Run: `yarn test src/__tests__/application/fundamental/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/application/fundamental/ src/__tests__/application/fundamental/
git commit -m "feat: Fundamental analysis use-case (submit/poll/cancel)"
```

### Task 1.13: News analysis use-case (종합)

**Files:**
- Create: `src/application/news/{types,submitNewsAnalysis,pollNewsAnalysis,cancelNewsAnalysisJob}.ts`
- Test: `src/__tests__/application/news/submitNewsAnalysis.test.ts`

> Same pattern as Task 1.12, but the input is a list of `NewsItem` (already enriched with `NewsCardAnalysis` from Task 1.14) plus next earnings calendar items. The "input hash" is `sha256(news_id_set + earnings_dates)` — order-stable.

- [ ] **Step 1: types — `NewsAnalysisInputs`**

```typescript
// src/application/news/types.ts
import type {
    EarningsCalendarItem,
    NewsAnalysisResponse,
    NewsCardAnalysis,
    NewsItem,
    Tier,
    TierConfig,
} from '@/domain/types';

export interface SubmitNewsAnalysisOptions {
    symbol: string;
    tier?: Tier;
    tierConfig?: TierConfig;
    modelId: string;
    /** Already analyzed news cards (from submitNewsCardAnalysis). */
    news: ReadonlyArray<NewsItem & { card: NewsCardAnalysis }>;
    upcomingCalendar: readonly EarningsCalendarItem[];
    now?: Date;
}

export type SubmitNewsAnalysisResult =
    | { status: 'cached'; result: NewsAnalysisResponse }
    | { status: 'submitted'; jobId: string }
    | { status: 'error'; code: 'no_news'; message: string };

export type PollNewsAnalysisResult =
    | { status: 'processing' }
    | { status: 'done'; result: NewsAnalysisResponse }
    | { status: 'error'; error: string };
```

- [ ] **Step 2: submitNewsAnalysis 구현**

> Same pattern as `submitFundamentalAnalysis`. Differences:
> - Input hash = sorted `news.map(n => n.id).join(',')` + `calendar dates joined`
> - `buildNewsAnalysisPrompt` 사용
> - Cache key: `buildNewsCacheKey(symbol, modelId, inputHash)`
> - TTL: `NEWS_CACHE_TTL_SECONDS`
> - Skills 필터: `category === 'news'`
> - Empty news → `error: 'no_news'` 즉시 반환

```typescript
// src/application/news/submitNewsAnalysis.ts
import { createHash } from 'node:crypto';
import { fireAndForget } from '@/application/background';
import { buildNewsAnalysisPrompt } from '@/domain/analysis/newsPrompt';
import {
    buildNewsCacheKey,
    NEWS_CACHE_TTL_SECONDS,
} from '@/infrastructure/cache/config';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { setJobMeta } from '@/infrastructure/jobs/queue';
import { readWorkerConfig } from '@/infrastructure/market/config';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import type {
    SubmitNewsAnalysisOptions,
    SubmitNewsAnalysisResult,
} from './types';

function buildInputHash(opts: SubmitNewsAnalysisOptions): string {
    const ids = [...opts.news.map((n) => n.id)].sort().join(',');
    const dates = [...opts.upcomingCalendar.map((c) => c.earningsDate)].sort().join(',');
    return createHash('sha256').update(`${ids}|${dates}`).digest('hex').slice(0, 16);
}

export async function submitNewsAnalysis(
    options: SubmitNewsAnalysisOptions
): Promise<SubmitNewsAnalysisResult> {
    if (options.news.length === 0) {
        return { status: 'error', code: 'no_news', message: 'No news to analyze' };
    }
    const inputHash = buildInputHash(options);
    const cacheKey = buildNewsCacheKey(options.symbol, options.modelId, inputHash);
    const cache = createCacheProvider();
    const cached = (await cache.get(cacheKey)) as
        | import('@/domain/types').NewsAnalysisResponse
        | null;
    if (cached) return { status: 'cached', result: cached };

    let skills: import('@/domain/types').Skill[] = [];
    try {
        skills = await new FileSkillsLoader().loadSkills();
    } catch {
        skills = [];
    }
    const prompt = buildNewsAnalysisPrompt(
        options.symbol,
        options.news,
        options.upcomingCalendar,
        skills
    );
    const jobId = `news-${options.symbol}-${inputHash}-${options.modelId}-${Date.now()}`;
    await setJobMeta(jobId, {
        type: 'news',
        symbol: options.symbol,
        modelId: options.modelId,
        cacheKey,
        promptLength: prompt.length,
    });
    fireAndForget(
        fetch(`${readWorkerConfig().url}/analyze`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jobId, prompt, model: options.modelId }),
        })
    );
    return { status: 'submitted', jobId };
}
```

- [ ] **Step 3: pollNewsAnalysis — Same pattern as Task 1.12 Step 4 (swap `normalizeFundamentalAnalysisResponse` → `normalizeNewsAnalysisResponse`, TTL → `NEWS_CACHE_TTL_SECONDS`)**

```typescript
// src/application/news/pollNewsAnalysis.ts
import { normalizeNewsAnalysisResponse } from '@/domain/analysis/normalizeNews';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { NEWS_CACHE_TTL_SECONDS } from '@/infrastructure/cache/config';
import {
    getJobError, getJobMeta, getJobResult, getJobStatus,
} from '@/infrastructure/jobs/queue';
import type { PollNewsAnalysisResult } from './types';

export async function pollNewsAnalysis(jobId: string): Promise<PollNewsAnalysisResult> {
    const status = await getJobStatus(jobId);
    if (status === 'pending' || status === 'running') return { status: 'processing' };
    if (status === 'failed') {
        return { status: 'error', error: (await getJobError(jobId)) ?? 'unknown' };
    }
    const raw = await getJobResult(jobId);
    if (!raw) return { status: 'error', error: 'missing_result' };
    let normalized;
    try {
        normalized = normalizeNewsAnalysisResponse(raw);
    } catch (e) {
        return { status: 'error', error: e instanceof Error ? e.message : 'normalize_failed' };
    }
    const meta = await getJobMeta(jobId);
    if (meta?.cacheKey) {
        await createCacheProvider().set(meta.cacheKey, normalized, NEWS_CACHE_TTL_SECONDS);
    }
    return { status: 'done', result: normalized };
}
```

- [ ] **Step 4: cancelNewsAnalysisJob — alias to `cancelAnalysisJob`**

```typescript
// src/application/news/cancelNewsAnalysisJob.ts
import { cancelAnalysisJob } from '@/application/market/cancelAnalysisJob';
export const cancelNewsAnalysisJob = cancelAnalysisJob;
```

- [ ] **Step 5: Run tests + Commit**

Run: `yarn test src/__tests__/application/news/`
Expected: PASS

```bash
git add src/application/news/ src/__tests__/application/news/
git commit -m "feat: News analysis use-case (submit/poll/cancel)"
```

### Task 1.14: News card use-case (flash-lite 묶음 호출)

**Files:**
- Create: `src/application/news/{submitNewsCardAnalysis,pollNewsCardAnalysis}.ts`
- Test: `src/__tests__/application/news/submitNewsCardAnalysis.test.ts`

> 1뉴스 = 1 LLM 호출. 모델 고정 `gemini-2.5-flash-lite`. 캐시 키 = `buildNewsCardCacheKey(news.id)`. 영구 캐시 (TTL=30d). 입력 데이터 변경 거의 없음 (뉴스 본문 immutable).

- [ ] **Step 1: 구현**

```typescript
// src/application/news/submitNewsCardAnalysis.ts
import { fireAndForget } from '@/application/background';
import { buildNewsCardAnalysisPrompt } from '@/domain/analysis/newsCardPrompt';
import type { NewsCardAnalysis, NewsItem } from '@/domain/types';
import { buildNewsCardCacheKey } from '@/infrastructure/cache/config';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { setJobMeta } from '@/infrastructure/jobs/queue';
import { readWorkerConfig } from '@/infrastructure/market/config';

const NEWS_CARD_MODEL = 'gemini-2.5-flash-lite' as const;

export type SubmitNewsCardAnalysisResult =
    | { status: 'cached'; result: NewsCardAnalysis }
    | { status: 'submitted'; jobId: string };

export async function submitNewsCardAnalysis(
    item: NewsItem
): Promise<SubmitNewsCardAnalysisResult> {
    const cacheKey = buildNewsCardCacheKey(item.id);
    const cache = createCacheProvider();
    const cached = (await cache.get(cacheKey)) as NewsCardAnalysis | null;
    if (cached) return { status: 'cached', result: cached };

    const prompt = buildNewsCardAnalysisPrompt(item);
    const jobId = `newscard-${item.id}-${Date.now()}`;
    await setJobMeta(jobId, {
        type: 'news-card',
        newsId: item.id,
        modelId: NEWS_CARD_MODEL,
        cacheKey,
    });
    fireAndForget(
        fetch(`${readWorkerConfig().url}/analyze`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jobId, prompt, model: NEWS_CARD_MODEL }),
        })
    );
    return { status: 'submitted', jobId };
}
```

```typescript
// src/application/news/pollNewsCardAnalysis.ts
import { normalizeNewsCardAnalysis } from '@/domain/analysis/normalizeNews';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { NEWS_CARD_CACHE_TTL_SECONDS } from '@/infrastructure/cache/config';
import {
    getJobError, getJobMeta, getJobResult, getJobStatus,
} from '@/infrastructure/jobs/queue';
import type { NewsCardAnalysis } from '@/domain/types';

export type PollNewsCardAnalysisResult =
    | { status: 'processing' }
    | { status: 'done'; result: NewsCardAnalysis }
    | { status: 'error'; error: string };

export async function pollNewsCardAnalysis(
    jobId: string
): Promise<PollNewsCardAnalysisResult> {
    const status = await getJobStatus(jobId);
    if (status === 'pending' || status === 'running') return { status: 'processing' };
    if (status === 'failed') {
        return { status: 'error', error: (await getJobError(jobId)) ?? 'unknown' };
    }
    const raw = await getJobResult(jobId);
    if (!raw) return { status: 'error', error: 'missing_result' };
    let normalized: NewsCardAnalysis;
    try {
        normalized = normalizeNewsCardAnalysis(raw);
    } catch (e) {
        return { status: 'error', error: e instanceof Error ? e.message : 'normalize_failed' };
    }
    const meta = await getJobMeta(jobId);
    if (meta?.cacheKey) {
        await createCacheProvider().set(meta.cacheKey, normalized, NEWS_CARD_CACHE_TTL_SECONDS);
    }
    return { status: 'done', result: normalized };
}
```

- [ ] **Step 2: failing test (cache miss → submitted, cache hit → cached)**

기존 mock 패턴 재사용. 두 case PASS 확인.

Run: `yarn test src/__tests__/application/news/submitNewsCardAnalysis.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/application/news/{submitNewsCardAnalysis,pollNewsCardAnalysis}.ts \
        src/__tests__/application/news/submitNewsCardAnalysis.test.ts
git commit -m "feat: News card 분석 use-case (flash-lite 묶음 호출, 영구 캐시)"
```

### Task 1.15: Overall dependency resolver

**Files:**
- Create: `src/application/overall/dependencyResolver.ts`
- Test: `src/__tests__/application/overall/dependencyResolver.test.ts`

목적: Overall 분석 인풋 의존성 (기술/펀더/뉴스) 캐시 룩업 + miss인 분석만 백그라운드 트리거. 단계별 상태 보고용 메타 반환.

- [ ] **Step 1: 구현**

```typescript
// src/application/overall/dependencyResolver.ts
import { submitAnalysis } from '@/application/market/submitAnalysis';
import { submitFundamentalAnalysis } from '@/application/fundamental/submitFundamentalAnalysis';
import { submitNewsAnalysis } from '@/application/news/submitNewsAnalysis';
import type {
    AnalysisResponse,
    EarningsCalendarItem,
    FundamentalAnalysisResponse,
    NewsAnalysisResponse,
    NewsCardAnalysis,
    NewsItem,
    Timeframe,
} from '@/domain/types';
import type { FundamentalDataProvider } from '@/infrastructure/fundamental/types';

export interface OverallDependencyInputs {
    symbol: string;
    timeframe: Timeframe;
    modelId: string;
    fundamentalProvider: FundamentalDataProvider;
    news: ReadonlyArray<NewsItem & { card: NewsCardAnalysis }>;
    upcomingCalendar: readonly EarningsCalendarItem[];
}

export type DependencyState =
    | { kind: 'cached'; technical: AnalysisResponse; fundamental: FundamentalAnalysisResponse; news: NewsAnalysisResponse }
    | { kind: 'pending'; pendingJobs: { technical?: string; fundamental?: string; news?: string } };

export async function resolveOverallDependencies(
    inputs: OverallDependencyInputs
): Promise<DependencyState> {
    const [tech, fund, news] = await Promise.all([
        submitAnalysis({
            symbol: inputs.symbol,
            timeframe: inputs.timeframe,
            modelId: inputs.modelId,
            // bars/indicators는 submitAnalysis 내부에서 fetch
        } as Parameters<typeof submitAnalysis>[0]),
        submitFundamentalAnalysis({
            symbol: inputs.symbol,
            modelId: inputs.modelId,
            dataProvider: inputs.fundamentalProvider,
        }),
        submitNewsAnalysis({
            symbol: inputs.symbol,
            modelId: inputs.modelId,
            news: inputs.news,
            upcomingCalendar: inputs.upcomingCalendar,
        }),
    ]);
    if (
        tech.status === 'cached' &&
        fund.status === 'cached' &&
        news.status === 'cached'
    ) {
        return {
            kind: 'cached',
            technical: tech.result,
            fundamental: fund.result,
            news: news.result,
        };
    }
    return {
        kind: 'pending',
        pendingJobs: {
            technical: tech.status === 'submitted' ? tech.jobId : undefined,
            fundamental: fund.status === 'submitted' ? fund.jobId : undefined,
            news: news.status === 'submitted' ? news.jobId : undefined,
        },
    };
}
```

- [ ] **Step 2: 테스트 — 모든 캐시 hit / 일부 miss / 전부 miss**

```typescript
// src/__tests__/application/overall/dependencyResolver.test.ts
import { resolveOverallDependencies } from '@/application/overall/dependencyResolver';

jest.mock('@/application/market/submitAnalysis', () => ({
    submitAnalysis: jest.fn(),
}));
jest.mock('@/application/fundamental/submitFundamentalAnalysis', () => ({
    submitFundamentalAnalysis: jest.fn(),
}));
jest.mock('@/application/news/submitNewsAnalysis', () => ({
    submitNewsAnalysis: jest.fn(),
}));

import { submitAnalysis } from '@/application/market/submitAnalysis';
import { submitFundamentalAnalysis } from '@/application/fundamental/submitFundamentalAnalysis';
import { submitNewsAnalysis } from '@/application/news/submitNewsAnalysis';

test('all cached → cached state', async () => {
    (submitAnalysis as jest.Mock).mockResolvedValue({ status: 'cached', result: { trend: 'bullish' } });
    (submitFundamentalAnalysis as jest.Mock).mockResolvedValue({ status: 'cached', result: { overallSentiment: 'bullish' } });
    (submitNewsAnalysis as jest.Mock).mockResolvedValue({ status: 'cached', result: { overallSentiment: 'bullish' } });
    const r = await resolveOverallDependencies({
        symbol: 'AAPL', timeframe: '1d', modelId: 'gemini-2.5-pro',
        fundamentalProvider: {} as never, news: [], upcomingCalendar: [],
    });
    expect(r.kind).toBe('cached');
});

test('any miss → pending state with jobIds', async () => {
    (submitAnalysis as jest.Mock).mockResolvedValue({ status: 'submitted', jobId: 'tech-1' });
    (submitFundamentalAnalysis as jest.Mock).mockResolvedValue({ status: 'cached', result: {} });
    (submitNewsAnalysis as jest.Mock).mockResolvedValue({ status: 'submitted', jobId: 'news-1' });
    const r = await resolveOverallDependencies({
        symbol: 'AAPL', timeframe: '1d', modelId: 'gemini-2.5-pro',
        fundamentalProvider: {} as never, news: [], upcomingCalendar: [],
    });
    expect(r.kind).toBe('pending');
    if (r.kind === 'pending') {
        expect(r.pendingJobs.technical).toBe('tech-1');
        expect(r.pendingJobs.news).toBe('news-1');
        expect(r.pendingJobs.fundamental).toBeUndefined();
    }
});
```

Run: `yarn test src/__tests__/application/overall/dependencyResolver.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/application/overall/dependencyResolver.ts src/__tests__/application/overall/dependencyResolver.test.ts
git commit -m "feat: Overall 의존성 resolver (캐시 룩업 + miss 백그라운드 트리거)"
```

### Task 1.16: Overall analysis use-case

**Files:**
- Create: `src/application/overall/{types,submitOverallAnalysis,pollOverallAnalysis,cancelOverallAnalysisJob}.ts`
- Test: `src/__tests__/application/overall/submitOverallAnalysis.test.ts`

- [ ] **Step 1: types**

```typescript
// src/application/overall/types.ts
import type { OverallAnalysisResponse, Timeframe } from '@/domain/types';
import type { OverallDependencyInputs } from './dependencyResolver';

export interface SubmitOverallAnalysisOptions extends OverallDependencyInputs {
    /** Same as dependencyInputs */
}

export type SubmitOverallAnalysisResult =
    | { status: 'cached'; result: OverallAnalysisResponse }
    | { status: 'pending_dependencies'; pendingJobs: Record<string, string | undefined> }
    | { status: 'submitted'; jobId: string };

export type PollOverallAnalysisResult =
    | { status: 'processing' }
    | { status: 'done'; result: OverallAnalysisResponse }
    | { status: 'error'; error: string };
```

- [ ] **Step 2: submitOverallAnalysis 구현**

```typescript
// src/application/overall/submitOverallAnalysis.ts
import { createHash } from 'node:crypto';
import { fireAndForget } from '@/application/background';
import { buildOverallAnalysisPrompt } from '@/domain/analysis/overallPrompt';
import {
    buildOverallCacheKey,
} from '@/infrastructure/cache/config';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { setJobMeta } from '@/infrastructure/jobs/queue';
import { readWorkerConfig } from '@/infrastructure/market/config';
import { resolveOverallDependencies } from './dependencyResolver';
import type {
    SubmitOverallAnalysisOptions,
    SubmitOverallAnalysisResult,
} from './types';

export async function submitOverallAnalysis(
    options: SubmitOverallAnalysisOptions
): Promise<SubmitOverallAnalysisResult> {
    const deps = await resolveOverallDependencies(options);
    if (deps.kind === 'pending') {
        return { status: 'pending_dependencies', pendingJobs: deps.pendingJobs };
    }
    const inputHash = createHash('sha256')
        .update(
            JSON.stringify({
                t: deps.technical,
                f: deps.fundamental,
                n: deps.news,
            })
        )
        .digest('hex')
        .slice(0, 16);
    const cacheKey = buildOverallCacheKey(
        options.symbol, options.timeframe, options.modelId, inputHash
    );
    const cache = createCacheProvider();
    const cached = (await cache.get(cacheKey)) as
        | import('@/domain/types').OverallAnalysisResponse
        | null;
    if (cached) return { status: 'cached', result: cached };

    const prompt = buildOverallAnalysisPrompt(
        options.symbol, deps.technical, deps.fundamental, deps.news, options.timeframe
    );
    const jobId = `overall-${options.symbol}-${options.timeframe}-${inputHash}-${options.modelId}-${Date.now()}`;
    await setJobMeta(jobId, {
        type: 'overall',
        symbol: options.symbol,
        timeframe: options.timeframe,
        modelId: options.modelId,
        cacheKey,
        promptLength: prompt.length,
    });
    fireAndForget(
        fetch(`${readWorkerConfig().url}/analyze`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jobId, prompt, model: options.modelId }),
        })
    );
    return { status: 'submitted', jobId };
}
```

- [ ] **Step 3: pollOverallAnalysis — Same pattern as Task 1.12 Step 4 (swap normalize)**

```typescript
// src/application/overall/pollOverallAnalysis.ts
import { normalizeOverallAnalysisResponse } from '@/domain/analysis/normalizeOverall';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { OVERALL_CACHE_TTL_SECONDS } from '@/infrastructure/cache/config';
import {
    getJobError, getJobMeta, getJobResult, getJobStatus,
} from '@/infrastructure/jobs/queue';
import type { PollOverallAnalysisResult } from './types';

export async function pollOverallAnalysis(jobId: string): Promise<PollOverallAnalysisResult> {
    const status = await getJobStatus(jobId);
    if (status === 'pending' || status === 'running') return { status: 'processing' };
    if (status === 'failed') {
        return { status: 'error', error: (await getJobError(jobId)) ?? 'unknown' };
    }
    const raw = await getJobResult(jobId);
    if (!raw) return { status: 'error', error: 'missing_result' };
    let normalized;
    try {
        normalized = normalizeOverallAnalysisResponse(raw);
    } catch (e) {
        return { status: 'error', error: e instanceof Error ? e.message : 'normalize_failed' };
    }
    const meta = await getJobMeta(jobId);
    if (meta?.cacheKey) {
        await createCacheProvider().set(meta.cacheKey, normalized, OVERALL_CACHE_TTL_SECONDS);
    }
    return { status: 'done', result: normalized };
}
```

- [ ] **Step 4: cancelOverallAnalysisJob**

```typescript
// src/application/overall/cancelOverallAnalysisJob.ts
import { cancelAnalysisJob } from '@/application/market/cancelAnalysisJob';
export const cancelOverallAnalysisJob = cancelAnalysisJob;
```

- [ ] **Step 5: 통합 test — 모든 의존 cached → submitted**

기존 mock 재사용 (dependencyResolver mock).

Run: `yarn test src/__tests__/application/overall/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/application/overall/ src/__tests__/application/overall/
git commit -m "feat: Overall analysis use-case (의존성 자동 처리 + submit/poll/cancel)"
```

### Task 1.17: buildChatPrompt — currentAnalysisContext 파라미터 추가

**Files:**
- Modify: `src/domain/chat/buildChatPrompt.ts`
- Test: `src/__tests__/domain/chat/buildChatPrompt.test.ts`

- [ ] **Step 1: failing test 추가**

```typescript
import { buildChatPrompt } from '@/domain/chat/buildChatPrompt';

test('includes fundamental context when provided', () => {
    const p = buildChatPrompt({
        // ... 기존 필수 파라미터
        currentAnalysisContext: {
            kind: 'fundamental',
            payload: { overallConclusionKo: '펀더 견조', overallSentiment: 'bullish' } as never,
        },
    } as never);
    expect(p).toMatch(/fundamental|펀더/i);
    expect(p).toContain('펀더 견조');
});

test('omits context section when currentAnalysisContext is undefined', () => {
    const p = buildChatPrompt({} as never);
    expect(p).not.toMatch(/펀더 견조/);
});
```

- [ ] **Step 2: 구현 — 시그니처 확장**

기존 `buildChatPrompt` 함수 시그니처에 옵셔널 파라미터 추가:

```typescript
export interface BuildChatPromptOptions {
    // ... 기존 필드
    currentAnalysisContext?:
        | { kind: 'technical'; payload: AnalysisResponse }
        | { kind: 'fundamental'; payload: FundamentalAnalysisResponse }
        | { kind: 'news'; payload: NewsAnalysisResponse }
        | { kind: 'overall'; payload: OverallAnalysisResponse };
}

export function buildChatPrompt(opts: BuildChatPromptOptions): string {
    const ctxSection = opts.currentAnalysisContext
        ? formatContext(opts.currentAnalysisContext)
        : '';
    return `${/* 기존 prompt body */}${ctxSection}`;
}

function formatContext(
    ctx: NonNullable<BuildChatPromptOptions['currentAnalysisContext']>
): string {
    switch (ctx.kind) {
        case 'technical':
            return `\n## Current technical analysis context\n${ctx.payload.summary}`;
        case 'fundamental':
            return `\n## Current fundamental analysis context\n${ctx.payload.overallConclusionKo}`;
        case 'news':
            return `\n## Current news analysis context\n${ctx.payload.currentDriverKo}`;
        case 'overall':
            return `\n## Current overall analysis context\n${ctx.payload.headlineKo}`;
    }
}
```

- [ ] **Step 3: Run test PASS + Commit**

Run: `yarn test src/__tests__/domain/chat/buildChatPrompt.test.ts`
Expected: PASS

```bash
git add src/domain/chat/buildChatPrompt.ts src/__tests__/domain/chat/buildChatPrompt.test.ts
git commit -m "feat: buildChatPrompt에 currentAnalysisContext 파라미터 추가"
```

### Task 1.18: src/index.ts public API 갱신 + PUBLIC_API.md

**Files:**
- Modify: `src/index.ts`
- Modify: `docs/PUBLIC_API.md`

- [ ] **Step 1: src/index.ts에 새 export 추가**

```typescript
// src/index.ts에 추가
// Fundamental
export { submitFundamentalAnalysis } from './application/fundamental/submitFundamentalAnalysis';
export { pollFundamentalAnalysis } from './application/fundamental/pollFundamentalAnalysis';
export { cancelFundamentalAnalysisJob } from './application/fundamental/cancelFundamentalAnalysisJob';
export { buildFundamentalAnalysisPrompt } from './domain/analysis/fundamentalPrompt';
export { normalizeFundamentalAnalysisResponse } from './domain/analysis/normalizeFundamental';
export { normalizeFundamentalSnapshot } from './infrastructure/fundamental/types';
export type {
    FundamentalDataProvider,
    RawProfile, RawKeyMetricsTtm, RawRatiosTtm, RawIncomeGrowth,
    RawFinancialScore, RawStockPeer, RawAnalystEstimate, RawGradesConsensus,
    RawPriceTargetConsensus, RawPriceTargetSummary, RawSectorPerformance,
    RawHistoricalSectorPerformance, RawCashFlowStatement, RawEarningsReport,
} from './infrastructure/fundamental/types';

// News
export { submitNewsAnalysis } from './application/news/submitNewsAnalysis';
export { pollNewsAnalysis } from './application/news/pollNewsAnalysis';
export { cancelNewsAnalysisJob } from './application/news/cancelNewsAnalysisJob';
export { submitNewsCardAnalysis } from './application/news/submitNewsCardAnalysis';
export { pollNewsCardAnalysis } from './application/news/pollNewsCardAnalysis';
export { buildNewsAnalysisPrompt } from './domain/analysis/newsPrompt';
export { buildNewsCardAnalysisPrompt } from './domain/analysis/newsCardPrompt';
export {
    normalizeNewsAnalysisResponse,
    normalizeNewsCardAnalysis,
} from './domain/analysis/normalizeNews';
export type { NewsProvider, NewsTimeRange } from './infrastructure/news/types';

// Overall
export { submitOverallAnalysis } from './application/overall/submitOverallAnalysis';
export { pollOverallAnalysis } from './application/overall/pollOverallAnalysis';
export { cancelOverallAnalysisJob } from './application/overall/cancelOverallAnalysisJob';
export { resolveOverallDependencies } from './application/overall/dependencyResolver';
export { buildOverallAnalysisPrompt } from './domain/analysis/overallPrompt';
export { normalizeOverallAnalysisResponse } from './domain/analysis/normalizeOverall';

// Cache key builders
export {
    buildFundamentalCacheKey,
    buildNewsCacheKey,
    buildNewsCardCacheKey,
    buildOverallCacheKey,
    FUNDAMENTAL_CACHE_TTL_SECONDS,
    NEWS_CACHE_TTL_SECONDS,
    NEWS_CARD_CACHE_TTL_SECONDS,
    OVERALL_CACHE_TTL_SECONDS,
} from './infrastructure/cache/config';

// Types — append to existing type re-exports
export type {
    FundamentalAnalysisResponse,
    FundamentalCategoryAssessment,
    FundamentalSentiment,
    FundamentalSnapshot,
    NewsAnalysisResponse,
    NewsCardAnalysis,
    NewsCategory,
    NewsItem,
    NewsSentiment,
    EarningsCalendarItem,
    EarningsReport,
    GradesEvent,
    OverallAnalysisResponse,
    OverallScenario,
    OverallScenarioName,
} from './domain/types';
```

- [ ] **Step 2: docs/PUBLIC_API.md 인벤토리 갱신**

새 export를 적절한 Tier(1=stable use-case, 2=stable type, etc) 분류에 추가. 기존 형식 따라.

- [ ] **Step 3: Compile check**

Run: `yarn tsc --noEmit && yarn build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/index.ts docs/PUBLIC_API.md
git commit -m "feat: 새 분석 use-case + 타입 + Provider 인터페이스 public export"
```

### Task 1.19: 전체 검증 — lint + test + build

- [ ] **Step 1: lint**

Run: `yarn lint`
Expected: clean

- [ ] **Step 2: test**

Run: `yarn test`
Expected: 모든 테스트 PASS

- [ ] **Step 3: build (npm 패키지 산출물 확인)**

Run: `yarn build`
Expected: `dist/` 갱신, 새 export가 `dist/index.d.ts`에 포함

- [ ] **Step 4: dist 출력 확인**

Run: `grep -E "submitFundamentalAnalysis|submitNewsAnalysis|submitOverallAnalysis|FundamentalDataProvider|NewsProvider" dist/index.d.ts`
Expected: 해당 export 라인 모두 출력

### Task 1.20: 버전 bump + CHANGELOG + PR 생성 + npm publish

- [ ] **Step 1: package.json version 0.7.1 → 0.8.0-beta.1**

```bash
yarn version --new-version 0.8.0-beta.1 --no-git-tag-version
```

- [ ] **Step 2: CHANGELOG.md 항목 추가**

```markdown
## 0.8.0-beta.1 (2026-05-02)

### feat
- 새 분석 use-case 3종: `submitFundamentalAnalysis`, `submitNewsAnalysis`, `submitOverallAnalysis` (각 poll/cancel 동반)
- 카드별 뉴스 분석: `submitNewsCardAnalysis` (gemini-2.5-flash-lite, 영구 캐시)
- Provider 인터페이스 신설: `FundamentalDataProvider`, `NewsProvider`
- Skills loader가 `fundamental`, `news` 카테고리 스캔 지원
- `buildChatPrompt`에 `currentAnalysisContext` 파라미터 추가
```

- [ ] **Step 3: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: 0.8.0-beta.1 릴리스 준비"
```

- [ ] **Step 4: PR 생성 (siglens-core, base: main)**

git-agent에게 위임:
- base: main
- 제목: `feat: 펀더/뉴스/종합 분석 use-case + Provider 인터페이스 추가`
- 본문: spec 링크 + Cross-repo PR (`siglens` 측 PR 링크는 Phase 2 완료 후 추가)

- [ ] **Step 5: PR 머지 후 npm publish**

```bash
yarn publish --tag beta --access public
```

(또는 `npm publish --tag beta`)

Expected: `@y0ngha/siglens-core@0.8.0-beta.1` 게시 완료

---

## Phase 2: siglens (cwd: `/Users/y0ngha/Project/siglens-fund-news-analysis`)

> Phase 1 publish 완료 후 진행. 모든 작업은 siglens 워크트리에서.

### Task 2.0: siglens-core 의존성 업데이트

**Files:** `package.json`

- [ ] **Step 1: 새 버전 설치**

```bash
cd /Users/y0ngha/Project/siglens-fund-news-analysis
yarn add @y0ngha/siglens-core@0.8.0-beta.1
```

- [ ] **Step 2: TypeScript 컴파일 확인 (기존 코드는 깨지지 않아야 함)**

Run: `yarn tsc --noEmit`
Expected: PASS (새 export는 unused 경고만 가능)

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: siglens-core 0.8.0-beta.1 의존성 업데이트"
```

### Task 2.1: FMP Fundamental Client (`FundamentalDataProvider` 구현)

**Files:**
- Create: `src/infrastructure/fmp/fundamentalClient.ts`
- Create: `src/infrastructure/fmp/types.ts` (FMP raw response 타입)
- Test: `src/__tests__/infrastructure/fmp/fundamentalClient.test.ts`

기존 FMP fetch 패턴(있다면 `src/infrastructure/market/`에서 시세 fetch 코드) 따름. 환경변수 `FMP_API_KEY` 사용.

- [ ] **Step 1: 핵심 fetch helper**

```typescript
// src/infrastructure/fmp/fundamentalClient.ts
import type {
    FundamentalDataProvider,
    GradesEvent,
    RawAnalystEstimate, RawCashFlowStatement, RawEarningsReport,
    RawFinancialScore, RawGradesConsensus, RawHistoricalSectorPerformance,
    RawIncomeGrowth, RawKeyMetricsTtm, RawPriceTargetConsensus,
    RawPriceTargetSummary, RawProfile, RawRatiosTtm, RawSectorPerformance,
    RawStockPeer,
} from '@y0ngha/siglens-core';

const FMP_BASE = 'https://financialmodelingprep.com/stable';

function getApiKey(): string {
    const k = process.env.FMP_API_KEY;
    if (!k) throw new Error('FMP_API_KEY missing');
    return k;
}

async function fmpGet<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const params = new URLSearchParams({ ...query, apikey: getApiKey() });
    const res = await fetch(`${FMP_BASE}/${path}?${params.toString()}`, {
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`FMP ${path} ${res.status}`);
    return (await res.json()) as T;
}

export class FmpFundamentalClient implements FundamentalDataProvider {
    async getProfile(symbol: string): Promise<RawProfile | null> {
        const arr = await fmpGet<RawProfile[]>('profile', { symbol });
        return arr[0] ?? null;
    }
    async getKeyMetricsTtm(symbol: string): Promise<RawKeyMetricsTtm | null> {
        const arr = await fmpGet<RawKeyMetricsTtm[]>('key-metrics-ttm', { symbol });
        return arr[0] ?? null;
    }
    async getRatiosTtm(symbol: string): Promise<RawRatiosTtm | null> {
        const arr = await fmpGet<RawRatiosTtm[]>('ratios-ttm', { symbol });
        return arr[0] ?? null;
    }
    async getIncomeStatement(symbol: string): Promise<unknown | null> {
        return fmpGet<unknown[]>('income-statement', { symbol });
    }
    async getBalanceSheetStatement(symbol: string): Promise<unknown | null> {
        return fmpGet<unknown[]>('balance-sheet-statement', { symbol });
    }
    async getCashFlowStatement(symbol: string): Promise<RawCashFlowStatement | null> {
        const arr = await fmpGet<RawCashFlowStatement[]>('cash-flow-statement', { symbol });
        return arr[0] ?? null;
    }
    async getIncomeStatementGrowth(symbol: string): Promise<RawIncomeGrowth | null> {
        const arr = await fmpGet<RawIncomeGrowth[]>('income-statement-growth', { symbol });
        return arr[0] ?? null;
    }
    async getFinancialScores(symbol: string): Promise<RawFinancialScore | null> {
        const arr = await fmpGet<RawFinancialScore[]>('financial-scores', { symbol });
        return arr[0] ?? null;
    }
    async getStockPeers(symbol: string): Promise<RawStockPeer[]> {
        return fmpGet<RawStockPeer[]>('stock-peers', { symbol });
    }
    async getAnalystEstimates(symbol: string): Promise<RawAnalystEstimate | null> {
        const arr = await fmpGet<RawAnalystEstimate[]>('analyst-estimates', {
            symbol, period: 'annual', limit: '1',
        });
        return arr[0] ?? null;
    }
    async getGrades(symbol: string, limit = 20): Promise<GradesEvent[]> {
        const raw = await fmpGet<Array<{
            symbol: string; date: string; gradingCompany: string;
            previousGrade: string | null; newGrade: string; action: string;
        }>>('grades', { symbol, limit: String(limit) });
        return raw.map((g) => ({
            symbol: g.symbol, date: g.date, gradingCompany: g.gradingCompany,
            previousGrade: g.previousGrade, newGrade: g.newGrade,
            action: (['upgrade', 'downgrade', 'maintained', 'initiated'] as const).includes(
                g.action as never
            ) ? g.action as GradesEvent['action'] : 'other',
        }));
    }
    async getGradesConsensus(symbol: string): Promise<RawGradesConsensus | null> {
        const arr = await fmpGet<RawGradesConsensus[]>('grades-consensus', { symbol });
        return arr[0] ?? null;
    }
    async getPriceTargetConsensus(symbol: string): Promise<RawPriceTargetConsensus | null> {
        const arr = await fmpGet<RawPriceTargetConsensus[]>('price-target-consensus', { symbol });
        return arr[0] ?? null;
    }
    async getPriceTargetSummary(symbol: string): Promise<RawPriceTargetSummary | null> {
        const arr = await fmpGet<RawPriceTargetSummary[]>('price-target-summary', { symbol });
        return arr[0] ?? null;
    }
    async getSectorPerformanceSnapshot(date: string): Promise<RawSectorPerformance[]> {
        return fmpGet<RawSectorPerformance[]>('sector-performance-snapshot', { date });
    }
    async getHistoricalSectorPerformance(sector: string): Promise<RawHistoricalSectorPerformance[]> {
        return fmpGet<RawHistoricalSectorPerformance[]>('historical-sector-performance', { sector });
    }
    async getEarningsReport(symbol: string): Promise<RawEarningsReport | null> {
        const arr = await fmpGet<Array<{ symbol: string; date: string; [k: string]: unknown }>>(
            'earnings', { symbol }
        );
        const latest = arr[0];
        return latest ? { symbol: latest.symbol, date: latest.date, raw: latest } : null;
    }
}
```

- [ ] **Step 2: 단위 테스트 — fetch mock**

```typescript
// src/__tests__/infrastructure/fmp/fundamentalClient.test.ts
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';

const originalFetch = global.fetch;

beforeEach(() => {
    process.env.FMP_API_KEY = 'test-key';
});
afterAll(() => {
    global.fetch = originalFetch;
});

test('getProfile returns first array element', async () => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{
            symbol: 'AAPL', companyName: 'Apple', sector: 'Technology',
            industry: 'CE', mktCap: 3e12, ceo: 'Tim', website: null, description: null,
        }]),
    }) as never;
    const c = new FmpFundamentalClient();
    const p = await c.getProfile('AAPL');
    expect(p?.symbol).toBe('AAPL');
});

test('throws when FMP_API_KEY missing', async () => {
    delete process.env.FMP_API_KEY;
    const c = new FmpFundamentalClient();
    await expect(c.getProfile('AAPL')).rejects.toThrow(/FMP_API_KEY/);
});

test('throws on non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as never;
    const c = new FmpFundamentalClient();
    await expect(c.getProfile('AAPL')).rejects.toThrow(/429/);
});
```

Run: `yarn test src/__tests__/infrastructure/fmp/fundamentalClient.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/fmp/fundamentalClient.ts src/__tests__/infrastructure/fmp/fundamentalClient.test.ts
git commit -m "feat: FMP Fundamental client (16개 endpoint)"
```

### Task 2.2: FMP News + Earnings Client (`NewsProvider` 구현)

**Files:**
- Create: `src/infrastructure/fmp/newsClient.ts`
- Test: `src/__tests__/infrastructure/fmp/newsClient.test.ts`

> Same pattern as Task 2.1, swap endpoints.

- [ ] **Step 1: 구현**

```typescript
// src/infrastructure/fmp/newsClient.ts
import type {
    EarningsCalendarItem, EarningsReport, NewsItem, NewsProvider, NewsTimeRange,
} from '@y0ngha/siglens-core';

const FMP_BASE = 'https://financialmodelingprep.com/stable';

function getApiKey(): string {
    const k = process.env.FMP_API_KEY;
    if (!k) throw new Error('FMP_API_KEY missing');
    return k;
}

async function fmpGet<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const params = new URLSearchParams({ ...query, apikey: getApiKey() });
    const res = await fetch(`${FMP_BASE}/${path}?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`FMP ${path} ${res.status}`);
    return (await res.json()) as T;
}

const RANGE_TO_LIMIT: Record<NewsTimeRange, number> = {
    '24h': 30, '7d': 100, '30d': 300,
};

interface RawFmpNews {
    symbol: string;
    publishedDate: string;
    title: string;
    text: string | null;
    site: string;
    url: string;
}

export class FmpNewsClient implements NewsProvider {
    async fetchNews(symbol: string, range: NewsTimeRange): Promise<NewsItem[]> {
        const raw = await fmpGet<RawFmpNews[]>('news/stock', {
            symbols: symbol,
            limit: String(RANGE_TO_LIMIT[range]),
        });
        const cutoff = computeCutoff(range);
        return raw
            .filter((n) => new Date(n.publishedDate) >= cutoff)
            .map((n) => ({
                id: hashId(n.url),
                symbol: n.symbol,
                source: n.site,
                url: n.url,
                publishedAt: n.publishedDate,
                titleEn: n.title,
                bodyEn: n.text,
            }));
    }
    async fetchEarningsCalendarAll(): Promise<EarningsCalendarItem[]> {
        const raw = await fmpGet<Array<{
            symbol: string; date: string;
            epsActual: number | null; epsEstimated: number | null;
            revenueActual: number | null; revenueEstimated: number | null;
            lastUpdated: string;
        }>>('earnings-calendar');
        return raw.map((e) => ({
            symbol: e.symbol,
            earningsDate: e.date,
            epsActual: e.epsActual,
            epsEstimated: e.epsEstimated,
            revenueActual: e.revenueActual,
            revenueEstimated: e.revenueEstimated,
            lastUpdated: e.lastUpdated,
        }));
    }
    async fetchEarningsReport(symbol: string): Promise<EarningsReport | null> {
        const arr = await fmpGet<Array<{ symbol: string; date: string; [k: string]: unknown }>>(
            'earnings', { symbol }
        );
        return arr[0] ? { symbol: arr[0].symbol, earningsDate: arr[0].date, raw: arr[0] } : null;
    }
}

function computeCutoff(range: NewsTimeRange): Date {
    const now = Date.now();
    const ms = { '24h': 24, '7d': 7 * 24, '30d': 30 * 24 }[range] * 60 * 60 * 1000;
    return new Date(now - ms);
}

function hashId(url: string): string {
    // Simple but deterministic — URL is unique per FMP article
    return Buffer.from(url).toString('base64url').slice(0, 32);
}
```

- [ ] **Step 2: 단위 테스트 (3 case: fetchNews 시간 필터, calendar 매핑, earnings 단일 결과)**

Run: `yarn test src/__tests__/infrastructure/fmp/newsClient.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/fmp/newsClient.ts src/__tests__/infrastructure/fmp/newsClient.test.ts
git commit -m "feat: FMP News + Earnings client (NewsProvider 구현)"
```

### Task 2.3: Drizzle 스키마 — news, earnings_calendar, earnings_reports

**Files:**
- Create: `src/infrastructure/db/schema/{news,earningsCalendar,earningsReports}.ts`
- Modify: `src/infrastructure/db/schema/index.ts` (재 export)
- Generate: `drizzle/000N_fund_news.sql` (drizzle-kit이 생성)

- [ ] **Step 1: news 스키마**

```typescript
// src/infrastructure/db/schema/news.ts
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const news = pgTable('news', {
    id: text('id').primaryKey(),
    symbol: text('symbol').notNull(),
    source: text('source').notNull(),
    url: text('url').notNull().unique(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    titleEn: text('title_en').notNull(),
    titleKo: text('title_ko'),
    bodyEn: text('body_en'),
    bodyKo: text('body_ko'),
    summaryKo: text('summary_ko'),
    sentiment: text('sentiment'), // 'bullish' | 'neutral' | 'bearish'
    category: text('category'), // NewsCategory
    rawPayload: jsonb('raw_payload'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true }),
});
```

- [ ] **Step 2: earnings_calendar 스키마**

```typescript
// src/infrastructure/db/schema/earningsCalendar.ts
import { date, jsonb, numeric, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const earningsCalendar = pgTable(
    'earnings_calendar',
    {
        symbol: text('symbol').notNull(),
        earningsDate: date('earnings_date').notNull(),
        epsActual: numeric('eps_actual'),
        epsEstimated: numeric('eps_estimated'),
        revenueActual: numeric('revenue_actual'),
        revenueEstimated: numeric('revenue_estimated'),
        lastUpdated: date('last_updated'),
        rawPayload: jsonb('raw_payload'),
        fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.symbol, t.earningsDate] }),
    })
);
```

- [ ] **Step 3: earnings_reports 스키마**

```typescript
// src/infrastructure/db/schema/earningsReports.ts
import { date, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const earningsReports = pgTable(
    'earnings_reports',
    {
        symbol: text('symbol').notNull(),
        earningsDate: date('earnings_date').notNull(),
        rawPayload: jsonb('raw_payload').notNull(),
        fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.symbol, t.earningsDate] }),
    })
);
```

- [ ] **Step 4: schema index 갱신**

`src/infrastructure/db/schema/index.ts`(있는 경우)에서 신규 테이블 re-export.

- [ ] **Step 5: 마이그레이션 생성**

```bash
yarn drizzle-kit generate
```

Expected: `drizzle/000N_*.sql` 파일 생성됨 (3개 테이블 CREATE).

- [ ] **Step 6: 마이그레이션 적용 (개발 DB)**

```bash
yarn drizzle-kit push
```

또는 환경에 따라 `drizzle-kit migrate`. 적용 후 Neon에서 테이블 존재 확인.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/db/schema/{news,earningsCalendar,earningsReports}.ts \
        src/infrastructure/db/schema/index.ts drizzle/
git commit -m "feat: news/earnings_calendar/earnings_reports Drizzle 스키마 + 마이그레이션"
```

### Task 2.4: Repository — newsRepository, earningsCalendarRepository, earningsReportsRepository

**Files:**
- Create: `src/infrastructure/db/repositories/{news,earningsCalendar,earningsReports}Repository.ts`
- Test: 각각 `src/__tests__/infrastructure/db/*Repository.test.ts`

기존 repository 패턴 따름 (Drizzle client 주입 + 메서드).

- [ ] **Step 1: newsRepository — 핵심 메서드**

```typescript
// src/infrastructure/db/repositories/newsRepository.ts
import { and, desc, eq, gte } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-http';
import type { NewsCardAnalysis, NewsItem } from '@y0ngha/siglens-core';
import { news } from '@/infrastructure/db/schema/news';

export class DrizzleNewsRepository {
    constructor(private readonly db: NeonDatabase<Record<string, unknown>>) {}

    /** Insert or update news item (basic identity fields only). */
    async upsertNewsItem(item: NewsItem): Promise<void> {
        await this.db
            .insert(news)
            .values({
                id: item.id,
                symbol: item.symbol,
                source: item.source,
                url: item.url,
                publishedAt: new Date(item.publishedAt),
                titleEn: item.titleEn,
                bodyEn: item.bodyEn,
            })
            .onConflictDoUpdate({
                target: news.id,
                set: { titleEn: item.titleEn, bodyEn: item.bodyEn },
            });
    }

    /** Attach LLM analysis (translation + sentiment) to existing row. */
    async attachAnalysis(id: string, analysis: NewsCardAnalysis): Promise<void> {
        await this.db
            .update(news)
            .set({
                titleKo: analysis.titleKo,
                bodyKo: analysis.bodyKo,
                summaryKo: analysis.summaryKo,
                sentiment: analysis.sentiment,
                category: analysis.category,
                analyzedAt: new Date(),
            })
            .where(eq(news.id, id));
    }

    async listBySymbol(symbol: string, sinceMs: number): Promise<Array<NewsItem & Partial<NewsCardAnalysis>>> {
        const rows = await this.db
            .select()
            .from(news)
            .where(and(eq(news.symbol, symbol), gte(news.publishedAt, new Date(Date.now() - sinceMs))))
            .orderBy(desc(news.publishedAt));
        return rows.map((r) => ({
            id: r.id, symbol: r.symbol, source: r.source, url: r.url,
            publishedAt: r.publishedAt.toISOString(), titleEn: r.titleEn, bodyEn: r.bodyEn,
            titleKo: r.titleKo ?? undefined,
            bodyKo: r.bodyKo ?? undefined,
            summaryKo: r.summaryKo ?? undefined,
            sentiment: (r.sentiment ?? undefined) as never,
            category: (r.category ?? undefined) as never,
        }));
    }
}
```

- [ ] **Step 2: earningsCalendarRepository — upsert 다수, getNextForSymbol, listForRange**

```typescript
// src/infrastructure/db/repositories/earningsCalendarRepository.ts
import { and, asc, eq, gte } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-http';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import { earningsCalendar } from '@/infrastructure/db/schema/earningsCalendar';

export class DrizzleEarningsCalendarRepository {
    constructor(private readonly db: NeonDatabase<Record<string, unknown>>) {}

    async upsertMany(items: EarningsCalendarItem[]): Promise<void> {
        if (items.length === 0) return;
        const rows = items.map((i) => ({
            symbol: i.symbol,
            earningsDate: i.earningsDate,
            epsActual: i.epsActual?.toString() ?? null,
            epsEstimated: i.epsEstimated?.toString() ?? null,
            revenueActual: i.revenueActual?.toString() ?? null,
            revenueEstimated: i.revenueEstimated?.toString() ?? null,
            lastUpdated: i.lastUpdated,
        }));
        await this.db
            .insert(earningsCalendar)
            .values(rows)
            .onConflictDoUpdate({
                target: [earningsCalendar.symbol, earningsCalendar.earningsDate],
                set: {
                    epsActual: rows[0].epsActual, // dummy — 실제 사용은 sql 함수 또는 N건 분리
                },
            });
        // NOTE: bulk upsert에서 컬럼별 EXCLUDED.x 처리는 drizzle-orm sql tag 활용 필요.
        // 구현 단계에서 정확한 sql.raw 또는 sql template 패턴 결정.
    }

    async getNextForSymbol(symbol: string, fromDate: string): Promise<EarningsCalendarItem | null> {
        const rows = await this.db
            .select()
            .from(earningsCalendar)
            .where(and(eq(earningsCalendar.symbol, symbol), gte(earningsCalendar.earningsDate, fromDate)))
            .orderBy(asc(earningsCalendar.earningsDate))
            .limit(1);
        const r = rows[0];
        if (!r) return null;
        return {
            symbol: r.symbol,
            earningsDate: r.earningsDate,
            epsActual: r.epsActual ? Number(r.epsActual) : null,
            epsEstimated: r.epsEstimated ? Number(r.epsEstimated) : null,
            revenueActual: r.revenueActual ? Number(r.revenueActual) : null,
            revenueEstimated: r.revenueEstimated ? Number(r.revenueEstimated) : null,
            lastUpdated: r.lastUpdated ?? '',
        };
    }
}
```

- [ ] **Step 3: earningsReportsRepository — upsert + getLatestForSymbol**

```typescript
// src/infrastructure/db/repositories/earningsReportsRepository.ts
import { desc, eq } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-http';
import type { EarningsReport } from '@y0ngha/siglens-core';
import { earningsReports } from '@/infrastructure/db/schema/earningsReports';

export class DrizzleEarningsReportsRepository {
    constructor(private readonly db: NeonDatabase<Record<string, unknown>>) {}

    async upsert(report: EarningsReport): Promise<void> {
        await this.db
            .insert(earningsReports)
            .values({
                symbol: report.symbol,
                earningsDate: report.earningsDate,
                rawPayload: report.raw as never,
            })
            .onConflictDoUpdate({
                target: [earningsReports.symbol, earningsReports.earningsDate],
                set: { rawPayload: report.raw as never },
            });
    }

    async getLatestForSymbol(symbol: string): Promise<EarningsReport | null> {
        const rows = await this.db
            .select()
            .from(earningsReports)
            .where(eq(earningsReports.symbol, symbol))
            .orderBy(desc(earningsReports.earningsDate))
            .limit(1);
        const r = rows[0];
        return r ? { symbol: r.symbol, earningsDate: r.earningsDate, raw: r.rawPayload } : null;
    }
}
```

- [ ] **Step 4: 단위 테스트 — 각 repository 핵심 case (upsert / get)**

Run: `yarn test src/__tests__/infrastructure/db/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/db/repositories/{news,earningsCalendar,earningsReports}Repository.ts \
        src/__tests__/infrastructure/db/
git commit -m "feat: news/earnings repository 구현"
```

### Task 2.5: Cron — earnings-calendar 1일 1회 sync

**Files:**
- Create: `src/app/api/cron/earnings-calendar-sync/route.ts`
- Modify: `vercel.json`
- Test: `src/__tests__/app/api/cron/earnings-calendar-sync.test.ts`

- [ ] **Step 1: 라우트 구현**

```typescript
// src/app/api/cron/earnings-calendar-sync/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/repositories/earningsCalendarRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
    // Vercel Cron은 Authorization 헤더로 CRON_SECRET 전달
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('unauthorized', { status: 401 });
    }
    const client = new FmpNewsClient();
    const items = await client.fetchEarningsCalendarAll();
    const repo = new DrizzleEarningsCalendarRepository(db);
    await repo.upsertMany(items);
    return NextResponse.json({ inserted: items.length });
}
```

- [ ] **Step 2: vercel.json 갱신**

```json
{
  "crons": [
    { "path": "/api/cron/earnings-calendar-sync", "schedule": "0 6 * * *" }
  ]
}
```

(매일 06:00 UTC = 한국 시간 15:00, 미장 마감 후)

- [ ] **Step 3: 테스트 (mock fetch + mock repo)**

```typescript
// src/__tests__/app/api/cron/earnings-calendar-sync.test.ts
import { GET } from '@/app/api/cron/earnings-calendar-sync/route';

jest.mock('@/infrastructure/fmp/newsClient', () => ({
    FmpNewsClient: class { fetchEarningsCalendarAll = async () => [{ symbol: 'AAPL', earningsDate: '2026-08-01' }]; },
}));
jest.mock('@/infrastructure/db/repositories/earningsCalendarRepository', () => ({
    DrizzleEarningsCalendarRepository: class { upsertMany = jest.fn().mockResolvedValue(undefined); },
}));
jest.mock('@/infrastructure/db/client', () => ({ db: {} }));

beforeEach(() => { process.env.CRON_SECRET = 'sek'; });

test('rejects without bearer', async () => {
    const req = new Request('http://test', { headers: {} });
    const res = await GET(req);
    expect(res.status).toBe(401);
});

test('returns inserted count with valid bearer', async () => {
    const req = new Request('http://test', {
        headers: { authorization: 'Bearer sek' },
    });
    const res = await GET(req);
    const body = await res.json() as { inserted: number };
    expect(body.inserted).toBe(1);
});
```

Run: `yarn test src/__tests__/app/api/cron/earnings-calendar-sync.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/earnings-calendar-sync/route.ts vercel.json src/__tests__/app/api/cron/earnings-calendar-sync.test.ts
git commit -m "feat: earnings-calendar Cron sync (Vercel Cron 06:00 UTC)"
```

### Task 2.6: Server Actions — submit/poll/cancel × 3

**Files:**
- Create: `src/infrastructure/market/{submit,poll,cancel}{Fundamental,News,Overall}AnalysisAction.ts` (총 9개)

각 Server Action은 siglens-core의 동등 use-case를 호출하는 얇은 wrapper.

- [ ] **Step 1: Fundamental Action 3종**

```typescript
// src/infrastructure/market/submitFundamentalAnalysisAction.ts
'use server';
import {
    submitFundamentalAnalysis,
    type SubmitFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';

export async function submitFundamentalAnalysisAction(
    symbol: string,
    modelId: string
): Promise<SubmitFundamentalAnalysisResult> {
    return submitFundamentalAnalysis({
        symbol,
        modelId,
        dataProvider: new FmpFundamentalClient(),
    });
}
```

```typescript
// src/infrastructure/market/pollFundamentalAnalysisAction.ts
'use server';
import { pollFundamentalAnalysis } from '@y0ngha/siglens-core';
export async function pollFundamentalAnalysisAction(jobId: string) {
    return pollFundamentalAnalysis(jobId);
}
```

```typescript
// src/infrastructure/market/cancelFundamentalAnalysisJobAction.ts
'use server';
import { cancelFundamentalAnalysisJob } from '@y0ngha/siglens-core';
export async function cancelFundamentalAnalysisJobAction(jobId: string) {
    return cancelFundamentalAnalysisJob(jobId);
}
```

- [ ] **Step 2: News Action 3종 — Same pattern, swap names + provide news/calendar inputs**

```typescript
// src/infrastructure/market/submitNewsAnalysisAction.ts
'use server';
import { submitNewsAnalysis, type SubmitNewsAnalysisResult } from '@y0ngha/siglens-core';
import { db } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/repositories/newsRepository';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/repositories/earningsCalendarRepository';

export async function submitNewsAnalysisAction(
    symbol: string,
    modelId: string
): Promise<SubmitNewsAnalysisResult> {
    const newsRepo = new DrizzleNewsRepository(db);
    const calendarRepo = new DrizzleEarningsCalendarRepository(db);
    const news = await newsRepo.listBySymbol(symbol, 7 * 24 * 60 * 60 * 1000);
    const next = await calendarRepo.getNextForSymbol(symbol, new Date().toISOString().slice(0, 10));
    return submitNewsAnalysis({
        symbol,
        modelId,
        news: news.filter((n) => n.titleKo) as never, // 카드 분석 완료된 것만
        upcomingCalendar: next ? [next] : [],
    });
}
```

```typescript
// src/infrastructure/market/{poll,cancel}NewsAnalysisAction.ts — Same as Fundamental
```

- [ ] **Step 3: Overall Action 3종**

```typescript
// src/infrastructure/market/submitOverallAnalysisAction.ts
'use server';
import { submitOverallAnalysis } from '@y0ngha/siglens-core';
import type { Timeframe } from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { db } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/repositories/newsRepository';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/repositories/earningsCalendarRepository';

export async function submitOverallAnalysisAction(
    symbol: string,
    timeframe: Timeframe,
    modelId: string
) {
    const newsRepo = new DrizzleNewsRepository(db);
    const calendarRepo = new DrizzleEarningsCalendarRepository(db);
    const news = await newsRepo.listBySymbol(symbol, 7 * 24 * 60 * 60 * 1000);
    const next = await calendarRepo.getNextForSymbol(symbol, new Date().toISOString().slice(0, 10));
    return submitOverallAnalysis({
        symbol,
        timeframe,
        modelId,
        fundamentalProvider: new FmpFundamentalClient(),
        news: news.filter((n) => n.titleKo) as never,
        upcomingCalendar: next ? [next] : [],
    });
}
```

- [ ] **Step 4: 9개 파일 commit**

```bash
git add src/infrastructure/market/{submit,poll,cancel}{Fundamental,News,Overall}AnalysisAction.ts
git commit -m "feat: 새 분석 9개 Server Action (submit/poll/cancel × Fundamental/News/Overall)"
```

### Task 2.7: AI provider 호출 wire-up (구 "Gemini adapter 모델 파라미터화")

**Files:**
- Reuse: `src/infrastructure/ai/router.ts` (PR #409로 master에 이미 존재)
- Reuse: `src/infrastructure/ai/{anthropic,openai,gemini,utils}.ts`
- (필요 시) 새 분석 종류용 helper 추가

> **[2026-05-02 master sync 갱신]** 원래 spec/plan 작성 당시 단일 `gemini.ts` 어댑터 가정이었으나, **PR #408/409 머지로 master에 이미 멀티 provider router(`infrastructure/ai/router.ts`)와 모델 분기 로직이 일반화**되어 있다. 새 분석 use-case는 이 router를 그대로 호출하면 됨. flash-lite 분기도 router의 모델 ID 인자로 처리 가능.
>
> 따라서 이 task는 **신규 어댑터 작성이 아니라 wire-up 검증**으로 단순화:
> - News 카드별 분석(`submitNewsCardAnalysis`)이 호출하는 worker dispatch에서 `model: 'gemini-2.5-flash-lite'` 전달이 router/worker 양쪽에서 정상 처리되는지 확인.
> - 사용자 노출 모델 옵션은 master의 `useSelectedProvider` 훅 + `ModelSelector` 컴포넌트가 이미 결정.

- [ ] **Step 1: 시그니처 변경**

기존 함수가 예: `callGemini(prompt: string)` 였다면:

```typescript
export async function callGemini(
    prompt: string,
    modelId: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-2.5-pro' = 'gemini-2.5-flash'
): Promise<string> {
    // ... GenAI SDK 호출 시 modelId 전달
}
```

- [ ] **Step 2: callGeminiFlashLite — 별칭 helper (코드 가독성)**

```typescript
export const callGeminiFlashLite = (prompt: string) =>
    callGemini(prompt, 'gemini-2.5-flash-lite');
```

- [ ] **Step 3: 기존 호출자 변경 (인자 추가) + 새 사용처는 모델 파라미터로 호출**

- [ ] **Step 4: Test + Commit**

Run: `yarn test src/__tests__/infrastructure/ai/`
Expected: PASS

```bash
git add src/infrastructure/ai/gemini.ts src/__tests__/infrastructure/ai/
git commit -m "feat: Gemini adapter 모델 파라미터화 (flash-lite 분기 지원)"
```

### Task 2.8: 사용자 전역 모델 선호 저장 — 기존 훅 재사용

**Files:**
- Reuse: `src/components/symbol-page/hooks/useSelectedProvider.ts` (PR #409로 master에 이미 존재)
- Reuse: `src/lib/storageKeys.ts` (PR #409로 master에 이미 존재)
- Reuse: `src/components/analysis/ModelSelector.tsx` (PR #409로 master에 이미 존재)
- (필요 시) 새 분석 4종 페이지에서 동일 훅을 import해 사용

> **[2026-05-02 master sync 갱신]** 원래 plan은 `src/lib/preferredModel.ts` + `usePreferredModel` 훅을 신규 작성하는 시나리오였으나, **PR #409 머지로 master에 이미 동등한 시스템이 존재**한다:
> - `useSelectedProvider` 훅 = plan의 `usePreferredModel` 역할 (provider + model 선택 + localStorage 동기화)
> - `storageKeys.ts` = localStorage 키 모음
> - `ModelSelector` 컴포넌트 = 사용자 노출 UI
> - `UserApiKeyRequiredModal` = BYOK 안내 모달
>
> 따라서 이 task는 **신규 작성이 아니라 재사용**으로 변경:
> - 새 분석 4종 페이지(Fundamental, News, Overall, A 보강)에 `<ModelSelector />` 또는 `useSelectedProvider`를 import해 wire-up
> - 페이지마다 다른 별도 훅 만들지 않음 — 사용자 전역 선호는 이미 한 곳에서 관리됨
> - localStorage 키도 신규 추가 없음 — 기존 `storageKeys.ts`가 source-of-truth
>
> Step:
> - [ ] **Step 1**: `useSelectedProvider` 훅의 시그니처와 반환값 확인 (`yarn tsc --noEmit` + 코드 read)
> - [ ] **Step 2**: 4개 페이지의 AI 분석 트리거 컴포넌트(`FundamentalAiSummary`, `NewsAiSummary`, `OverallContent`, `NewsAugment`)에서 import + 사용
> - [ ] **Step 3**: Server Action 호출 시 `useSelectedProvider`가 반환하는 `modelId`를 인자로 전달
> - [ ] **Step 4**: BYOK 사용자가 자신의 키 모델을 선택하면 기존 `UserApiKeyRequiredModal` 흐름 그대로 작동하는지 검증

- [ ] **Step 1: lib/preferredModel.ts**

```typescript
// src/lib/preferredModel.ts
import type { ModelId } from '@y0ngha/siglens-core';

const STORAGE_KEY = 'siglens.preferredModel';

export function readPreferredModel(): ModelId | null {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem(STORAGE_KEY) as ModelId | null) ?? null;
}

export function writePreferredModel(modelId: ModelId): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, modelId);
}
```

회원이면 user 설정 DB와 sync — `usePreferredModel` 훅에서 처리:

```typescript
// src/components/chat/hooks/usePreferredModel.ts
'use client';
import { useEffect, useState } from 'react';
import type { ModelId } from '@y0ngha/siglens-core';
import { readPreferredModel, writePreferredModel } from '@/lib/preferredModel';

const DEFAULT_MODEL: ModelId = 'gemini-2.5-flash';

export function usePreferredModel(): {
    modelId: ModelId;
    setModelId: (m: ModelId) => void;
} {
    const [modelId, setModelIdState] = useState<ModelId>(DEFAULT_MODEL);
    useEffect(() => {
        const saved = readPreferredModel();
        if (saved) setModelIdState(saved);
    }, []);
    const setModelId = (m: ModelId) => {
        setModelIdState(m);
        writePreferredModel(m);
        // TODO (회원 sync): Server Action으로 user 설정 DB 갱신 — Phase 4 (사용자 시스템 연동) 시 추가
    };
    return { modelId, setModelId };
}
```

- [ ] **Step 2: 테스트 + Commit**

```bash
git add src/lib/preferredModel.ts src/components/chat/hooks/usePreferredModel.ts src/__tests__/lib/preferredModel.test.ts
git commit -m "feat: 사용자 전역 모델 선호 저장 (localStorage 베이스)"
```

### Task 2.9–2.11: 페이지 라우트 3종 (RSC + Suspense)

**Files (각 페이지마다)**:
- `src/app/[symbol]/{fundamental,news,overall}/page.tsx`
- `src/app/[symbol]/{fundamental,news,overall}/loading.tsx`
- `src/components/{fundamental,news,overall}/*.tsx`

#### Task 2.9: Fundamental 페이지

- [ ] **Step 1: page.tsx (RSC, 섹션별 Suspense)**

```typescript
// src/app/[symbol]/fundamental/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ProfileCard } from '@/components/fundamental/sections/ProfileCard';
import { ValuationCard } from '@/components/fundamental/sections/ValuationCard';
import { PeersTable } from '@/components/fundamental/sections/PeersTable';
import { ProfitabilityCard } from '@/components/fundamental/sections/ProfitabilityCard';
import { GrowthChart } from '@/components/fundamental/sections/GrowthChart';
import { FinancialHealthCard } from '@/components/fundamental/sections/FinancialHealthCard';
import { FutureDirectionCard } from '@/components/fundamental/sections/FutureDirectionCard';
import { SectorDirectionCard } from '@/components/fundamental/sections/SectorDirectionCard';
import { FundamentalAiSummary } from '@/components/fundamental/FundamentalAiSummary';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';

interface Props { params: Promise<{ symbol: string }>; }

export async function generateMetadata({ params }: Props) {
    const { symbol } = await params;
    return {
        title: `${symbol} 펀더멘털 분석 — siglens`,
        description: `${symbol}의 재무, 밸류에이션, 성장성, 미래 방향 AI 분석.`,
        alternates: { canonical: `/${symbol}/fundamental` },
    };
}

export default async function FundamentalPage({ params }: Props) {
    const { symbol } = await params;
    if (!/^[A-Za-z.]{1,8}$/.test(symbol)) notFound();
    return (
        <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
            <Suspense fallback={<SectionSkeleton />}><ProfileCard symbol={symbol} /></Suspense>
            <Suspense fallback={<SectionSkeleton />}><ValuationCard symbol={symbol} /></Suspense>
            <Suspense fallback={<SectionSkeleton />}><PeersTable symbol={symbol} /></Suspense>
            <Suspense fallback={<SectionSkeleton />}><ProfitabilityCard symbol={symbol} /></Suspense>
            <Suspense fallback={<SectionSkeleton />}><GrowthChart symbol={symbol} /></Suspense>
            <Suspense fallback={<SectionSkeleton />}><FinancialHealthCard symbol={symbol} /></Suspense>
            <Suspense fallback={<SectionSkeleton />}><FutureDirectionCard symbol={symbol} /></Suspense>
            <Suspense fallback={<SectionSkeleton />}><SectorDirectionCard symbol={symbol} /></Suspense>
            <Suspense fallback={<SectionSkeleton />}><FundamentalAiSummary symbol={symbol} /></Suspense>
            <CrossLinkCards symbol={symbol} current="fundamental" />
        </main>
    );
}

function SectionSkeleton() {
    return <div className="h-32 rounded-xl bg-muted animate-pulse" />;
}
```

- [ ] **Step 2: 섹션 컴포넌트 9개 (각각 RSC, `unstable_cache`로 fetch 메모이즈)**

각 섹션은 비슷한 패턴:

```typescript
// src/components/fundamental/sections/ProfileCard.tsx (RSC)
import { unstable_cache } from 'next/cache';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';

const getProfile = unstable_cache(
    async (symbol: string) => new FmpFundamentalClient().getProfile(symbol),
    ['fundamental:profile'],
    { revalidate: 30 * 24 * 60 * 60, tags: [`profile:${'__SYMBOL__'}`] } // T4: 30일
);

export async function ProfileCard({ symbol }: { symbol: string }) {
    const profile = await getProfile(symbol);
    if (!profile) return null;
    return (
        <section className="rounded-xl border p-6">
            <h2 className="text-lg font-semibold">{profile.companyName} ({profile.symbol})</h2>
            <p className="text-sm text-muted-foreground">{profile.sector} / {profile.industry}</p>
            <p className="mt-2">{profile.description}</p>
        </section>
    );
}
```

다른 섹션 동일 패턴, fetch만 다름:
- `ValuationCard`: `getKeyMetricsTtm` + `getRatiosTtm` (T3 동적 TTL — 호출자 측 wrapper)
- `PeersTable`: `getStockPeers` (T4 30일)
- `ProfitabilityCard`: `getRatiosTtm` (T3)
- `GrowthChart`: `getIncomeStatementGrowth` (T3)
- `FinancialHealthCard`: `getRatiosTtm` + `getCashFlowStatement` + `getFinancialScores` (T3)
- `FutureDirectionCard`: `getAnalystEstimates` + `getGradesConsensus` + `getPriceTargetConsensus` + `getPriceTargetSummary` + DB의 next earnings (T2 24h)
- `SectorDirectionCard`: `getSectorPerformanceSnapshot` + `getHistoricalSectorPerformance` (T2 1h for today, T2 24h for historical)

- [ ] **Step 3: FundamentalAiSummary — Client 컴포넌트 (server action 호출 + polling)**

```typescript
// src/components/fundamental/FundamentalAiSummary.tsx
'use client';
import { useEffect, useState } from 'react';
import { submitFundamentalAnalysisAction } from '@/infrastructure/market/submitFundamentalAnalysisAction';
import { pollFundamentalAnalysisAction } from '@/infrastructure/market/pollFundamentalAnalysisAction';
import { usePreferredModel } from '@/components/chat/hooks/usePreferredModel';

export function FundamentalAiSummary({ symbol }: { symbol: string }) {
    const { modelId } = usePreferredModel();
    const [state, setState] = useState<{ status: string; result?: unknown; error?: string }>({ status: 'idle' });

    useEffect(() => {
        let alive = true;
        let pollHandle: ReturnType<typeof setTimeout> | null = null;
        async function run() {
            const r = await submitFundamentalAnalysisAction(symbol, modelId);
            if (!alive) return;
            if (r.status === 'cached') {
                setState({ status: 'done', result: r.result });
                return;
            }
            if (r.status === 'error') {
                setState({ status: 'error', error: r.message });
                return;
            }
            const jobId = r.jobId;
            const poll = async () => {
                const p = await pollFundamentalAnalysisAction(jobId);
                if (!alive) return;
                if (p.status === 'processing') {
                    pollHandle = setTimeout(poll, 2000);
                } else if (p.status === 'done') {
                    setState({ status: 'done', result: p.result });
                } else {
                    setState({ status: 'error', error: p.error });
                }
            };
            poll();
        }
        run();
        return () => { alive = false; if (pollHandle) clearTimeout(pollHandle); };
    }, [symbol, modelId]);

    // render based on state.status — 분량 절약 위해 생략
    return <div>...</div>;
}
```

- [ ] **Step 4: loading.tsx**

```typescript
// src/app/[symbol]/fundamental/loading.tsx
export default function Loading() {
    return <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
    </div>;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\[symbol\]/fundamental/ src/components/fundamental/
git commit -m "feat: /[symbol]/fundamental 페이지 + 9개 섹션 컴포넌트 (RSC + Suspense)"
```

#### Task 2.10: News 페이지 — Same RSC + Suspense pattern, swap data sources

- [ ] **Step 1: page.tsx, NewsContent, NewsList, NewsAiSummary, EventCalendar, AnalystActions**

비슷한 패턴 — 각 섹션이 RSC + Suspense, AI summary는 Client (server action + polling).

차이점:
- 진입 시 News fetch 트리거 (DB read + 누락된 카드별 LLM 호출 enqueue)
- 종합 AI 분석 자동 트리거 (캐시 hit 즉시 표시)

```typescript
// src/app/[symbol]/news/page.tsx
// Same Suspense scaffolding pattern as Task 2.9
```

(상세 코드는 구현 시 해당 컴포넌트 작성 — 패턴은 Task 2.9 그대로)

- [ ] **Step 2: 카드별 LLM 호출 트리거 use-case**

```typescript
// src/infrastructure/market/ensureNewsCardsAnalyzedAction.ts
'use server';
import { submitNewsCardAnalysis, pollNewsCardAnalysis } from '@y0ngha/siglens-core';
import { db } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/repositories/newsRepository';
import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';

export async function ensureNewsCardsAnalyzedAction(symbol: string) {
    const newsClient = new FmpNewsClient();
    const fresh = await newsClient.fetchNews(symbol, '7d');
    const repo = new DrizzleNewsRepository(db);
    for (const item of fresh) {
        await repo.upsertNewsItem(item);
        const r = await submitNewsCardAnalysis(item);
        if (r.status === 'cached') {
            await repo.attachAnalysis(item.id, r.result);
        }
        // submitted 케이스는 워커가 처리. 다음 요청 시 cached로 전환됨.
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\[symbol\]/news/ src/components/news/ src/infrastructure/market/ensureNewsCardsAnalyzedAction.ts
git commit -m "feat: /[symbol]/news 페이지 + sentiment 뱃지 + 종합 AI 분석"
```

#### Task 2.11: Overall 페이지 — 명시 트리거 + 의존성 진행 UI

- [ ] **Step 1: page.tsx + OverallTriggerCta + DependencyProgress + OverallContent**

```typescript
// src/app/[symbol]/overall/page.tsx
import { OverallContent } from '@/components/overall/OverallContent';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params;
    return {
        title: `${symbol} AI 종합 분석 — siglens`,
        description: `${symbol}의 기술 + 펀더 + 뉴스를 통합한 AI 종합 분석.`,
        alternates: { canonical: `/${symbol}/overall` },
    };
}

interface SearchParams { tf?: string; }

export default async function OverallPage({
    params,
    searchParams,
}: {
    params: Promise<{ symbol: string }>;
    searchParams: Promise<SearchParams>;
}) {
    const { symbol } = await params;
    const { tf } = await searchParams;
    return <OverallContent symbol={symbol} timeframe={tf ?? '1d'} />;
}
```

- [ ] **Step 2: OverallContent — Client 컴포넌트, 명시 트리거 + 단계별 polling**

```typescript
// src/components/overall/OverallContent.tsx
'use client';
import { useState } from 'react';
import { submitOverallAnalysisAction } from '@/infrastructure/market/submitOverallAnalysisAction';
import { pollOverallAnalysisAction } from '@/infrastructure/market/pollOverallAnalysisAction';
import { OverallTriggerCta } from './OverallTriggerCta';
import { DependencyProgress } from './DependencyProgress';
import { usePreferredModel } from '@/components/chat/hooks/usePreferredModel';
import type { Timeframe } from '@y0ngha/siglens-core';

export function OverallContent({ symbol, timeframe }: { symbol: string; timeframe: string }) {
    const { modelId } = usePreferredModel();
    const [state, setState] = useState<{ kind: 'idle' | 'pending' | 'running' | 'done' | 'error'; data?: unknown; pendingJobs?: Record<string, string | undefined>; error?: string }>({ kind: 'idle' });

    async function trigger() {
        setState({ kind: 'pending' });
        const r = await submitOverallAnalysisAction(symbol, timeframe as Timeframe, modelId);
        if (r.status === 'cached') {
            setState({ kind: 'done', data: r.result });
            return;
        }
        if (r.status === 'pending_dependencies') {
            setState({ kind: 'pending', pendingJobs: r.pendingJobs });
            // 의존성 polling — submitOverallAnalysis 재호출로 다음 단계 진입
            setTimeout(trigger, 3000);
            return;
        }
        // submitted
        const jobId = r.jobId;
        setState({ kind: 'running' });
        const poll = async () => {
            const p = await pollOverallAnalysisAction(jobId);
            if (p.status === 'processing') {
                setTimeout(poll, 3000);
            } else if (p.status === 'done') {
                setState({ kind: 'done', data: p.result });
            } else {
                setState({ kind: 'error', error: p.error });
            }
        };
        poll();
    }

    if (state.kind === 'idle') return <OverallTriggerCta onTrigger={trigger} />;
    if (state.kind === 'pending') return <DependencyProgress pendingJobs={state.pendingJobs ?? {}} />;
    if (state.kind === 'running') return <div>종합 분석 생성 중…</div>;
    if (state.kind === 'error') return <div>에러: {state.error}</div>;
    return <div>{/* render data */}</div>;
}
```

- [ ] **Step 3: 7개 섹션 컴포넌트 (OverallSummary, TechnicalSummary, …, RiskFactors)**

각 컴포넌트는 props로 데이터 받아 표시. 분량 절약 — 패턴 동일.

- [ ] **Step 4: Commit**

```bash
git add src/app/\[symbol\]/overall/ src/components/overall/
git commit -m "feat: /[symbol]/overall 페이지 + 명시 트리거 + 의존성 진행 UI"
```

### Task 2.12: 헤더 세그먼트 탭 (4개)

**Files:**
- Create: `src/components/symbol-page/SymbolTabs.tsx`
- Modify: `src/components/symbol-page/SymbolPageHeader.tsx` (탭 임베드)

- [ ] **Step 1: SymbolTabs**

```typescript
// src/components/symbol-page/SymbolTabs.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
    { key: 'chart', label: '차트', href: (s: string) => `/${s}` },
    { key: 'news', label: '뉴스', href: (s: string) => `/${s}/news` },
    { key: 'fundamental', label: '펀더', href: (s: string) => `/${s}/fundamental` },
    { key: 'overall', label: '종합', href: (s: string) => `/${s}/overall` },
] as const;

export function SymbolTabs({ symbol }: { symbol: string }) {
    const pathname = usePathname();
    return (
        <nav role="tablist" aria-label="분석 종류" className="flex border-b">
            {TABS.map((t) => {
                const href = t.href(symbol);
                const active = pathname === href;
                return (
                    <Link
                        key={t.key}
                        href={href}
                        role="tab"
                        aria-selected={active}
                        className={`px-4 py-2 ${active ? 'border-b-2 border-primary' : 'text-muted-foreground'}`}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
```

- [ ] **Step 2: SymbolPageHeader 안에 SymbolTabs 임베드**

기존 헤더 컴포넌트 끝에 `<SymbolTabs symbol={symbol} />` 추가.

- [ ] **Step 3: Commit**

```bash
git add src/components/symbol-page/SymbolTabs.tsx src/components/symbol-page/SymbolPageHeader.tsx
git commit -m "feat: 종목 페이지 헤더 세그먼트 탭 (차트/뉴스/펀더/종합)"
```

### Task 2.13: Cross-link 카드 컴포넌트

**Files:**
- Create: `src/components/symbol-page/CrossLinkCards.tsx`

- [ ] **Step 1: 컴포넌트**

```typescript
// src/components/symbol-page/CrossLinkCards.tsx
import Link from 'next/link';

const ALL = ['chart', 'news', 'fundamental', 'overall'] as const;
type Page = typeof ALL[number];

const LABEL: Record<Page, string> = {
    chart: '차트 분석', news: '뉴스 분석', fundamental: '펀더 분석', overall: 'AI 종합 분석',
};

const HREF: Record<Page, (s: string) => string> = {
    chart: (s) => `/${s}`,
    news: (s) => `/${s}/news`,
    fundamental: (s) => `/${s}/fundamental`,
    overall: (s) => `/${s}/overall`,
};

export function CrossLinkCards({
    symbol, current,
}: { symbol: string; current: Page }) {
    const others = ALL.filter((p) => p !== current);
    return (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
            {others.map((p) => (
                <Link
                    key={p}
                    href={HREF[p](symbol)}
                    className="rounded-xl border p-6 hover:border-primary"
                >
                    <h3 className="font-semibold">→ {LABEL[p]}</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        {symbol}의 {LABEL[p]}을(를) 보러가기
                    </p>
                </Link>
            ))}
        </section>
    );
}
```

- [ ] **Step 2: 4개 페이지 컴포넌트 끝에 추가 (Task 2.9~2.11에서 이미 import 했으면 OK)**

- [ ] **Step 3: Commit**

```bash
git add src/components/symbol-page/CrossLinkCards.tsx
git commit -m "feat: 페이지 끝 cross-link 카드 컴포넌트"
```

### Task 2.14: 차트 페이지 뉴스 보강 섹션 (A2 + A3)

**Files:**
- Create: `src/components/symbol-page/NewsAugment.tsx`
- Modify: `src/components/symbol-page/ChartContent.tsx`

- [ ] **Step 1: NewsAugment 컴포넌트**

```typescript
// src/components/symbol-page/NewsAugment.tsx
'use client';
import { useEffect, useState } from 'react';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
import { usePreferredModel } from '@/components/chat/hooks/usePreferredModel';
import Link from 'next/link';

export function NewsAugment({ symbol }: { symbol: string }) {
    const { modelId } = usePreferredModel();
    const [data, setData] = useState<{ currentDriverKo: string } | null>(null);
    useEffect(() => {
        let alive = true;
        async function run() {
            const r = await submitNewsAnalysisAction(symbol, modelId);
            if (!alive) return;
            if (r.status === 'cached') { setData(r.result); return; }
            if (r.status === 'submitted') {
                const poll = async () => {
                    const p = await pollNewsAnalysisAction(r.jobId);
                    if (!alive) return;
                    if (p.status === 'done') setData(p.result);
                    else if (p.status === 'processing') setTimeout(poll, 3000);
                };
                poll();
            }
        }
        run();
        return () => { alive = false; };
    }, [symbol, modelId]);

    if (!data) return null;
    return (
        <aside className="rounded-xl border p-4 mt-4">
            <h3 className="text-sm font-semibold mb-2">뉴스 자료 종합</h3>
            <p className="text-sm text-muted-foreground">{data.currentDriverKo}</p>
            <Link href={`/${symbol}/news`} className="text-sm mt-2 inline-block underline">
                → 더 자세한 뉴스 분석 보기
            </Link>
        </aside>
    );
}
```

- [ ] **Step 2: ChartContent에 임베드**

기존 `ChartContent.tsx`의 적절한 위치(예: 차트 아래 또는 사이드)에 `<NewsAugment symbol={symbol} />` 추가.

- [ ] **Step 3: Commit**

```bash
git add src/components/symbol-page/NewsAugment.tsx src/components/symbol-page/ChartContent.tsx
git commit -m "feat: 차트 페이지에 뉴스 자료 종합 보강 섹션 추가"
```

### Task 2.15: 챗봇 컨텍스트 전환 (`usePathname` 감지)

**Files:**
- Create: `src/components/chat/ContextSwitchSystemMessage.tsx`
- Modify: `src/components/chat/hooks/useChat.ts`
- Modify: `src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: ContextSwitchSystemMessage 컴포넌트**

```typescript
// src/components/chat/ContextSwitchSystemMessage.tsx
export function ContextSwitchSystemMessage({ context }: { context: string }) {
    return (
        <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-2 my-2">
            📊 {context} 페이지로 전환되었습니다. 이전 페이지의 분석 컨텍스트는 더 이상 적용되지 않습니다.
        </div>
    );
}
```

- [ ] **Step 2: useChat hook 갱신 — `usePathname` 구독**

```typescript
// src/components/chat/hooks/useChat.ts (수정)
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export function useChat(/* 기존 props */) {
    // 기존 코드 ...
    const pathname = usePathname();
    const lastPathnameRef = useRef(pathname);

    useEffect(() => {
        if (lastPathnameRef.current !== pathname) {
            const ctx = describeContextFromPath(pathname);
            // 기존 messages state에 system 메시지 enqueue
            appendSystemMessage(`__CONTEXT_SWITCH__:${ctx}`);
            lastPathnameRef.current = pathname;
        }
    }, [pathname]);

    // ...
}

function describeContextFromPath(p: string): string {
    if (/\/[A-Z.]+\/fundamental$/.test(p)) return '펀더 분석';
    if (/\/[A-Z.]+\/news$/.test(p)) return '뉴스 분석';
    if (/\/[A-Z.]+\/overall$/.test(p)) return 'AI 종합 분석';
    return '차트 분석';
}
```

- [ ] **Step 3: ChatPanel 갱신 — `__CONTEXT_SWITCH__:` 메시지를 `<ContextSwitchSystemMessage />`로 렌더**

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/
git commit -m "feat: 챗봇 페이지 전환 시 컨텍스트 시스템 메시지 추가"
```

### Task 2.16: SEO — 페이지별 메타 + breadcrumb + sitemap

**Files:**
- Modify: `src/lib/seo.ts`
- Modify: `src/app/sitemap.ts`
- Modify: 4개 페이지의 `generateMetadata`

- [ ] **Step 1: seo.ts — 페이지별 description / keywords 빌더 추가**

```typescript
// src/lib/seo.ts에 추가
export function buildSymbolFundamentalSeoContent(symbol: string) {
    const upper = symbol.toUpperCase();
    return {
        title: `${upper} 펀더멘털 분석 — siglens`,
        fullTitle: `${upper} 재무·밸류에이션·미래 방향 분석 | siglens`,
        description: `${upper}의 PER·PSR·EPS·ROE·재무 건전성·애널리스트 컨센서스·섹터 방향 등 펀더멘털 종합 AI 분석.`,
        url: `/${upper}/fundamental`,
        keywords: [`${upper}`, '펀더멘털 분석', 'PER', 'PSR', 'EPS', '애널리스트 컨센서스'],
    };
}

export function buildSymbolNewsSeoContent(symbol: string) {
    // ... similar
}

export function buildSymbolOverallSeoContent(symbol: string) {
    // ... similar
}
```

- [ ] **Step 2: 4개 페이지의 `generateMetadata`에서 위 빌더 사용**

- [ ] **Step 3: sitemap에 4개 path 추가**

```typescript
// src/app/sitemap.ts (기존 sitemap에 추가)
// 종목별 4개 path 생성 — 기존 종목 리스트가 있으면 .flatMap
const symbolPaths = symbols.flatMap((s) => [
    `/${s}`,
    `/${s}/fundamental`,
    `/${s}/news`,
    `/${s}/overall`,
]);
```

- [ ] **Step 4: breadcrumb JSON-LD 4개 페이지 모두 — 기존 `buildBreadcrumbJsonLd` 재사용**

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo.ts src/app/sitemap.ts src/app/\[symbol\]/
git commit -m "feat: 4개 페이지 SEO 메타 + sitemap + breadcrumb JSON-LD"
```

### Task 2.17: Skills `.md` 카탈로그

**Files:**
- Create: `skills/fundamental/{value-investing,growth-investing,quality-investing}.md`
- Create: `skills/news/{event-driven,macro-impact,earnings-reaction}.md`

각 파일은 frontmatter + body. 예:

- [ ] **Step 1: skills/fundamental/value-investing.md**

```markdown
---
name: Value Investing
category: fundamental
confidence_weight: 0.9
indicators: []
---

가치투자 관점에서 회사를 평가합니다.

- PER이 산업 평균보다 낮으면 가치 매력도 ↑
- PBR < 1.0이면 청산가치 이하
- ROE > 15%이고 부채비율이 낮으면 우량 가치주
- FCF가 안정적으로 양수이고 배당 여력이 있으면 가치투자 적합
```

- [ ] **Step 2: 나머지 5개 .md 파일 동일 패턴으로 작성**

- [ ] **Step 3: Skills loader가 잘 읽는지 빠른 검증**

```bash
node -e "
import('@y0ngha/siglens-core').then(async ({ FileSkillsLoader }) => {
    const loader = new FileSkillsLoader();
    const skills = await loader.loadSkills();
    console.log('fundamental:', skills.filter(s => s.category === 'fundamental').length);
    console.log('news:', skills.filter(s => s.category === 'news').length);
});
"
```

Expected: `fundamental: 3` / `news: 3`

- [ ] **Step 4: Commit**

```bash
git add skills/fundamental/ skills/news/
git commit -m "feat: Skills 카탈로그 fundamental/news 6종 추가"
```

### Task 2.18: 통합 검증 — lint + test + build + dev server smoke

- [ ] **Step 1: lint**

Run: `yarn lint && yarn lint:style`
Expected: clean

- [ ] **Step 2: test**

Run: `yarn test`
Expected: 모든 테스트 PASS

- [ ] **Step 3: build**

Run: `yarn build`
Expected: 4개 페이지 모두 build 성공, `.next/` 산출물 정상

- [ ] **Step 4: dev server 띄워 manual smoke**

```bash
yarn dev
```

브라우저에서 다음 URL 모두 200 + 시각적 정상 확인:
- `http://localhost:4200/AAPL`
- `http://localhost:4200/AAPL/news`
- `http://localhost:4200/AAPL/fundamental`
- `http://localhost:4200/AAPL/overall`
- 헤더 탭 4개 클릭 동선
- 챗봇 패널 열고 페이지 이동 시 시스템 메시지 표시 확인
- News 페이지 sentiment 뱃지 + KO 요약 표시 확인
- Overall 페이지 트리거 후 단계별 진행 UI 확인

### Task 2.19: PR 생성 + cross-repo 연결

- [ ] **Step 1: review-agent 호출**

```
Review the code on branch feat/fundamental-news-analysis (siglens worktree).
This is round 1.
modified_files: [전체 변경 파일 목록]
Focus on layer dependency rules, type-safety, error handling, accessibility on tabs.
```

- [ ] **Step 2: 발견사항 fix → review-agent 재호출 (loop limit 3 round)**

- [ ] **Step 3: mistake-managing-agent 호출**

- [ ] **Step 4: git-agent 호출 — PR 생성**

```
Create a PR for siglens worktree.
- base: master
- title: feat: 펀더/뉴스/AI 종합 분석 페이지 추가
- body: spec 링크 + 핵심 결정 요약 + cross-repo 의존성 (siglens-core 0.8.0-beta.1) 명시
```

- [ ] **Step 5: siglens-core PR 본문에 siglens PR 링크 역방향 연결**

---

## Phase 3: 검증 + Cross-repo Coordination

### Task 3.1: 두 PR 머지 순서

1. siglens-core PR 머지 → npm publish (`@y0ngha/siglens-core@0.8.0`)
2. siglens PR — `package.json` 의존성을 `0.8.0`(stable)로 변경 → 마지막 커밋 추가 → 머지

### Task 3.2: 프로덕션 배포 후 smoke

- [ ] Vercel 배포 후 4개 페이지 manual 확인
- [ ] Cron 트리거 manual 한 번 실행 (다음 06:00 UTC 기다리지 않기 위해)
- [ ] 뉴스 카드 LLM 호출 1건 동작 확인 (DB row의 `analyzed_at` 채워지는지)
- [ ] Overall 분석 한 번 트리거 + 30분 안에 완료 확인

### Task 3.3: 워크트리 정리

머지 + 배포 검증 완료 후:

```bash
cd /Users/y0ngha/Project/siglens
git worktree remove /Users/y0ngha/Project/siglens-fund-news-analysis
git branch -d feat/fundamental-news-analysis

cd /Users/y0ngha/Project/siglens-core
git worktree remove /Users/y0ngha/Project/siglens-core-fund-news
git branch -d feat/fundamental-news-analysis
```

---

## Self-Review Notes

이 plan이 spec을 모두 커버하는지 점검:

- ✓ 4페이지 (chart 보강 + fundamental + news + overall) — Task 2.9~2.14
- ✓ 진입 동선 (탭 + cross-link) — Task 2.12, 2.13
- ✓ FMP 16 endpoints — Task 2.1
- ✓ News + earnings — Task 2.2
- ✓ 캐싱 4단계 + 동적 TTL — Task 1.3 (상수), Task 2.9 (각 unstable_cache wrapper에서 적용 — 정확한 동적 TTL 계산은 Task 2.9 구현 단계에서 earnings-calendar 룩업 helper 추가)
- ✓ DB 스키마 3개 + Cron — Task 2.3, 2.4, 2.5
- ✓ Server Action 9개 — Task 2.6
- ✓ Gemini 모델 분기 — Task 2.7
- ✓ 모델 선호 저장 — Task 2.8
- ✓ 챗봇 컨텍스트 전환 — Task 2.15, Task 1.17
- ✓ Skills 확장 — Task 1.6, Task 2.17
- ✓ 30분 타임아웃 — siglens-core 워커 dispatch 시점에 timeout 옵션. NOTE: 기존 worker(`siglens-worker`)는 자체 timeout이 없어 보이므로 별도 PR로 추가 필요할 수 있음. 1차 출시는 무 타임아웃 유지 + Phase 3.2에서 모니터링 후 결정.
- ✓ SEO + breadcrumb + sitemap — Task 2.16
- ✓ Tier 매핑 — Task 1.2
- ✓ 사용자 노출 모델 동일 — Task 2.7
- ✓ Press Release 제외 (Grades + Earnings로 채움) — Task 1.13/1.14에 반영 (애널리스트 액션 섹션 = grades 사용)

빠진 곳:
- **30분 타임아웃의 정확한 구현**. siglens-core의 worker dispatch fetch에 `signal: AbortSignal.timeout(30 * 60 * 1000)` 추가하거나, worker 측에서 강제 종료. 구현 시 Phase 3.2 검증 결과 보고 결정.
- **사용량 카운트 호출 (`checkAnalysisLimit`) 위치 명시 — 구현 단계 보강 항목**. Task 1.12 / 1.13 / 1.16의 submit* 코드 예시에는 짧게 보이려고 omit했으나, 실제 구현은 기존 `submitAnalysis.ts`(siglens-core)의 `checkAnalysisUsageAllowed` 패턴을 그대로 복사해야 한다:

```typescript
if (options.usage && options.tier) {
    const occurredAt = options.now ?? new Date();
    const allowed = await checkAnalysisLimit(
        {
            ipHash: hashUsageIp(options.usage.clientIp, occurredAt),
            tier: options.tier,
            now: occurredAt,
            config: options.tierConfig ?? TIER_CONFIG,
        },
        { usage: options.usage.usageRepository }
    );
    if (!allowed) {
        return {
            status: 'error',
            code: 'usage_limit_exceeded',
            message: '오늘 분석 한도를 초과했습니다.',
        };
    }
}
```

siglens 측은 Phase 4(`enableTierRestrictions = true`) 전까지 `tier`/`usage` 인자를 비워서 호출하므로 enforce는 자동으로 비활성. spec §7과 일관.

---

## Revision History

| Date | Change |
|---|---|
| 2026-05-02 | 최초 작성 — spec 기반 단계별 plan |

