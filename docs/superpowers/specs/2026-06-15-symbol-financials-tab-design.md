# [symbol] 재무제표 탭(financials) 설계

> 2026-06-15 · `/[symbol]/financials` 신규 탭. FMP 재무제표 6종(손익/재무상태/현금흐름 + 각 성장)을 **열람(표·차트) + 분석(룰 점수 4축 + AI 코멘트)**으로 제공하고, overall 종합 분석·ChatPanel·SEO에 통합한다.

이 문서는 두 독립 프로젝트 중 **2번([symbol] 재무 강화)** 의 설계다. 1번(미국 시장 흐름 페이지: 뉴스/경제지표/캘린더)은 별도 스펙으로 진행한다.

---

## 1. 배경 / 문제

현재 `[symbol]/fundamental` 페이지가 호출하는 FMP 재무 endpoint를 전수 점검한 결과, 사용자가 강화를 원하는 6개 endpoint는 **2개만 "부분" 사용, 4개는 완전 미사용**이다.

| # | FMP endpoint | 한글 | 현재 사용 | 상세 |
|---|---|---|---|---|
| 1 | `income-statement` | 손익계산서 | ❌ 미사용 | 원본 statement 미fetch |
| 2 | `income-statement-growth` | 손익계산서 성장 | ⚠️ 부분 | `revenueGrowth`·`growthEPS` 2개 필드만 (`GrowthSection`) |
| 3 | `balance-sheet-statement` | 재무상태표 | ❌ 미사용 | `ratios-ttm` 파생 비율만 |
| 4 | `financial-growth` | 재무제표 성장(종합) | ❌ 미사용 | 40+ 종합 성장 지표 전부 미사용 |
| 5 | `cash-flow-statement` | 현금흐름표 | ⚠️ 부분 | `operatingCashFlow` 1개 필드만 (`FinancialHealthSection`) |
| 6 | `cash-flow-statement-growth` | 현금흐름표 성장 | ❌ 미사용 | 37개 현금흐름 성장 필드 전부 미사용 |

**용어 매핑**: "재무제표" = `balance-sheet-statement`(재무상태표), "재무제표 성장" = `financial-growth`(종합 성장)로 확정(사용자 첫 메시지 괄호 표기 근거).

결과적으로 펀더멘털 페이지는 재무제표 **원본**(손익/재무상태/현금흐름)을 거의 쓰지 않고 TTM 집계 비율 + 매출·EPS 성장 2개에만 의존한다. 6개 endpoint는 강화 여지가 매우 크다(실 API 호출로 응답 필드 검증 완료 — §부록 A).

## 2. 목표 / 비목표

### 목표
1. `/[symbol]/financials` 신규 탭에서 6개 endpoint를 **모두** 활용해 재무제표 원본을 **열람**(연 5년 + 분기 토글, 표·inline SVG 차트)할 수 있게 한다.
2. core 순수 함수로 **결정론적 룰 점수 4축(성장성/수익성·질/안정성/현금) + 종합 등급**을 산출하고, 그 위에 **AI 코멘트**를 단다(하이브리드).
3. 어려운 용어는 기존 house style(`~이에요`체)에 맞춘 `InfoTooltip`으로 풀어준다.
4. **overall 종합 분석**에 재무 분석 축을 통합한다(룰 스코어카드 주입 방식).
5. **ChatPanel**이 재무제표 탭에서 재무 컨텍스트로 전환되게 한다.
6. 기존 **캐시 전략(2계층: Next Data Cache + Redis `getOrSetCache`, 단일 TTL 상수 공유)**, **ISR**, **봇 차단** 패턴을 그대로 따른다. AI 분석은 `fundamental`처럼 **클라 폴링만**(peek SSR seed 미사용 — 룰 데이터가 SEO를 충족).
7. 테스트 **커버리지 90% 이상**, happy + worst case, 필요 시 Vitest·Playwright E2E 작성.

### 비목표 (이번 범위 밖)
- **상원/하원 거래(`senate-trades`)** — 센티먼트 성격이라 재무제표와 응집도가 달라 **별도 스펙**으로 분리.
- **1번 프로젝트**(시장 흐름 페이지) — 별도 스펙.
- 기존 `fundamental` 탭/분석의 응답 스키마 변경 — **건드리지 않는다**(회귀 위험 0). financials는 독립 슬라이스.
- tier 게이팅 — 현재 미작동(메모리)이라 **전체 공개**. 추후 authed storageState로 채움.

## 3. 레포 분담 (SCOPE)

`docs/architecture/SCOPE.md` 원칙 — **도메인 로직=core, 외부 I/O·UI=siglens**.

| 구분 | siglens-core (도메인) | siglens (앱) |
|---|---|---|
| Provider | `FinancialStatementsProvider` **port**(interface) | `FmpFinancialStatementsClient` **adapter**(구현) + `CachedFinancialStatementsProvider` |
| 타입 | domain-neutral Row 타입, `FinancialsSnapshot`, `FinancialsScorecard`, `FinancialsAnalysisResponse`, `Raw*` | FMP raw 타입(`RawFmp*`) |
| 로직 | `computeFinancialsScorecard`(룰 점수), `normalizeFinancialsSnapshot`, `buildFinancialsAnalysisPrompt`, `normalizeFinancialsAnalysisResponse`, `submit/pollFinancialsAnalysis` | server actions(위임), 페이지/위젯/hook |
| overall/chat | `OverallAnalysisResponse` 확장, `CurrentAnalysisContext` 확장, 프롬프트 빌더 | UI 섹션, `buildChatState`, 액션 데이터 수집 |

> **cross-repo 순서**(메모리): core 변경 → overlay 로컬 검증 → **사용자가 core tag 릴리스(npm.pkg.github.com)** → siglens `package.json` core 버전 갱신 + clean install → siglens 구현. `PROMPT_TEMPLATE_VERSION` bump 필요(신규 프롬프트).

## 4. 설계

### 4.1 아키텍처 & 데이터 흐름

```
[RSC 진입] getProfileResilient 게이팅(404 / degraded)
   └→ 연간 5년 6종 fetch (staticSymbolCache + Redis, Promise.all)
         └→ core.computeFinancialsScorecard(동기, 비용0)
              └→ 재무제표 표·차트 + 4축 스코어카드 즉시 SSR   ← SEO/LCP (AI 없이도 콘텐츠 풍부)

[클라] FinancialsAiSummary → useFinancialsAnalysis → submit/poll(잡) → AI 코멘트
[클라] 분기 토글 → server action으로 분기 8개 lazy fetch (기본 페이로드 절약)
[봇]   isBot → skipEnqueueIfMiss → 캐시 MISS 시 AI 잡 생략(비용↓), 스코어카드·표는 항상 SSR
```

**렌더 전략**: 룰 점수·표·차트는 **동기 SSR**(즉시 노출), AI 코멘트만 **클라 폴링**(peek SSR seed 미사용 — §4.7).

### 4.2 siglens-core 변경

#### (1) Provider port — `FinancialStatementsProvider`
기존 `FundamentalDataProvider`(최신 단일값 성격)와 분리한 **신규 port**. 다년 시계열 6종.
```ts
interface FinancialStatementsProvider {
  getIncomeStatements(symbol: string, period: StatementPeriod, limit: number): Promise<IncomeStatementRow[]>;
  getBalanceSheets(symbol: string, period: StatementPeriod, limit: number): Promise<BalanceSheetRow[]>;
  getCashFlowStatements(symbol: string, period: StatementPeriod, limit: number): Promise<CashFlowRow[]>;
  getIncomeStatementGrowths(symbol: string, period: StatementPeriod, limit: number): Promise<IncomeGrowthRow[]>;
  getFinancialGrowths(symbol: string, period: StatementPeriod, limit: number): Promise<FinancialGrowthRow[]>;
  getCashFlowGrowths(symbol: string, period: StatementPeriod, limit: number): Promise<CashFlowGrowthRow[]>;
}
type StatementPeriod = 'annual' | 'quarter';
```

#### (2) domain-neutral Row 타입 (분석·표시 공용 핵심 필드만 — core thin 유지)
```ts
interface IncomeStatementRow {
  fiscalYear: string; period: string; date: string; reportedCurrency: string | null;
  revenue: number | null; grossProfit: number | null; operatingIncome: number | null;
  netIncome: number | null; ebitda: number | null; eps: number | null; epsDiluted: number | null;
  grossMargin: number | null; operatingMargin: number | null; netMargin: number | null; // 파생(정규화 시 계산)
}
interface BalanceSheetRow {
  fiscalYear: string; period: string; date: string;
  totalAssets: number | null; totalCurrentAssets: number | null;
  totalLiabilities: number | null; totalCurrentLiabilities: number | null;
  cashAndShortTermInvestments: number | null; totalDebt: number | null; netDebt: number | null;
  totalStockholdersEquity: number | null; currentRatio: number | null; // 파생
}
interface CashFlowRow {
  fiscalYear: string; period: string; date: string;
  operatingCashFlow: number | null; capitalExpenditure: number | null; freeCashFlow: number | null;
  dividendsPaid: number | null; fcfMargin: number | null; // fcfMargin은 income.revenue 필요 → snapshot 정규화 단계 계산
}
interface IncomeGrowthRow   { fiscalYear; period; growthRevenue; growthNetIncome; growthEPS; growthOperatingIncome; } // number|null
interface FinancialGrowthRow{ fiscalYear; period; revenueGrowth; netIncomeGrowth; epsgrowth; freeCashFlowGrowth;
                              operatingCashFlowGrowth; assetGrowth; debtGrowth;
                              threeYRevenueGrowthPerShare; fiveYRevenueGrowthPerShare; tenYRevenueGrowthPerShare; ... }
interface CashFlowGrowthRow { fiscalYear; period; growthOperatingCashFlow; growthFreeCashFlow; growthCapitalExpenditure; }
```
> 어댑터(siglens)가 FMP wire 필드 → domain 필드 매핑 책임(`mktCap`→`marketCap` 류). 전체 50+ 회계 항목이 아니라 분석·표시에 쓰는 ~10–15필드/statement만.

#### (3) 룰 점수 순수함수 — `computeFinancialsScorecard` (`detectSignals` 패턴, 결정론적)
```ts
interface FinancialsSnapshot {
  income: IncomeStatementRow[]; balance: BalanceSheetRow[]; cashFlow: CashFlowRow[];
  incomeGrowth: IncomeGrowthRow[]; financialGrowth: FinancialGrowthRow[]; cashFlowGrowth: CashFlowGrowthRow[];
}
interface FinancialsScorecard {
  growth: AxisScore; quality: AxisScore; solvency: AxisScore; cash: AxisScore;
  composite: { score: number; grade: Grade; summaryKo: string };
}
interface AxisScore { score: number /*0–100*/; grade: Grade; signals: FinancialSignal[]; metrics: ScoreMetric[]; }
type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
interface FinancialSignal { type: FinancialSignalType; direction: 'positive' | 'negative' | 'neutral'; }
```
| 축 | 결정론적 룰 (0–100 정규화 → 등급) |
|---|---|
| 성장성 | 매출·순이익 5Y CAGR + EPS/FCF 성장 + 일관성(양수연도 비율) + 가속(최근>과거) |
| 수익성·질 | 마진 수준 + 추세(개선/악화) + **accruals(영업CF/순이익 ≥1 가점)** |
| 안정성 | debtRatio + currentRatio + netDebt(순현금 가점) + 부채 추세 |
| 현금 | FCF마진 + FCF 양수 일관성 + 영업CF→FCF 전환 + CapEx 강도 |

- 등급 매핑: A≥80 · B≥65 · C≥50 · D≥35 · F<35. 임계값은 core 도메인 상수(`refs/theory`·`refs/indicators` 참고).
- composite는 4축 가중합. `summaryKo`는 룰 기반 한 줄 요약(템플릿).

#### (4) AI 분석 잡 (fundamental 미러링)
- `submitFinancialsAnalysis(options) / pollFinancialsAnalysis(jobId) / cancelFinancialsAnalysisJob(jobId)`
- `buildFinancialsAnalysisPrompt(snapshot, scorecard, skills)` — **룰 스코어카드를 프롬프트에 주입**(룰+AI 결합). `category: 'financials'`(또는 'fundamental') skill 주입.
- 출력 `FinancialsAnalysisResponse { overallConclusionKo; axisAssessments: FinancialsAxisAssessment[]; riskFactorsKo: string[]; overallSentiment: FinancialsSentiment }`
  - `FinancialsAxisAssessment { axis: 'growth'|'quality'|'solvency'|'cash'; sentiment; rationaleKo }`
  - `FinancialsSentiment = 'bullish' | 'neutral' | 'bearish'`
- Redis 캐시 키 symbol+modelId, `PROMPT_TEMPLATE_VERSION` bump.

#### (5) LLM Raw → 정규화 (사용자 강조 — `normalizeFundamentalAnalysisResponse` 패턴)
```ts
interface RawFinancialsAnalysisResponse {
  overallConclusionKo?: unknown; axisAssessments?: unknown;
  riskFactorsKo?: unknown; overallSentiment?: unknown;
}
function normalizeFinancialsAnalysisResponse(raw: unknown): FinancialsAnalysisResponse;
```
동작: **markdown fence(` ```json `) 제거 → `JSON.parse` → 방어적 정규화**(누락 string→`''`, 누락 array→`[]`, invalid enum→`'neutral'`, malformed child 항목 **드롭**). **절대 throw 안 함**, 항상 typed 반환. → worst case(LLM 오출력)에도 렌더 안전.

#### (6) overall 통합 (§4.8) / (7) chat 통합 (§4.9) — core 타입 확장

### 4.3 siglens 변경

| 영역 | 위치 | 내용 |
|---|---|---|
| FMP 어댑터 | `shared/api/fmp/financialStatementsClient.ts` | 6 endpoint 구현(`period`/`limit`), `implements FinancialStatementsProvider`, `fmpGet`(revalidate) 사용, raw→domain 매핑, `toFiniteNumber` |
| 캐시 데코 | `shared/api/fmp/CachedFinancialStatementsProvider.ts` | `cache(() => getOrSetCache(key, TTL, fetcher).catch(()=>null))` — `CachedFundamentalProvider` 패턴 |
| 팩토리 | `shared/api/fmp/getFinancialStatementsProvider.ts` | 싱글톤, E2E 분기(`FakeFinancialStatementsProvider`) |
| Fake | `shared/api/fmp/FakeFinancialStatementsProvider.ts` | 결정론적 E2E 픽스처 |
| 페이지 | `app/[symbol]/financials/{page.tsx, financialData.ts}` | RSC + `staticSymbolCache` + ISR 24h + `generateMetadata` + JsonLd |
| 위젯 | `widgets/financials/**` | §4.4 |
| 탭 | `widgets/symbol-page/utils/symbolTabsConfig.ts` | `{ key:'financials', label:'재무제표', hrefBuilder: s=>`/${s}/financials` }` |
| 액션 | `entities/analysis/actions/{submit,poll,cancel}FinancialsAnalysisAction.ts` (+ `actions.ts` barrel) | core 위임, `isBot`→`skipEnqueueIfMiss`, `resolveTierAndByok`, E2E stub |
| 쿼리키/폴링 | `shared/config/queryConfig.ts`, `pollingConfig.ts` | `QUERY_KEYS.financialsAnalysis(symbol, modelId)`, `ANALYSIS_POLL_INTERVAL_MS` 재사용 |

### 4.4 UI 레이아웃 & 컴포넌트

```
┌─ /[symbol]/financials ──────────────────────────────────────┐
│ ┌ 종합 재무 등급(히어로): 반원 게이지 + B+(78/100) + 룰 요약 ┐ │
│ ┌성장성 A┐┌수익성 B┐┌안정성 A┐┌현금 B+┐ ← 미니게이지+시그널 칩 │
│  [ 연간 ][ 분기 ]  ← 세그먼트 토글                            │
│ ┌손익계산서: 매출·순이익 5년 막대(SVG) + 표┐┌재무상태표┐       │
│ ┌현금흐름표: 영업CF·FCF·CapEx + 표┐┌성장성 분석: 성장률+CAGR┐ │
│ ┌ AI 재무제표 분석(클라 폴링): [긍정] 총평+4축+위험 ┐         │
└──────────────────────────────────────────────────────────────┘
```
`src/widgets/financials/` (기존 `widgets/fundamental` 구조 미러링):
```
FinancialsScorecard.tsx     # 종합 히어로 + 4축 (SSR, core scorecard 입력)
  ├ CompositeGradeGauge.tsx  # FearGreedGauge(반원 SVG+니들) 응용
  └ AxisScoreCard.tsx ×4     # 미니게이지 + 등급 + FinancialSignal 칩
PeriodToggle.tsx             # 연간/분기 (TimeframeSelector 패턴)
sections/{IncomeStatement,BalanceSheet,CashFlow,GrowthAnalysis}Section.tsx
sections/FinancialTrendChart.tsx  # 재사용 inline SVG 막대/라인 (GrowthChart 확장)
sections/StatementTable.tsx       # 재사용 표 (PeersTable 패턴)
sections/EmptySectionCard.tsx     # 데이터 없음(공용 승격 검토)
FinancialsAiSummary.tsx (+Skeleton/Error/View)
hooks/{useFinancialsAnalysis, useFinancialsPeriod}.ts
utils/buildChatState.ts
index.ts (barrel)
```
- 카드 `border-secondary-700 bg-secondary-800 rounded-xl border p-6` · 값 `font-mono tabular-nums`
- 양수 `text-chart-bullish` / 음수 `text-chart-bearish` / 등급 A·B `ui-success` · C `ui-warning` · D·F `ui-danger`
- primitive 재사용: `InfoTooltip` `MarkdownText` `TabsPill` `DotSeparator` `BotBlockedNotice`
- a11y: h1 `"{TICKER} 재무제표"`, 섹션 h2, 게이지 `role="img"`+aria-label, 토글 키보드 내비

### 4.5 InfoTooltip 용어 워딩

house style: `~이에요`체 / 정의→해석→임계값 / 2–4문장 / `max-w-xs`. 기존 용어(부채비율·유동비율·영업현금흐름·ROE·마진)는 **재사용**, 신규만 작성.

| 용어 | 툴팁(초안) |
|---|---|
| 잉여현금흐름(FCF) | 본업으로 번 현금에서 설비투자(CapEx)를 빼고 남아 자유롭게 쓸 수 있는 현금이에요. 배당·자사주·빚 상환의 재원이 돼요. 꾸준히 양수(+)면 현금 창출력이 탄탄하다는 뜻이에요. |
| 순부채(Net Debt) | 총부채에서 보유 현금을 뺀 값이에요. 음수(−)면 현금이 빚보다 많은 '순현금' 상태로 재무가 매우 탄탄하다는 뜻이에요. |
| 이익의 질(accruals) | 장부상 순이익이 실제 영업현금흐름으로 얼마나 뒷받침되는지 보는 거예요. 영업현금흐름이 순이익보다 많으면(비율 1 이상) 이익의 질이 좋다고 봐요. 반대면 장부 이익만 크다는 신호예요. |
| 자본적지출(CapEx) | 공장·설비처럼 미래를 위해 투자한 돈이에요. 매출 대비 너무 크면 현금 부담, 적절하면 성장 투자로 봐요. |
| FCF 마진 | 매출 100원당 잉여현금흐름이 몇 원인지예요. 높을수록 매출을 현금으로 잘 바꾼다는 뜻이에요. |
| 연평균 성장률(CAGR) | 여러 해의 성장을 매년 평균 몇 %씩 자랐는지로 환산한 값이에요. 들쭉날쭉한 성장을 한 숫자로 비교할 수 있어요. |
| 매출총이익률 | 매출에서 원가를 뺀 매출총이익이 매출의 몇 %인지예요. 높을수록 제품의 기본 수익성이 좋다는 뜻이에요. |

### 4.6 캐시 전략 / Redis TTL (사용자 강조)

2계층 캐시, **단일 TTL 상수 공유**로 신선도 일치(기존 `FMP_FUNDAMENTAL_REVALIDATE_SECONDS` 주석 원칙).
- 신규 상수 `FMP_STATEMENTS_REVALIDATE_SECONDS = SECONDS_PER_DAY`(24h) — 재무제표는 분기성(~45일)이라 1h보다 길게.
- **계층 1 (Next Data Cache)**: `financialStatementsClient`의 `fmpGet(path, query, { revalidate: FMP_STATEMENTS_REVALIDATE_SECONDS })`.
- **계층 2 (Redis)**: `CachedFinancialStatementsProvider`가 `getOrSetCache(key, FMP_STATEMENTS_REVALIDATE_SECONDS, fetcher)`. **같은 상수** 사용.
- 키 규칙(period 포함): `financials:income:{SYMBOL}:{period}`, `financials:balance:{SYMBOL}:{period}`, `financials:cashflow:{SYMBOL}:{period}`, `financials:income-growth:…`, `financials:financial-growth:…`, `financials:cashflow-growth:…`. (`{SYMBOL}`=대문자, `sym()`)
- per-request dedup: `cache(() => getOrSetCache(...))`.
- **cache poisoning 방지**: FMP throw → Redis `set` 미수행, `.catch(()=>null)`로 graceful null(envelope `{data:null}`로 빈 결과와 구분).
- 페이지 `staticSymbolCache(['financials:income', symbol], symbol, () => provider.getIncomeStatements(...), ['financials:'+symbol])` — `symbol:{SYM}` + 그룹 태그.
- AI 분석 캐시(core): symbol+modelId, `PROMPT_TEMPLATE_VERSION`.

### 4.7 SEO / ISR / 봇

- `generateMetadata`: `buildSymbolFinancialsSeoContent(ticker, name)` → title `"{TICKER} 재무제표 — 매출·이익·현금흐름 5년"`, `clampSeoDescription(120)`, canonical `/{symbol}/financials`, OG `buildSymbolOgImage({ticker, label:'재무제표'})`, ko_KR, `summary_large_image`. 미존재 심볼 `NOINDEX_SYMBOL_METADATA`(soft-404 방지).
- JsonLd: `WebPage` + `BreadcrumbList`(필수) + `FAQPage`(3문항). *(Dataset 스키마는 스팸 위험으로 보류.)*
- sitemap: `LONGTAIL_ENTRIES_PER_TICKER` 5→6. CrossLinkCards 6→7(현재 페이지 `aria-current="page"`).
- **ISR**: `export const revalidate = 86400`(24h) + `generateStaticParams()→[]`(on-demand). `connection()`/dynamic API **미사용**(메모리: ISR cold-gen+connection=500 회피).
- **SEO 핵심 / peek 미사용 결정**: 룰 스코어카드·표·차트가 **동기 SSR**이라 AI 없이도 크롤러가 재무 텍스트·수치를 항상 봄. 따라서 **AI는 클라 폴링만**(fundamental 패턴), `peek*Cache` SSR seed는 **사용하지 않음**. 근거: ① 룰 데이터로 SEO 충족(AI 한 단락의 한계효용 작음), ② SSR HTML이 **결정론적**으로 유지돼 비결정적 AI 출력의 **ISR write churn 회피**(메모리: Vercel ISR Writes가 실제 비용 요인), ③ core `peek` 함수·페이지 Suspense 분기·hook `initialData` 제거로 복잡도 절감. (overall은 종합 AI가 본 콘텐츠라 peek seed하지만 financials는 본 콘텐츠가 룰 데이터라 fundamental 쪽. 추후 필요 시 peek 추가는 확장 가능.)
- **봇**: `isBot(headers)`→`skipEnqueueIfMiss`→core `miss_no_trigger`→`BotBlockedNotice`(fundamental과 동일). 봇은 AI 잡을 트리거하지 않아 비용 보호. 봇이 보는 SSR HTML은 룰 스코어카드·표(AI 없음)로 이미 SEO 충분.
- `docs/architecture/ISR_REVALIDATE.md`에 financials 행 추가.

### 4.8 overall 종합 분석 통합 (방식 A — 스코어카드 주입)

financials를 **독립 AI 잡 축이 아니라 룰 스코어카드 주입**으로 통합(overall 폴링 시간·비용 영향 0).
- core: `OverallAnalysisResponse`에 `financialsBulletsKo: string[]` 추가, `OverallDependencyInputs`에 `financialsScorecard?: FinancialsScorecard` 슬롯, `buildOverallAnalysisPrompt`에 scorecard 인자 추가. (`OverallAxis` 잡 union 미변경.)
- siglens: `submitOverallAnalysisAction`의 `Promise.all` 데이터 수집에 statement fetch + `computeFinancialsScorecard`(동기) 추가 → core 전달.
- UI: `widgets/overall/sections/FinancialsSummary.tsx` 추가, `OverallContent`에 펀더멘털 다음 위치 렌더.

### 4.9 ChatPanel 컨텍스트 통합

- core: `CurrentAnalysisContext` union에 `{ kind: 'financials'; payload: FinancialsAnalysisResponse }` 추가, `requestChatCompletion`/`buildChatPrompt`가 이 kind 처리(재무 분석+스코어카드 맥락 답변).
- siglens: `widgets/financials/utils/buildChatState.ts` — financials `done`이면 `{ context:{kind:'financials',payload}, timeframe:null, isAnalysisReady:true }`. `FinancialsAiSummary`에서 `usePublishSymbolChat(chatState)`.
- 결과: 재무제표 탭 진입 시 챗봇이 재무 컨텍스트로 전환, 탭 이탈 시 `clear()`(기존 동작).

## 5. 에러 처리 · 정규화 · 엣지케이스 (worst case)

| 상황 | 처리 |
|---|---|
| LLM 오출력(깨진 JSON/필드 누락/잘못된 enum) | `normalizeFinancialsAnalysisResponse` 방어 정규화, throw 금지(§4.2-5) |
| FMP 429/5xx/timeout | `fmpGet` 재시도(`FMP_TRANSIENT_RETRY`) → 실패 시 throw → 데코레이터 `.catch(()=>null)`(캐시 미오염) |
| statement 빈 배열/부분 | 섹션별 `Suspense`+`EmptySectionCard`, 점수는 가능한 축만 |
| 신규 상장(<2년) | CAGR/추세 계산 불가 지표를 **가중치에서 제외** + "데이터 부족" 표기(점수 0 오염 금지) |
| null 필드 | `toFiniteNumber`, 누락 지표 가중치 제외 |
| 미존재 심볼 / FMP degraded | `getProfileResilient` → 404(`notFound`) / degraded 200 |
| 봇 + 캐시 MISS | AI 잡 생략, 스코어카드·표는 SSR 노출 |
| 분기 토글 fetch 실패 | 토글 비활성 + 연간 유지, 사용자 알림 |

## 6. 테스트 전략 (커버리지 ≥ 90%, happy + worst)

### siglens-core (Vitest 단위)
- `computeFinancialsScorecard`: 각 축 임계값 경계(A/B/C/D/F), accruals 정상/이상, 가속/둔화, 일관성, **빈/부분/신규상장**, null 다수.
- `normalizeFinancialsAnalysisResponse`: 정상 + **worst(깨진 JSON, fence 포함, 필드 누락, 잘못된 enum, malformed child 드롭)**.
- `normalizeFinancialsSnapshot`, `buildFinancialsAnalysisPrompt`(scorecard 주입 검증).

### siglens (Vitest 단위)
- `FmpFinancialStatementsClient`: raw→domain 매핑, 빈 배열, 필드 누락, 429/5xx throw.
- `CachedFinancialStatementsProvider`: 키 포맷(period 포함), 캐시 HIT/MISS, throw→null(미오염), per-request dedup.
- 위젯 렌더(스코어카드/표/차트/AiSummary view·skeleton·error·bot_blocked), `useFinancialsAnalysis`(cached/submitted/poll/bot/abort), `buildChatState`.
- `generateMetadata`/JsonLd(canonical, noindex 분기).

### E2E (Playwright)
- 메모리 패턴(Tier 1~4 + resilience, `workers:1`, HYBRID): `FakeFinancialStatementsProvider` + `e2eCachedFinancials()` 픽스처 + `E2E_FORCE_FINANCIALS_ERROR_COOKIE`(에러주입).
- happy: 탭 진입 → 스코어카드·표 SSR → AI 폴링 완료 노출. overall에 재무 섹션. chat 재무 컨텍스트 전환.
- worst: AI 에러주입 → 에러 UI, 봇 UA → BotBlockedNotice + 스코어카드는 노출, 분기 토글.

## 7. 구현 순서 (cross-repo)

1. **core**: port·Row 타입·`computeFinancialsScorecard`·정규화·프롬프트·submit/poll·overall/chat 타입 확장 + 단위테스트. `PROMPT_TEMPLATE_VERSION` bump.
2. overlay 로컬 검증(siglens에서 core 소스 오버레이) → **사용자가 core tag 릴리스**(npm.pkg.github.com).
3. **siglens**: core 버전 갱신 + clean install → 어댑터·캐시·팩토리·Fake → 페이지·위젯·hook·액션·탭 → overall·chat·SEO 통합 → 테스트(단위+E2E) → ISR 검증.
4. review-agent → 수정 → mistake-managing-agent → git-agent (CLAUDE.md 라우팅).

## 8. 주요 파일 변경 목록 (siglens)

- 신규: `shared/api/fmp/{financialStatementsClient, CachedFinancialStatementsProvider, getFinancialStatementsProvider, FakeFinancialStatementsProvider}.ts`
- 신규: `app/[symbol]/financials/{page.tsx, financialData.ts}`
- 신규: `widgets/financials/**`
- 신규: `entities/analysis/actions/{submit,poll,cancel}FinancialsAnalysisAction.ts`
- 신규: `widgets/overall/sections/FinancialsSummary.tsx`
- 수정: `widgets/symbol-page/utils/symbolTabsConfig.ts`, `shared/config/queryConfig.ts`, `shared/config/time.ts`(`FMP_STATEMENTS_REVALIDATE_SECONDS`), `shared/lib/seo.ts`, `app/sitemap.ts`, CrossLinkCards, `widgets/overall/{OverallContent,hooks/useOverallAnalysis}.tsx`, `submitOverallAnalysisAction.ts`, `entities/analysis/actions.ts`, `e2eAnalysisStub.ts`, `docs/architecture/ISR_REVALIDATE.md`

## 9. 리스크 / 미해결

- **core 작업량**: 6 port 메서드 + 4축 산식 + 정규화 + 프롬프트 + 잡 + overall/chat 확장. 단계적 릴리스 필요.
- **룰 점수 임계값 튜닝**: 초기 상수는 `refs/theory`·도메인 기준; 실데이터로 보정 여지(후속).
- **분기 토글 데이터량**: lazy fetch로 기본 페이로드 보호하되, 토글 시 6종×8분기 페이로드 검토.
- **overall 프롬프트 비대화**: scorecard 주입이 토큰 증가 → 요약 형태로 주입.
- **결정 필요**: AI 분석 캐시 TTL(core), financials FAQ 3문항 문구, composite 가중치.

---

## 부록 A — FMP 응답 필드 (실 호출 검증, 2026-06-15)

- `income-statement`: revenue, costOfRevenue, grossProfit, operatingIncome, netIncome, ebitda, eps, epsDiluted, …(38필드)
- `balance-sheet-statement`: totalAssets, totalCurrentAssets, totalLiabilities, totalCurrentLiabilities, cashAndShortTermInvestments, totalDebt, netDebt, totalStockholdersEquity, …(50+필드)
- `cash-flow-statement`: operatingCashFlow, capitalExpenditure, freeCashFlow, dividendsPaid, netChangeInCash, …
- `income-statement-growth`: growthRevenue, growthNetIncome, growthEPS, growthOperatingIncome, …
- `financial-growth`: revenueGrowth, netIncomeGrowth, epsgrowth, freeCashFlowGrowth, operatingCashFlowGrowth, assetGrowth, debtGrowth, three/five/tenY*GrowthPerShare, …(40+필드)
- `cash-flow-statement-growth`: growthOperatingCashFlow, growthFreeCashFlow, growthCapitalExpenditure, …(37필드)
