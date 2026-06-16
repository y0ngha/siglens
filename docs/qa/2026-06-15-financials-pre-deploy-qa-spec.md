# Financials 탭 — 배포 전 감사 & QA Spec

> 대상 PR: #592 (`feat/financials`), HEAD `0ea54a75`
> 작성일: 2026-06-15
> 목적: `/[symbol]/financials` 신규 탭의 **배포 전 감사**와 **prod-like 실증 QA**의 단일 기준 문서.
> E2E·단위 테스트가 커버하더라도, 실제 Production 빌드/실행에서 동작·SEO에 문제가 없는지
> curl(응답/Status) + Chrome(시각) 두 트랙으로 검증한다.

---

## 0. 변경 범위 (Scope)

### 0.1 신규 라우트 (`src/app/[symbol]/financials/`)
- `page.tsx` — ISR 페이지(`revalidate = 86400`, `generateStaticParams = []`). SSR에서 연간 스냅샷 + 스코어카드 계산, JSON-LD(WebPage/Breadcrumb/FAQ) 주입.
- `financialData.ts` — `getFinancialsPageData(symbol)`: 6-fetch 스냅샷(`getFinancialsSnapshot`) + `computeFinancialsScorecard`.
- `FinancialsDegraded.tsx` — 데이터 fetch 실패 시 graceful degradation UI.
- `actions.ts` — page-scoped server actions.
- `opengraph-image.tsx`, `twitter-image.tsx` — 동적 OG/Twitter 이미지.
- `generateMetadata` — `buildSymbolFinancialsSeoContent` 기반 title/description/canonical.

### 0.2 데이터·캐시 (`src/shared/api/fmp/`, `src/entities/financials-statements/`)
- `financialStatementsClient.ts` — FMP 6종 엔드포인트 호출:
  `income-statement`, `balance-sheet-statement`, `cash-flow-statement`,
  `income-statement-growth`, `financial-growth`, `cash-flow-statement-growth`.
- `CachedFinancialStatementsProvider.ts` — 2계층 캐시(Next Data Cache `fmpGet` revalidate + Redis `getOrSetCache`), 단일 TTL. **항상 MAX limit fetch 후 slice**(캐시 truncation 오염 방지).
- `FakeFinancialStatementsProvider.ts` — E2E 스텁.
- `getFinancialStatementsProvider.ts` — prod=FMP / E2E=Fake 팩토리.
- `getFinancialsSnapshot.ts` — 6-fetch + core 정규화 단일 source. `ANNUAL_LIMIT=5`, `QUARTER_LIMIT=8`.
- `getFinancialsQuarterAction.ts` — 분기 스냅샷 lazy fetch server action.

### 0.3 분석 잡 (`src/entities/analysis/actions/`)
- `submitFinancialsAnalysisAction.ts` / `pollFinancialsAnalysisAction.ts` / `cancelFinancialsAnalysisJobAction.ts` — AI 요약 잡 submit/poll/cancel. 봇 → `skipEnqueue` → core `miss_no_trigger` → BotBlockedNotice.
- `submitOverallAnalysisAction.ts` — overall에 `financialsBulletsKo` 통합.

### 0.4 위젯 (`src/widgets/financials/`)
- 스코어카드: `FinancialsScorecard`, `CompositeGradeGauge`, `AxisScoreCard`(4축 growth/quality/solvency/cash + composite), `axisLabels`, `financialsTooltips`(InfoTooltip 용어 해설).
- 명세표: `sections/StatementTable`, `FinancialTrendChart`, `IncomeStatementSection`, `BalanceSheetSection`, `CashFlowSection`, `GrowthAnalysisSection`, `EmptySectionCard`, `toDisplayOrder`.
- AI 요약: `FinancialsAiSummary`, `FinancialsAiSummarySkeleton`, `FinancialsAiSummaryError`.
- 토글: `PeriodToggle`, `hooks/useFinancialsPeriod`(annual/quarter, 실패 시 annual fallback).
- 분석 훅: `hooks/useFinancialsAnalysis`(submit/poll/cancel, AbortSignal, race-guard).
- 유틸: `utils/buildChatState`(ChatPanel 컨텍스트 publish), `utils/financialsPeriodUtils`, `utils/numberFormat`.

### 0.5 통합 (overall / symbol-page / SEO)
- `widgets/overall/sections/FinancialsSummary.tsx` + `OverallContent.tsx` — 종합 분석에 재무 요약 주입.
- `widgets/symbol-page/utils/symbolTabsConfig.ts` — financials 탭 추가.
- `widgets/symbol-page/CrossLinkCards.tsx` — financials 교차 링크.
- `shared/lib/seo.ts` — `buildSymbolFinancialsSeoContent`.
- `entities/sitemap-entry/lib/buildPopularEntries.ts` — 인기 종목 sitemap에 financials 포함.

---

## 1. 테스트 환경

### 1.1 Prod-like 빌드 (실증의 전제)
- 워크트리 `node_modules`는 **symlink 금지**(Turbopack 거부/dual-React). `cp -al` 하드링크 또는 독립 `yarn install`.
- `.env.local` / `.env.production` 키셋이 형제 워크트리와 일치하는지 확인(QA env 스왑 복원 누락 주의).
- `siglens-core` 버전 0.22.0 핀 일치 확인.
- 빌드 exit code는 파이프 없이 직접 캡처(`> log 2>&1; echo $?`).
- `yarn build` → `yarn start`(prod) 또는 `yarn dev`(개발서버) 기동.

### 1.2 검증 대상 심볼
- 정상: `AAPL`(대형주, 6종 모두 풍부), `MSFT`.
- 엣지: ETF/Index(예: `SPY`), 데이터 희소 심볼, 존재하지 않는 심볼.

---

## 2. 검증 항목 (Test Case 생성의 기준)

### 2.1 Curl 트랙 (응답값 / Status Code)
| ID | 항목 | 기대 |
|---|---|---|
| C1 | `GET /AAPL/financials` | 200, HTML, `<h1>AAPL 재무제표`(또는 동등) 포함 |
| C2 | JSON-LD | WebPage·BreadcrumbList·FAQPage 3종 `<script type="application/ld+json">` 존재, 유효 JSON |
| C3 | `<head>` 메타 | canonical = `${SITE_URL}/AAPL/financials`, og:title/description, twitter card |
| C4 | OG 이미지 | `GET /AAPL/financials/opengraph-image` 200, `image/*` |
| C5 | 봇 UA | 봇 User-Agent로 요청 시 AI 분석 미트리거(BotBlockedNotice 경로), 페이지 자체는 200 |
| C6 | 잘못된 심볼 | 비정상 심볼 → 404 또는 graceful degraded(서버 500 없음) |
| C7 | sitemap | 인기 종목의 `/financials` URL이 sitemap에 포함 |
| C8 | robots | financials 경로가 학습봇 정책과 정합(기존 robots 규칙 불변) |
| C9 | overall 페이지 | `/AAPL/overall` 200, 재무 요약 섹션 SSR 포함 |

### 2.2 Chrome 트랙 (시각/상호작용)
| ID | 항목 | 기대 |
|---|---|---|
| B1 | 페이지 렌더 | 스코어카드(4축+composite 게이지), 명세표, 차트가 시각적으로 정상 |
| B2 | InfoTooltip | 어려운 용어 hover/click 시 해설 노출 |
| B3 | 분기 토글 | annual↔quarter 전환, quarter lazy fetch 후 표/차트 갱신 |
| B4 | 분기 실패 fallback | quarter fetch 실패/빈 데이터 시 annual로 자동 복귀(빈 화면 아님) |
| B5 | AI 요약 | 로딩 스켈레톤 → 결과 노출, 에러 시 에러 카드, 봇 시 차단 안내 |
| B5b | AI 분석 실동작 | submit→poll→결과 전체 플로우가 실제로 완료되어 분석 텍스트가 노출(잡 lifecycle 정상) |
| B6 | ChatPanel 컨텍스트 전환 | **챗봇을 켠 상태**에서 financials 탭 진입/타 탭 이동 시 컨텍스트가 재무제표로 정확히 전환(이전 탭 컨텍스트 잔존 없음), `done` 전 입력 disabled |
| B11 | 분석 이후 캐싱 | 분석 완료 후 동일 심볼 재진입/재요청 시 캐시 히트(warm) — 재분석 미트리거·응답 즉시. annual/quarter·overall 캐시 키 분리 정상 |
| B7 | 음수/결측 | 음수 값 막대 분기, null 값 `—` 표기, 데이터 없는 섹션 EmptySectionCard |
| B8 | 반응형 | 모바일/데스크탑 레이아웃 깨짐 없음 |
| B9 | 교차 링크/탭 | symbol-page 탭에 financials 노출, CrossLinkCards 링크 정상 |
| B10 | 콘솔 | 런타임 콘솔 에러/경고 없음(의도된 warn 제외) |

### 2.3 안정성 / 회귀
| ID | 항목 | 기대 |
|---|---|---|
| S1 | ISR cold-gen | 미캐시 cold render에서 500 없음(connection()/dynamic API 미사용) |
| S2 | 캐시 정합 | annual/quarter 캐시 키 분리, MAX-fetch+slice로 truncation 오염 없음 |
| S3 | 기존 탭 회귀 | chart/overall/options/fundamental 등 기존 페이지 정상 |
| S4 | 빌드 | prod build 성공(exit 0), 정적 prerender 중 에러 없음 |

---

## 3. 합격 기준 (Exit Criteria)
- Curl C1~C9, Chrome B1~B10, 안정성 S1~S4 전부 PASS.
- prod build exit 0, 런타임 콘솔 에러 0.
- 5개 감사 에이전트(코드/배포안정성×2/SEO/테스트커버리지)에서 Blocker 0.
- 테스트 커버리지 financials 영역 90%+ (worst/edge/integration/e2e 포함).
