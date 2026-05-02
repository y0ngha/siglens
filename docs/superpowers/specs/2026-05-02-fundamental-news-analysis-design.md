# Fundamental & News Analysis — Design Spec

**Date:** 2026-05-02
**Status:** Draft

---

## Overview

기존 [symbol] 차트 페이지(기술적 분석)에 더해 **펀더멘털 분석**, **뉴스 기반 분석**, 그리고 셋을 통합한 **AI 종합 분석** 세 가지를 새 페이지로 추가한다. 데이터는 FMP Starter Plan에서 받고, AI 분석은 기존 [symbol] 분석과 동일한 비동기 Job 큐 + Upstash Redis 캐시 패턴을 그대로 확장한다.

---

## Background

- siglens는 현재 기술적 분석(차트 + 지표 + 캔들/패턴 + AI 종합 리포트) 단일 축으로 구성. 같은 종목에 대한 펀더·뉴스 컨텍스트는 부재.
- 주식은 뉴스 이벤트로 단기 가격이 크게 움직이고, 장기 방향은 펀더멘털이 결정한다. 두 축 모두 분석 결과로 노출되어야 사용자 의사결정 근거가 풍부해짐.
- FMP Starter Plan으로 회사 프로필, 재무제표, 밸류에이션, 애널리스트 컨센서스, 뉴스, 어닝 캘린더 등 핵심 데이터에 접근 가능.
- siglens-core는 이미 분석 use-case 패턴(submit/poll/cancel + Upstash Redis 캐시 + Job 큐), 티어 시스템(Free/Member/Pro × 모델/타임프레임/InfoDepth × 사용량 카운트)을 보유. 새 분석 3종을 같은 프레임에 매핑한다.

---

## Goals / Non-goals

### Goals

- 종목별 펀더멘털 분석 페이지 (`/[symbol]/fundamental`)
- 종목별 뉴스 분석 페이지 (`/[symbol]/news`)
- 기술 + 펀더 + 뉴스를 통합한 AI 종합 분석 페이지 (`/[symbol]/overall`)
- 기존 [symbol] 차트 페이지에 가벼운 뉴스 보강 섹션 추가
- 4개 페이지 사이의 일관된 진입 동선(헤더 탭 + 페이지 끝 cross-link 카드)
- 뉴스 데이터 정규화 저장(다른 화면에서 재활용)
- 어닝 캘린더 1일 1회 Cron 적재
- AI 챗봇이 현재 페이지 분석 결과를 컨텍스트로 자동 활용

### Non-goals

- 매수/매도 추천, 진입/관망 가이드 (siglens 정책: 투자 advice 제공 안 함)
- 실시간 데이터 (FMP Starter도 15분 지연)
- 정보 깊이 enforce (siglens-core에 매핑만 정의, siglens enforce는 Phase 4 작업)
- 새 결제/티어 UI (Phase 4 작업)
- 페이지별 차등 모델 옵션 (모든 분석 페이지가 동일 모델 옵션 풀)

---

## Decisions Summary

| 영역 | 결정 |
|---|---|
| 페이지 구조 | 4개 페이지 분리 (chart / fundamental / news / overall) |
| 진입 동선 | 헤더 세그먼트 탭 + 페이지 끝 cross-link 카드. 탭 순서 차트 → 뉴스 → 펀더 → 종합 |
| URL | path 분리 (`/AAPL/fundamental` 등). 타임프레임은 `?tf=` 쿼리, canonical은 쿼리 제거 |
| Fundamental 깊이 | Standard (Lean / Standard / Deep 중) |
| News 깊이 | Standard. 자동 트리거. gemini-2.5-flash-lite 1회로 번역 + KO 요약 + sentiment 묶음 |
| A 보강 (차트 페이지 뉴스) | sentiment 뱃지 + KO 요약 + "뉴스 자료 종합" 1단락. B 캐시 재활용 |
| Overall 트리거 | 명시 트리거 (캐시 hit 즉시 표시). 활성 타임프레임 컨텍스트 사용 |
| Overall 의존성 | 캐시 miss인 선행 분석만 자동 백그라운드 트리거. 단계별 진행 UI |
| 캐싱 Tier | T1 5–15분 (뉴스), T2 6–24h (grades, sector 등), T3 동적 TTL `max(1h, min(7d, next_earnings_at − now − 1h))` (재무·earnings·etc), T4 30일 (profile/peers) |
| 저장소 | DB(news, earnings_calendar, earnings_reports) + Next.js fetch cache(종목별) + siglens-core Upstash Redis(분석 결과) |
| Cron | earnings-calendar 1일 1회 야간 → DB upsert |
| 모델 옵션 | 사용자 노출은 기존 [symbol] 분석과 동일. gemini-2.5-flash-lite는 번역/sentiment 내부 전용 |
| 모델 선호 저장 | 사용자 전역 (비회원 localStorage, 회원 user 설정) |
| 사용량 카운트 | 새 분석 4종 모두 `analysisPerDay` 통합 |
| InfoDepth | siglens-core에 매핑만 정의. siglens 미 enforce (기존 패턴) |
| BYOK | 기존 정책 그대로 |
| 챗봇 컨텍스트 | 현재 페이지 1개만 활성. 페이지 이동 시 시스템 메시지로 전환 안내. 대화 히스토리는 영구 유지 |
| Skills | Fundamental / News로 카탈로그 확장 (예: `skills/fundamental/value-investing.md`, `skills/news/event-driven.md`) |
| 분석 타임아웃 | 모든 모델 공통 30분 안전망 + 사용자 명시 취소 |
| 출시 | 4개 분석 동시 출시 (단일 릴리스) |
| 정보 출처 sentiment | 자체 LLM 판정 (gemini-2.5-flash-lite). FMP grades-consensus는 sentiment 대체 불가 |

---

## Architecture

### Layer & Repo 분배

```
siglens-core (npm 패키지)               siglens (Next.js 앱)
─────────────────────────              ─────────────────────
domain/                                infrastructure/fmp/
  fundamental/types.ts                   newsClient.ts
  news/types.ts                          earningsCalendarClient.ts
  overall/types.ts                       fundamentalClients.ts (peers, ratios, …)
  analysis/prompt.ts (확장)              gradesClient.ts
                                         priceTargetClient.ts
application/                             sectorPerformanceClient.ts
  fundamental/submit, poll, cancel
  news/submit, poll, cancel             infrastructure/db/schema/
  overall/submit, poll, cancel            news.ts (신규)
  overall/dependencyResolver              earningsCalendar.ts (신규)
  chat/buildPrompt (확장)                 earningsReports.ts (신규)
  usage (변경 없음)
                                         infrastructure/cron/
infrastructure/                            earningsCalendarSync.ts
  cache/keys (확장)                     infrastructure/ai/
  jobs/queue (확장)                       gemini.ts (모델 분기 확장)
  fmp/types (Provider 인터페이스)
  skills/loader (확장)                  app/[symbol]/
                                          fundamental/page.tsx + Client
domain/tier (필요시 매핑 추가)            news/page.tsx + Client
                                          overall/page.tsx + Client

                                       components/symbol-page/
                                         tabs (4개 탭, cross-link)
                                       components/fundamental/, news/, overall/
                                       components/chat/ (컨텍스트 전환 UI)

                                       skills/fundamental/*.md (신규 카테고리)
                                       skills/news/*.md (신규 카테고리)
```

### 의존 방향 (위반 없음)

```
siglens app → siglens-core public API
siglens infrastructure/fmp → MarketDataProvider 패턴 (core 인터페이스 구현)
siglens infrastructure/db → DrizzleNewsRepository, DrizzleEarningsCalendarRepository 등
siglens-core domain/ → 외부 import 0
siglens-core application/ → infrastructure interface만 의존
```

`SCOPE.md` 안티 패턴 위반 없음. 분석 secret sauce(프롬프트, 정규화, 캐시 키, Job 라이프사이클)는 모두 core. FMP fetch 코드와 DB Drizzle 구현은 모두 siglens.

---

## 1. Page Specs

### 1.1 `/[symbol]` (기존 차트 페이지) — 뉴스 보강 추가 (A2 + A3)

기존 차트 + 보조지표 + 캔들/패턴 + AI 종합 분석은 그대로 유지. 추가로:

- **최근 뉴스 5건** (헤드라인 + 출처 + 날짜)
- 각 카드에 **sentiment 뱃지** + **KO 한줄 요약** — News use-case의 카드별 분석 결과(`news_id` 영구 캐시) 그대로 재사용
- **"뉴스 자료 종합" 1단락** — News use-case 종합 분석 결과의 첫 단락("현재 가격 흐름의 뉴스 원인")을 그대로 인용. **별도 LLM 호출 없음.** A 보강을 위한 별도 캐시 키도 없음 — News 분석 캐시 공유.
- 차트 페이지 진입 시 News 분석 캐시 룩업 → miss면 백그라운드 자동 트리거 (News 페이지와 동일 캐시이므로 사용자가 News 페이지로 이동해도 즉시 표시)
- 카드 클릭 → News 페이지 해당 항목으로 이동
- 배치는 구현 단계에서 (`frontend-design`) 결정

### 1.2 `/[symbol]/fundamental`

#### 데이터 로딩 패턴

**RSC + 점진 로딩**. 페이지 진입 시 16개 엔드포인트를 한꺼번에 `Promise.all`하지 않고, **섹션별로 React Server Components의 `<Suspense>` 경계**를 두어 빠른 섹션부터 streaming. 각 섹션 fetch는 Next.js fetch cache(`unstable_cache` + `revalidate`)로 자동 메모이즈되어 동일 종목 재진입 시 즉시.

#### 콘텐츠 (Standard 깊이)

| 섹션 | 데이터 |
|---|---|
| 회사 프로필 | `profile` (이름, 섹터, 산업, 시총, CEO, 본사, 웹사이트, 한 줄 설명) |
| 밸류에이션 | `key-metrics-ttm` + `ratios-ttm` (PER, PSR, PBR, PEG, EV/EBITDA, EPS) + 섹터 평균 비교 |
| 동종업계 비교 | `stock-peers` (5–10개 표) |
| 수익성 | `ratios-ttm` (ROE, ROA, 영업이익률, 순이익률) |
| 성장성 | `income-statement-growth` (매출/EPS YoY) |
| 재무건전성 | `balance-sheet-statement`, `cash-flow-statement` (부채비율, 유동비율, 현금흐름) + `financial-scores` (Altman Z, Piotroski) |
| 미래 방향 | `analyst-estimates` + `grades-consensus` + `price-target-consensus` + `price-target-summary` + 다음 어닝 일정(DB의 earnings-calendar 종목 필터) |
| 섹터 방향 | `sector-performance-snapshot` (오늘) + `historical-sector-performance` (해당 섹터 시계열) |
| AI 분석 | 카테고리별 평가(밸류/수익성/성장/건전성/방향성) + 종합 결론 + 위험 요인 |

### 1.3 `/[symbol]/news`

#### 콘텐츠 (Standard 깊이)

| 섹션 | 데이터 |
|---|---|
| 뉴스 리스트 | `news/stock?symbols={SYMBOL}` (시간 필터 24h/7d/30d, 카테고리 자동 분류) |
| 개별 뉴스 분석 | gemini-2.5-flash-lite 1회 호출 결과: KO 헤드라인 번역 + KO 본문 번역 + KO 요약 + sentiment 뱃지(호재/악재/중립) |
| 종합 AI 분석 | 현재 가격 흐름의 뉴스 원인 + 핵심 이벤트 3–5개 + 향후 주의 이벤트 |
| 이벤트 캘린더 | DB의 earnings-calendar 종목 필터(다음 일정) + `earnings`(최근 결과) |
| 애널리스트 액션 | `grades` (등급 변경 이벤트 — Press Release 빈자리 채움) |

#### 트리거

- 페이지 진입 시 자동 분석 (캐시 hit 즉시 표시)
- 뉴스 1건당 LLM 1회만 호출 후 영구 캐시 (`news_id` 키)

### 1.4 `/[symbol]/overall`

#### 7개 섹션

1. 종목 한 줄 정의 + 현재 상태 종합 1단락
2. 기술적 분석 요약 3–5 bullets (선행 분석 결과 재사용)
3. 펀더 요약 3–5 bullets (선행 분석 결과 재사용)
4. 뉴스/이벤트 요약 3–5 bullets (선행 분석 결과 재사용)
5. **3축 종합 결론** ("기술적으로는 X지만 펀더가 Y라서 …") — C의 핵심
6. 시나리오 분석 (낙관/중립/비관 각 시나리오의 트리거 조건 + 가격대)
7. 위험 요인 / 주의 이벤트

#### 트리거 / 의존성 자동 처리

- 명시 트리거 ("AI 종합 분석 받기" CTA). 캐시 hit이면 즉시 표시.
- 트리거 시 의존성 체크:
  - 캐시 hit인 분석은 즉시 사용
  - 캐시 miss인 분석만 자동 백그라운드 트리거 (Job 큐)
  - **단계별 진행 UI**: `기술 분석 (1/3) → 펀더 (2/3) → 뉴스 (3/3) → 종합` + 예상 시간
- 인풋 타임프레임: **활성 타임프레임 사용** (5분봉이면 단타 컨텍스트, 일봉이면 장기 컨텍스트). 타임프레임 맥락은 기존 [symbol] 분석 프롬프트 빌더에서 사용 중인 패턴 재사용.
- 부수 효과: Overall 트리거 시 다른 페이지 캐시 자동 적재 → 사용자가 탭 이동해도 즉시 표시

---

## 2. Page Navigation

### 2.1 헤더 세그먼트 탭

```
┌────────────────────────────────────────────────────┐
│  AAPL  Apple Inc.                                  │
│  [차트] [뉴스] [펀더] [종합]                       │
└────────────────────────────────────────────────────┘
```

- 탭 순서: 차트 → 뉴스 → 펀더 → 종합 (사용자 빈도 인사이트 반영)
- ARIA: `tablist / tab / tabpanel`, 키보드 ←→/Home/End — 구현 단계에서 `web-design-guidelines` 호출 시 검증
- 모바일: sticky 세그먼트 컨트롤 (가로 스크롤보다 발견성 우선)

### 2.2 Cross-link 카드

각 페이지 본문 끝에 다른 분석으로 가는 카드 노출 (예: 펀더 페이지 끝에 "→ 이 종목 최근 뉴스 보기 / → AI 종합 분석 받기"). 카드는 internal link로 SEO page-rank 분산 효과.

### 2.3 URL & SEO

- path 분리 (`/AAPL`, `/AAPL/fundamental`, `/AAPL/news`, `/AAPL/overall`)
- 타임프레임 등 보조 상태는 `?tf=5m` 쿼리. canonical은 쿼리 제거된 형태
- 페이지별 `<title>`, `description`, OG image 차별화 (구현 단계)
- breadcrumb JSON-LD 4개 페이지 모두 확장 (현재 `buildBreadcrumbJsonLd` 재사용)
- sitemap에 4개 path 모두 등록

---

## 3. Data Infrastructure

### 3.1 FMP 엔드포인트 (모두 `/stable`)

| 용도 | 엔드포인트 | 사용 페이지 |
|---|---|---|
| 종목 뉴스 | `news/stock?symbols={SYMBOL}` | News, A 보강 |
| 어닝 캘린더 (전체) | `earnings-calendar` | Cron 적재 → Fundamental, News |
| 어닝 보고서 | `earnings?symbol={SYMBOL}` | Fundamental, News |
| 회사 프로필 | `profile?symbol={SYMBOL}` | Fundamental |
| 밸류 / 비율 (TTM) | `key-metrics-ttm`, `ratios-ttm` | Fundamental |
| 재무제표 | `income-statement`, `balance-sheet-statement`, `cash-flow-statement` | Fundamental |
| 성장률 | `income-statement-growth` | Fundamental |
| 재무 점수 | `financial-scores` | Fundamental |
| 동종업계 | `stock-peers` | Fundamental |
| 애널리스트 추정치 | `analyst-estimates` | Fundamental |
| 등급 (이벤트) | `grades` | News (애널리스트 액션) |
| 등급 컨센서스 | `grades-consensus` | Fundamental |
| 목표주가 | `price-target-consensus`, `price-target-summary` | Fundamental |
| 섹터 퍼포먼스 (스냅샷) | `sector-performance-snapshot?date=` (date 1년 제한) | Fundamental |
| 섹터 시계열 | `historical-sector-performance?sector=` | Fundamental |

**제외**:
- ✗ Press Release (Starter 등급 제한)
- ✗ Earnings Surprise (제공 안 함)
- ✗ Historical Sentiment (제공 안 함)
- ✗ FMP 자체 sentiment (Starter에 미제공 + 우리 도메인 톤과 불일치 → 자체 LLM 판정)

### 3.2 캐싱 Tier

| Tier | TTL | 적용 |
|---|---|---|
| **T1** 실시간성 | 5–15분 | `news/stock` |
| **T2** 일 단위 | 6–24시간 | `sector-performance-snapshot`(오늘) 1h, `grades` 12h, `price-target-consensus` 24h, `historical-sector-performance` 24h |
| **T3** 분기/이벤트 단위 | 동적 TTL `max(1h, min(7d, next_earnings_at − now − 1h))` | 재무제표 3종, `key-metrics-ttm`, `ratios-ttm`, `financial-scores`, `income-statement-growth`, `earnings`, `grades-consensus`, `price-target-summary` |
| **T4** 거의 정적 | 30일 | `profile`, `stock-peers`, `key-executives`(필요 시) |
| **별도 Cron** | 1일 1회 야간 | `earnings-calendar` 전체 fetch + DB upsert |
| **AI 분석 결과** | 입력 데이터 해시 키, 영구 | siglens-core Upstash Redis (기존 시스템 확장) |

T3 동적 TTL: earnings-calendar 룩업으로 다음 어닝 일정 조회 → 발표 직전 1시간 버퍼로 만료. 어닝 발표 직후 새 데이터 자연스럽게 반영.

### 3.3 저장소 매핑

| 저장소 | 보관 데이터 |
|---|---|
| **DB (siglens Drizzle)** | `news` 테이블, `earnings_calendar` 테이블, `earnings_reports` 테이블 — 다른 화면 재활용 가능 |
| **Next.js fetch cache** (`unstable_cache` + `revalidate`) | 종목별 펀더 데이터 — 재무제표, 밸류에이션, 점수, peers, grades, price-target, sector |
| **siglens-core Upstash Redis** | AI 분석 결과 (Fundamental, News, Overall, A 보강 종합) — 기존 분석 캐시 시스템 확장 |

**확장 포인트**: 향후 `financial-scores`, `grades-consensus` 같은 항목을 다른 화면(예: 비교 화면, 대시보드)에서 SQL로 재활용하고 싶어지면 DB로 이전 가능 (스키마 추가).

### 3.4 DB 스키마 (개략)

#### `news`

```
news (
  id              TEXT PK,           -- FMP 뉴스 식별자 또는 hash(url)
  symbol          TEXT NOT NULL,
  source          TEXT,
  url             TEXT UNIQUE,
  published_at    TIMESTAMPTZ,
  title_en        TEXT,
  title_ko        TEXT,
  body_en         TEXT,
  body_ko         TEXT,
  summary_ko      TEXT,
  sentiment       TEXT,              -- 'bullish' | 'bearish' | 'neutral'
  category        TEXT,              -- 'earnings' | 'm_and_a' | 'guidance' | 'regulation' | 'other'
  raw_payload     JSONB,
  fetched_at      TIMESTAMPTZ,
  analyzed_at     TIMESTAMPTZ        -- LLM 분석 완료 시각
)

INDEX (symbol, published_at DESC)
INDEX (sentiment, published_at DESC)
```

#### `earnings_calendar`

FMP `/stable/earnings-calendar` 응답 필드: `symbol`, `date`, `epsActual`, `epsEstimated`, `revenueActual`, `revenueEstimated`, `lastUpdated`.

```
earnings_calendar (
  symbol             TEXT,
  earnings_date      DATE,
  eps_actual         NUMERIC,         -- nullable (미발표 시)
  eps_estimated      NUMERIC,
  revenue_actual     NUMERIC,         -- nullable (미발표 시)
  revenue_estimated  NUMERIC,
  last_updated       DATE,            -- FMP lastUpdated
  raw_payload        JSONB,
  fetched_at         TIMESTAMPTZ,
  PRIMARY KEY (symbol, earnings_date)
)

INDEX (earnings_date)
INDEX (symbol, earnings_date DESC)
```

같은 날짜 재공시되는 경우 `last_updated`와 `*_actual` 필드만 갱신 (Cron upsert).

#### `earnings_reports`

FMP `/stable/earnings?symbol=AAPL` 응답 기반. **세부 컬럼은 구현 단계에서 응답 보고 확정** — `(symbol, earnings_date)` 또는 `(symbol, fiscal_period)` PK 후보 중 응답 식별자에 맞춰 결정.

```
earnings_reports (
  symbol            TEXT,
  -- PK 보조 컬럼은 구현 단계에서 확정
  raw_payload       JSONB,
  fetched_at        TIMESTAMPTZ
)
```

### 3.5 Cron — earnings-calendar Sync

- 1일 1회 야간 (UTC 06:00 정도, 미장 마감 후)
- 인프라: Vercel Cron Jobs (siglens 프로젝트, 분석 secret sauce 아님)
- Idempotent upsert (PK 충돌 시 fetched_at만 갱신)
- 실패 시 다음 사이클까지 stale (T3 fallback, 사용자 진입 시점에 정시 fetch 트리거 가능)

---

## 4. AI Analysis

### 4.1 새 use-case 3종 (siglens-core)

기존 `submitAnalysis / pollAnalysis / cancelAnalysisJob` 패턴을 그대로 복제:

```
submitFundamentalAnalysis(input) → jobId
pollFundamentalAnalysis(jobId)    → result | running | failed
cancelFundamentalAnalysisJob(jobId)

submitNewsAnalysis(input)         → jobId
pollNewsAnalysis(jobId)           → result | running | failed
cancelNewsAnalysisJob(jobId)

submitOverallAnalysis(input)      → jobId  (의존성 자동 트리거 포함)
pollOverallAnalysis(jobId)        → result | running | failed | running_dependencies
cancelOverallAnalysisJob(jobId)
```

각각 siglens 측 Server Action(`submitFundamentalAnalysisAction` 등)이 호출.

### 4.2 프롬프트 빌더 (siglens-core `domain/analysis/prompt.ts` 또는 신규 파일)

- `buildFundamentalAnalysisPrompt(symbol, fundamentalData, skills)` — Skills 카탈로그(`skills/fundamental/*.md`) 적용
- `buildNewsAnalysisPrompt(symbol, news, eventCalendar, skills)` — Skills 카탈로그(`skills/news/*.md`) 적용
- `buildOverallAnalysisPrompt(symbol, technical, fundamental, news, timeframe)` — 3축 통합. 타임프레임 맥락 포함

응답 정규화 함수(`normalizeXxxResponse`) 동반. AI 응답 검증 룰은 기존 패턴 재사용.

### 4.3 모델 옵션

- 사용자 노출 옵션 = 기존 [symbol] 분석에서 노출 중인 옵션과 **완전 동일** (현재 노출 중인 `TierModel` 부분집합 그대로)
- **gemini-2.5-flash-lite는 사용자 노출 X**, 번역 + sentiment 내부 전용
- 모델 선호 저장: 사용자 전역 (비회원 = localStorage 키 `siglens.preferredModel`, 회원 = user 설정 DB) — 4개 분석 페이지 모두 동일 키 참조

기존 Gemini 어댑터(`infrastructure/ai/gemini.ts`)는 **모델 파라미터화** 또는 별도 어댑터 추가로 확장. 분석용 모델과 번역/sentiment 전용 flash-lite를 분리 호출 가능하게.

### 4.4 트리거 정책

| 분석 | 트리거 |
|---|---|
| 차트 (기존) | 기존 정책 유지 |
| Fundamental 종합 분석 | 페이지 진입 시 자동 (캐시 hit 즉시). 사용자 노출 모델 사용 |
| News 카드별 분석 (gemini-2.5-flash-lite) | 신규 뉴스 적재 시 자동, `news_id` 영구 캐시. 번역 + KO 요약 + sentiment 묶음 1회 호출 |
| News 종합 분석 | News 페이지 진입 시 자동 (캐시 hit 즉시). 사용자 노출 모델 사용. 캐시 키 = (symbol, news_id_set_hash, model) |
| A 차트 페이지 뉴스 보강 | 차트 페이지 진입 시 News 종합 분석 캐시 룩업 → miss면 자동 백그라운드 트리거. **News 페이지와 동일 캐시 공유. 별도 호출 없음.** |
| Overall | 명시 CTA. 캐시 hit 즉시. miss인 선행 분석은 자동 트리거 |

### 4.5 타임아웃

- **모든 모델 공통 30분 안전망**. stuck job(워커 크래시, 외부 provider 무응답)만 방지.
- 사용자 명시 취소 가능 (기존 `cancelAnalysisJobAction` 패턴 그대로)
- 정상 추론은 가장 무거운 모델(opus, gpt-5.5)도 30분 안에 완료
- 타임아웃 발생 시 사용자 안내: "분석이 30분을 초과하여 자동 중단되었습니다. 다른 모델로 재시도해주세요."

### 4.6 의존성 체크 (Overall)

`submitOverallAnalysis` 내부:

1. 인풋 데이터 해시로 각 선행 분석(기술/펀더/뉴스) 캐시 키 계산
2. 캐시 룩업 → hit/miss 분류
3. miss 선행 분석만 Job 큐에 enqueue
4. Overall job 자체는 모든 선행 완료 대기 (job 의존 그래프)
5. siglens 측은 `pollOverallAnalysis`로 단계별 상태 수신 → 진행 UI 갱신

---

## 5. Chat Integration

### 5.1 컨텍스트 전환

- **활성 컨텍스트는 현재 페이지 1개만**. 페이지 이동 시 컨텍스트 교체.
- 페이지 이동 감지 → 챗봇 대화창에 **시스템 메시지 추가**: 예) "📊 펀더 분석 페이지로 전환되었습니다. 이전 페이지 컨텍스트는 더 이상 적용되지 않습니다."
- 대화 히스토리는 페이지 무관 영구 유지
- 이전 페이지 분석에 대한 질문이 들어오면 챗봇은 "현재 펀더 컨텍스트입니다. 차트 분석을 다시 보려면 차트 페이지로 이동해주세요"로 안내

### 5.2 구현

- siglens-core: 기존 `buildChatPrompt`(또는 동등 함수)에 `currentAnalysisContext` 파라미터 추가
- siglens: 챗봇 hook이 **`usePathname` (Next.js App Router)** 또는 동등한 URL 변경 감지로 페이지 라우트 변경을 구독 → 시스템 메시지 enqueue + 컨텍스트 갱신
- 컨텍스트 데이터 구조는 분석 종류별 분석 결과 타입 union (예: `{ kind: 'technical', payload: AnalysisResponse } | { kind: 'fundamental', payload: FundamentalAnalysisResponse } | …`)

---

## 6. Skills System Extension

기존 `skills/patterns/`, `skills/strategies/` 옆에 새 카테고리:

```
skills/
├── patterns/              (기존)
├── strategies/            (기존)
├── indicators/            (기존)
├── fundamental/           (신규)
│   ├── value-investing.md
│   ├── growth-investing.md
│   └── …
└── news/                  (신규)
    ├── event-driven.md
    ├── macro-impact.md
    └── …
```

- siglens-core `infrastructure/skills/loader.ts` 확장: 새 카테고리도 스캔
- `Skill` 타입에 `category` 필드 이미 있음 — 새 값(`'fundamental'`, `'news'`) 추가
- 각 분석 프롬프트 빌더가 자기 카테고리의 Skills만 필터링해 적용
- `confidence_weight < 0.5`는 기존 룰 그대로 제외

---

## 7. Tier / Usage Mapping

| 항목 | 매핑 |
|---|---|
| `TierLimitedFeature` | 새 분석 4종 모두 `analysisPerDay` 통합. 새 키 추가 없음 |
| `TierModel` | 변경 없음 (기존 11종 그대로) |
| `TierInfoDepth` | siglens-core에 새 분석 4종 InfoDepth 매핑 정의. siglens는 미 enforce (기존 패턴) |
| `TierConfig.models` | 변경 없음 |
| BYOK | 새 use-case에서도 기존 BYOK 분기 코드 동일 적용. 본인 키 사용 시 카운트 우회 |

Phase 4(`enableTierRestrictions = true`)에서 master switch 켤 때 자동 적용.

---

## 8. Error / Fallback

| 시나리오 | 정책 |
|---|---|
| FMP API 다운 | 페이지 안내 메시지 + 마지막 캐시 표시 (stale-while-error). 캐시도 없으면 빈 상태 + 재시도 CTA |
| AI provider 다운 | "AI 분석 일시 사용 불가" 메시지 + "잠시 후 다시 시도" CTA |
| Earnings-calendar Cron 실패 / 빈 DB | 사용자 진입 시점에 정시 fetch 트리거 (T3 fallback). fetch도 실패하면 "어닝 일정 사용 불가" 표시 |
| AI 분석 30분 timeout | Job fail. 사용자 안내 + 재분석 CTA |
| Skills 파일 파싱 실패 | 해당 Skill만 제외하고 진행 (기존 룰) |
| FMP rate limit | 클라이언트 retry-after 존중. 캐시로 흡수가 1차 방어선 |

---

## 9. SEO & Accessibility (구현 단계 위임)

이 spec은 큰 골격만 다룸. 다음 항목은 **구현 단계에서 다음 스킬 호출 의무**:

- UI 컴포넌트 작성 시: `frontend-design`
- 작성된 UI 리뷰: `web-design-guidelines`
- 페이지 메타·구조화 데이터·sitemap·robots: `seo-audit`

세부 위임 항목:

- 페이지별 `<title>` / `description` / `keywords` / OG image
- breadcrumb JSON-LD 4개 페이지 확장
- ARIA `tablist / tab / tabpanel` 키보드 탐색
- 모바일 sticky 세그먼트 컨트롤
- WCAG 색 대비 / focus indicator
- internal link 구조 (cross-link 카드 + 본문 내 자연 링크)

---

## 10. Cross-repo Work Split

| 리포 | 작업 |
|---|---|
| **siglens-core** | (1) 새 use-case 3종 × {submit, poll, cancel} = 9개 함수 + Job 큐 라이프사이클. (2) 프롬프트 빌더 3종 + 응답 정규화 3종. (3) Overall 의존성 체크 use-case. (4) 캐시 키 정책 확장. (5) Skills loader가 새 카테고리(`fundamental`, `news`) 스캔하도록 확장. (6) TierInfoDepth 매핑 정의. (7) **신규 Provider 인터페이스 2종**: `FundamentalDataProvider` (재무·밸류·peers·grades·price-target·sector 등 16종 메서드), `NewsProvider` (news + earnings-calendar + earnings 메서드). 기존 `MarketDataProvider`는 시세(bars) 위주로 좁게 유지. (8) 챗봇 프롬프트 빌더에 `currentAnalysisContext` 파라미터 추가. |
| **siglens** | (1) FMP 어댑터 — 표 3.1의 모든 엔드포인트. (2) Drizzle 스키마 3개 + 마이그레이션. (3) Cron earnings-calendar sync (Vercel Cron). (4) 페이지 라우트 3개 + 클라이언트 컴포넌트. (5) 헤더 탭 + cross-link 카드 + 차트 페이지 뉴스 보강 섹션. (6) Server Action 9개 (submit/poll/cancel × 3). (7) Gemini 어댑터 모델 분기 확장. (8) 모델 선호 저장 (localStorage + user 설정). (9) 챗봇 컨텍스트 전환 UI(시스템 메시지). (10) SEO 메타·breadcrumb·sitemap 확장. (11) `skills/fundamental/`, `skills/news/` 카탈로그 .md 파일 작성. |

PR 순서 (단일 릴리스이지만 작업 순서):

1. siglens-core PR — 새 use-case 9개 + 프롬프트 빌더 + 정규화 + Job 큐 + Skills loader 확장 + 챗봇 빌더 확장
2. siglens-core publish (npm)
3. siglens PR — FMP 어댑터, DB 스키마/마이그레이션, Cron, 페이지, 컴포넌트, Server Action, 모델 UI, 챗봇 UI, SEO. siglens-core 새 버전 import.
4. Skills `.md` 파일은 siglens 측 `skills/`에 추가 (loader가 스캔)

---

## 11. Out of Scope / Future

- 매수/매도 추천 / 진입 가이드 (정책 위반)
- 정보 깊이 enforce (Phase 4)
- 결제 / 티어 UX (Phase 4)
- News deep 옵션 (sentiment 시계열 차트, 가격 vs 뉴스 매칭 타임라인, SEC filings)
- Fundamental deep 옵션 (5년 historical 차트, peer 10+ 종합 비교, 어닝콜 트랜스크립트)
- 챗봇이 N개 페이지 컨텍스트 누적 옵션 (현재는 1개만)
- 분석 결과 공유 기능 (TODO.md #367)

---

## 12. Open Questions / Assumptions

### 가정

- siglens-core의 기존 분석 캐시 키 패턴(symbol + analysis_type + input_hash + model)을 새 분석 3종이 그대로 따른다. 키 충돌 없음.
- Gemini 어댑터의 모델 파라미터 확장이 BYOK 흐름과 호환된다 (BYOK 사용자도 모델 선택 가능).
- earnings-calendar 전체 데이터 크기가 1일 1회 적재에 부담되지 않는다 (대략 수천 건 수준).
- Vercel Cron Jobs가 siglens 인프라에서 사용 가능하다 (Pro plan 이상).

### Resolved (Open Question 답변 — 2026-05-02)

- ~~FMP 어닝 캘린더 응답에 `fiscal_period` 필드~~ → **없음**. 응답 필드: `symbol`, `date`, `epsActual`, `epsEstimated`, `revenueActual`, `revenueEstimated`, `lastUpdated`. PK = `(symbol, date)`. §3.4 스키마 반영 완료.
- ~~Fundamental 첫 SSR 16개 엔드포인트 부담~~ → **RSC 점진 로딩**. 섹션별 `<Suspense>` 경계로 streaming. §1.2에 명시 완료.
- ~~현재 [symbol] 분석 모델 옵션 정확한 목록~~ → **siglens-core 코드에서 확인** (구현 단계 첫 작업).
- ~~챗봇이 현재 페이지 감지 방법~~ → **`usePathname` (Next.js App Router) URL 변경 감지**. §5.2 명시 완료.

### Open Questions (구현 단계에서 확인)

- FMP `/stable/earnings?symbol=AAPL` 응답 필드 — `earnings_reports` 테이블 PK 보조 컬럼 결정 (`earnings_date` 또는 `fiscal_period`)
- siglens-core 분석 캐시 키 패턴 정확 형태 — 새 분석 3종이 충돌 없이 합류하는지 검증

---

## Revision History

| Date | Change |
|---|---|
| 2026-05-02 | 최초 작성 — brainstorming 결정 종합 |
| 2026-05-02 | self-review fix — A 보강 캐시 공유 명확화, News 카드/종합 분석 모델 구분, Provider 인터페이스 신설 확정 |
| 2026-05-02 | Open Questions 4건 답변 반영 — earnings_calendar 스키마 정정, RSC 점진 로딩, `usePathname` 챗봇 감지 |
