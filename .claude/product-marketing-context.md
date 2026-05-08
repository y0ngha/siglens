# Product Marketing Context

## Product Overview

**Product Name:** Siglens
**Version:** 0.8.x (post PR #428 — siglens-core 0.8.0, fear-greed)
**Website:** https://siglens.io
**Tagline:** AI가 분석하는 미국 주식 — 기술적 분석, 펀더멘털, 뉴스, 공포 탐욕 지수, 종합 결론까지 한 번에

Siglens는 미국 주식 분석의 전 워크플로우를 AI로 자동화합니다. 사용자는 티커를 입력하기만 하면 ① 차트 기반 기술적 분석, ② PER, ROE, 재무건전성 등 펀더멘털 분석, ③ 뉴스 호재/악재 분위기, 어닝 및 실적 캘린더, 애널리스트 등급 변경 분석, ④ 종목별 단기 매수 분위기를 0~100 점수로 보여주는 공포 탐욕 지수, ⑤ 이 넷을 통합한 AI 종합 결론과 시나리오 분석까지 한 화면에서 받습니다.

## Problem Statement

미국 주식 분석은 정보의 출처가 흩어져 있고 해석 난도가 높습니다. 투자자는 차트와 보조지표(RSI·MACD·볼린저밴드 등), 재무제표와 밸류에이션 멀티플(PER·PSR·ROE), 매일 쏟아지는 뉴스와 어닝 일정·애널리스트 리포트를 따로 보고 머릿속에서 통합 해석해야 합니다. 진입 장벽이 높고 시간이 많이 듭니다.

## Core Value Proposition

- **AI 5축 분석 자동화** — 티커만 입력하면 기술적, 펀더멘털, 뉴스, 공포 탐욕 지수, 종합 5개 분석을 모두 받습니다
- **통합 결론(/[symbol]/overall)** — 3축(기술, 펀더, 뉴스) 결과에 단기 매수 분위기(공포 탐욕 지수)까지 묶어 시나리오 분석과 위험 요인을 도출
- **컨텍스트 인식 AI 챗봇** — 차트·뉴스·펀더 어떤 페이지에 있어도 현재 페이지 데이터를 컨텍스트로 답변
- **시장 전체 신호 스캐너(/market)** — 11개 섹터에서 골든크로스·RSI 다이버전스·볼린저 스퀴즈 종목을 한눈에
- **회원가입은 옵션** — 비회원도 모든 기본 기능 사용. 회원이 되면 분석 한도·BYOK 등 추가 혜택
- **Skills 시스템** — 신규 분석 기법은 마크다운 파일만 추가하면 끝. 코드 변경 불필요
- **AI 백테스팅 결과 공개(/backtesting)** — Magnificent 7 등 10개 종목 2년치 실제 분석·예측 정확도 데이터 공개

## Target Audience

- **Primary language:** Korean (ko_KR)
- **Geographic focus:** 미국 주식 시장에 관심 있는 한국 투자자

1. **기술적 분석에 관심 있지만** 보조지표·차트 패턴을 일일이 해석하기 지친 투자자
2. **펀더멘털 분석을 원하지만** PER·ROE·재무제표를 직접 읽기 어려운 투자자
3. **뉴스/이벤트 기반 트레이딩**을 하지만 영어 기사·sentiment 해석에 시간을 쓰고 싶지 않은 투자자
4. **여러 분석을 통합 해석**한 결론을 원하는 투자자
5. **섹터 전체 신호 스캔**으로 빠르게 진입 후보를 좁히고 싶은 액티브 트레이더
6. **차트 분석 입문 단계**의 초보 투자자

## Key Features

### 분석 페이지 (5축 구조)
- **기술적 분석 (`/[symbol]`)** — 25종 보조지표 + 캔들 패턴 45종 + 차트 패턴 + AI 종합 리포트 + 보조 뉴스 카드 (NewsAugment)
- **뉴스 분석 (`/[symbol]/news`)** — 최신 뉴스 리스트(호재/악재 분위기 뱃지 + 한국어 요약), 종합 AI 뉴스 분석, 이벤트 캘린더(다음 어닝과 실적, 최근 보고서), 애널리스트 액션. 페이지 진입 시 FMP에서 뉴스 fetch + Gemini Flash-lite로 카드별 자동 분석
- **펀더멘털 분석 (`/[symbol]/fundamental`)** — 회사 프로필, 밸류에이션(PER, PSR, EPS), 동종업계, 수익성(ROE, 마진), 성장성, 재무건전성, 미래 방향(애널리스트 컨센서스, 목표가), 섹터 방향 + AI 종합 펀더멘털 분석
- **공포 탐욕 지수 (`/[symbol]/fear-greed`)** — 종목별 단기 매수 분위기를 0~100 점수와 5단계 라벨(극공포부터 극탐욕까지)로 표시. 거래량 흐름과 가격 위치를 묶어 종목 자체 분포 안에서 환산. Flow와 Trend 그룹별 breakdown + 1년 시계열 차트.
- **AI 종합 분석 (`/[symbol]/overall`)** — 명시 트리거(CTA 버튼) + 3축(기술, 펀더, 뉴스) 의존성 진행 UI + fear-greed 지수까지 inject한 4축 통합 결론, 시나리오 분석, 위험 요인

### 데이터 & 인디케이터
- **Chart Rendering:** Lightweight Charts v5 — 캔들·볼륨·지표 오버레이
- **25 Indicators:** RSI, MACD, Bollinger Bands, ADX, DMI, Stochastic, StochRSI, CCI, VWAP, MA, EMA, Volume Profile, Ichimoku Cloud, ATR, Donchian Channel, Keltner Channel, SuperTrend, OBV, CMF, MFI, Buy/Sell Volume, Parabolic SAR, Williams %R, Squeeze Momentum, Smart Money Concepts
- **Candle Patterns:** 단일 15종 + 복합 30종 (도메인 알고리즘 자동 감지)
- **Chart Patterns (Skills):** Head & Shoulders, Inverse H&S, Double/Triple Top·Bottom, Triangle 3종, Wedge 2종, Bull/Bear Flag, Pennant, Cup & Handle, Rectangle, Rounding Bottom
- **Multi-Timeframe:** 1Min, 5Min, 15Min, 1Hour, 1Day

### 시장 대시보드
- **Market Dashboard (`/market`)** — 11개 섹터 신호 스캐너. 200+ 인기 티커에서 골든크로스·RSI 다이버전스·볼린저 스퀴즈 신호 검색. 섹터·타임프레임 쿼리 파라미터 지원

### AI & 챗봇
- **이중 AI 엔진** — 분석 리포트는 Claude, 챗봇·뉴스 카드 분석은 Gemini 2.5 Flash / Flash-lite
- **컨텍스트 인식 챗봇** — `usePathname` 감지로 차트→뉴스→펀더 페이지 이동 시 시스템 메시지 자동 추가, 대화 히스토리 보존, 현재 페이지 컨텍스트만 LLM 프롬프트에 주입
- **BYOK (Bring Your Own Key)** — 회원이 본인 API Key를 등록하면 사용량 한도 우회

### 백테스팅 (`/backtesting`)
- 2024~2026 2년간 10개 종목(AAPL·NVDA·TSLA 등 Magnificent 7 + 추가) 실제 분석 케이스
- RSI·MACD·SuperTrend 신호 승률, AI 예측 정확도 데이터 공개
- Schema.org Dataset JSON-LD 적용

### Skills System (Extended)
- **6개 카테고리 / 67+ Skills** — `indicators/`(25), `patterns/`(차트 패턴), `strategies/`(엘리어트·다이버전스 등), `support-resistance/`(피보나치·피벗), `candlesticks/`(도지·해머 등), `fundamental/`(value/growth/quality investing), `news/`(event-driven/macro-impact/earnings-reaction)

### 인증 & 회원
- **회원가입은 옵션 (`/signup`, `/login`)** — 비회원도 모든 기본 기능 사용 가능. 가입 시 tier 기반 추가 혜택
- **소셜 로그인** — Google, Kakao OAuth
- **계정 관리** — `/account`, `/account/delete` (회원 탈퇴 즉시 파기)
- **로그인/회원가입 페이지는 robots noindex** — SEO 인덱스 대상 아님

### 인프라 & 자동화
- **Vercel Cron** — `earnings-calendar-sync` 매일 06:00 UTC, 200+ 티커 어닝 캘린더 DB upsert
- **Drizzle ORM + Postgres** — `news`, `earnings_calendar`, `earnings_reports` 테이블
- **FMP `/stable` API** — 뉴스, 어닝, 재무제표, 애널리스트 등급, 섹터 데이터
- **Alpaca Markets** — 시장 데이터(15분 지연 IEX)

### 부가
- **Korean Name Support** — 주요 티커 한국어 회사명 자동 표시
- **200+ Tickers in Sitemap** — 메가캡, AI/반도체, SaaS, 핀테크/크립토, EV, 레버리지 ETF, 금융, 소비재, 에너지, 헬스케어, 중국 ADR, 트렌딩 종목

## What Siglens Does NOT Provide

- 주문/거래 체결 없음
- 실시간 데이터 없음 (15분 지연 — Alpaca IEX)
- 투자 자문/매매 권유 없음

## Tech Stack

- Next.js 16.2.0 (App Router + Turbopack + React Compiler + PPR)
- React 19.2.4, TypeScript 5, Tailwind CSS 4
- Lightweight Charts 5.1
- Alpaca Markets API (시장 데이터)
- FMP `/stable` API (티커·재무·뉴스·어닝)
- Anthropic Claude (분석 리포트)
- Google Gemini 2.5 Flash / Flash-lite (챗봇·뉴스 카드 sentiment)
- Drizzle ORM + Postgres (news / earnings)
- Upstash Redis (asset info 캐시)
- Vercel (배포 + Edge Functions + Cron)
- TanStack Query v5 (클라이언트 데이터 페칭)
- @y0ngha/siglens-core 0.8.0 (외부화된 도메인 분석 로직, fear-greed 5-factor)

## Site Architecture (SEO-relevant)

```
/                            → Homepage (RSC, WebApplication + Organization + WebSite + FAQPage + HowTo JSON-LD)
/market                      → Market Dashboard (priority 0.9, daily)
/backtesting                 → Backtesting Results (priority 0.9, monthly, Dataset JSON-LD)
/[symbol]                    → 기술적 분석 (priority 0.8, daily, WebPage + Breadcrumb + FAQPage)
/[symbol]/news               → 뉴스 분석 (priority 0.78, hourly, Breadcrumb + Article + ItemList)
/[symbol]/fundamental        → 펀더멘털 분석 (priority 0.75, weekly, Breadcrumb + FAQPage)
/[symbol]/fear-greed         → 공포 탐욕 지수 (priority 0.78, daily, WebPage + Breadcrumb + FAQPage)
/[symbol]/overall            → AI 종합 분석 (priority 0.85, weekly, Breadcrumb + FAQPage)
/login                       → 로그인 (noindex,nofollow)
/signup                      → 회원가입 (noindex,nofollow)
/forgot-password             → 비밀번호 재설정 요청 (noindex)
/reset-password              → 비밀번호 재설정 (noindex)
/account, /account/delete    → 회원 전용 (noindex)
/privacy                     → 개인정보처리방침 (yearly, noindex,follow + Breadcrumb)
/terms                       → 이용약관 (yearly, noindex,follow + Breadcrumb)
/robots.txt                  → robots.ts
/sitemap.xml                 → sitemap.ts
```

**Current metadata setup:**
- Root `lang="ko"`, OpenGraph `locale: ko_KR`
- 동적 metadata via `generateMetadata()` — symbol 4종, market, backtesting
- Canonical URL — 모든 인덱싱 페이지에 적용
- JSON-LD: WebApplication / Organization / WebSite (홈) + WebPage / FinancialProduct / Dataset / BreadcrumbList / FAQPage / HowTo
- Sitemap: 홈(1.0) + market과 backtesting(0.9) + 200+ 티커 × 5축(0.75~0.85) + privacy/terms(0.3)
- Robots: 인덱싱 허용, `/api/` disallow, 인증/계정 페이지는 noindex

## Competitive Differentiation

- **AI 4축 통합 분석** — TradingView·Thinkorswim 등 차트 도구는 기술 분석만, Seeking Alpha는 펀더 중심. Siglens는 기술+펀더+뉴스+종합 결론을 한 번에 한국어로
- **컨텍스트 인식 AI 챗봇** — 분석 리포트 후 자연어 후속 질문, 페이지 이동에 따라 컨텍스트 자동 전환
- **시장 전체 신호 스캐너** — 무료 한국어 도구 중 섹터 단위 기술적 신호 스캐너는 사실상 부재
- **AI 백테스팅 투명성** — `/backtesting`에서 실제 예측 정확도를 데이터셋으로 공개 (Schema.org Dataset)
- **Skills 시스템** — 비개발자도 마크다운 파일로 분석 기법 기여 가능
- **Korean-first** — UI·분석 리포트·메타·뉴스 sentiment 모두 한국어
- **Free & open-core** — 회원가입 옵션, 기본 기능 무료, 오픈소스

## Brand Voice & Tone

- 언어: 한국어(주), 영어(기술 용어)
- 톤: 전문적, 친근, 교육적
- 모든 페이지에 면책 고지 — 분석 정보일 뿐 투자 자문 아님
- Dark theme (#0f172a) + Trust Blue (#3b82f6) primary

## SEO Keywords (Korean) — Primary

| Keyword | Search Intent | Priority |
|---------|--------------|----------|
| 미국 주식 AI 분석 | Service discovery | P0 |
| 미국 주식 기술적 분석 | Informational | P0 |
| 미국 주식 차트 분석 | Informational | P0 |
| 미국 주식 펀더멘털 분석 | Informational | P0 |
| 미국 주식 뉴스 분석 | Informational | P0 |
| 무료 주식 분석 | Service discovery | P0 |
| 미국 주식 섹터 분석 | Informational | P0 |
| AI 주식 백테스팅 | Service discovery | P0 |
| 주식 보조지표 분석 | Informational | P1 |
| 자동 차트 분석 | Service discovery | P1 |
| 주가 분석 | Informational | P1 |
| 미국 주식 시장 동향 | Informational | P1 |
| 골든크로스 종목 | Service discovery | P1 |
| 어닝 발표 일정 | Informational | P1 |
| 애널리스트 목표주가 | Informational | P1 |

## SEO Keywords (Korean) — Fundamental & News (NEW)

| Keyword | Mapped Page / Skill |
|---------|---------------------|
| {티커} 펀더멘털 분석 | `/[symbol]/fundamental` |
| {티커} PER / PSR / EPS / ROE | `/[symbol]/fundamental` |
| {티커} 재무 건전성 | `/[symbol]/fundamental` |
| {티커} 애널리스트 컨센서스 | `/[symbol]/fundamental` (FutureDirectionCard) |
| {티커} 목표 주가 | `/[symbol]/fundamental` |
| 가치 투자 / value investing | `skills/fundamental/value-investing.md` |
| 성장 투자 / growth investing | `skills/fundamental/growth-investing.md` |
| 퀄리티 투자 / quality investing | `skills/fundamental/quality-investing.md` |
| {티커} 뉴스 분석 | `/[symbol]/news` |
| 뉴스 sentiment 분석 | `/[symbol]/news` |
| {티커} 어닝 발표 | `/[symbol]/news` (EventCalendar) |
| {티커} 어닝 일정 | `/[symbol]/news` |
| 애널리스트 등급 변경 | `/[symbol]/news` (AnalystActions) |
| 이벤트 드리븐 트레이딩 | `skills/news/event-driven.md` |
| 매크로 이벤트 영향 | `skills/news/macro-impact.md` |
| 어닝 리액션 | `skills/news/earnings-reaction.md` |
| {티커} AI 종합 분석 | `/[symbol]/overall` |
| 시나리오 분석 | `/[symbol]/overall` |
| 4축 분석 / 기술 펀더 뉴스 공포탐욕 통합 | `/[symbol]/overall` |

## SEO Keywords (Korean) — Fear Greed (NEW)

| Keyword | Mapped Page |
|---------|-------------|
| {티커} 공포 탐욕 지수 | `/[symbol]/fear-greed` |
| {티커} 탐욕 지수 | `/[symbol]/fear-greed` |
| {티커} 매수 분위기 | `/[symbol]/fear-greed` |
| {티커} 매수세 | `/[symbol]/fear-greed` |
| {티커} 단기 흐름 | `/[symbol]/fear-greed` |
| {티커} 단기 심리 | `/[symbol]/fear-greed` |
| 공포 탐욕 지수 | `/[symbol]/fear-greed` |
| 투자 심리 지표 | `/[symbol]/fear-greed` |
| Fear Greed Index | `/[symbol]/fear-greed` |
| 주식 매수 분위기 | `/[symbol]/fear-greed` |
| 단기 매매 심리 | `/[symbol]/fear-greed` |

## SEO Keywords (Korean) — Indicator-specific

(기존 동일 — RSI, MACD, 볼린저밴드, 이동평균선, 골든크로스, 스토캐스틱, 일목균형표, ADX, DMI, VWAP, 볼륨 프로파일, CCI, ATR, OBV, 슈퍼트렌드, 파라볼릭 SAR, 윌리엄스 %R, 스퀴즈 모멘텀, 스마트머니 개념)

## SEO Keywords (Korean) — Pattern & Strategy

(기존 동일 — 캔들패턴/도지/장악형/망치형/헤드앤숄더/이중천장·바닥/삼중천장·바닥/쐐기/삼각수렴/플래그/컵앤핸들/페넌트/지지·저항/피보나치/피봇/엘리어트/그랜빌/다이버전스/와이코프/돌파매매/평균회귀)

## SEO Keywords (Korean) — Stock-specific patterns

| Pattern | Example |
|---------|---------|
| {종목명} 주가 분석 | 애플 주가 분석, 테슬라 주가 분석 |
| {종목명} 펀더멘털 분석 | 엔비디아 펀더멘털 분석 |
| {종목명} 뉴스 | 마이크로소프트 뉴스, 테슬라 뉴스 분위기 |
| {종목명} 호재/악재 | AAPL 호재, 테슬라 악재 |
| {종목명} 어닝/실적 | 애플 어닝 발표, 엔비디아 실적 발표 |
| {종목명} 공포/탐욕 지수 | NVDA 공포 탐욕 지수, AAPL 매수 분위기 |
| {티커} 주가 | AAPL 주가, TSLA 주가, NVDA 주가 |
| {티커} 목표 주가 | AAPL 목표 주가, NVDA 애널리스트 컨센서스 |
| {섹터명} 주식 | AI 반도체 주식, 핀테크 주식 |

## SEO Keywords (English)

- AI stock technical analysis
- AI fundamental analysis
- AI news sentiment analysis
- automated chart analysis
- stock indicator calculator
- candlestick pattern detection
- AI trading analysis report
- US stock analysis platform
- free stock technical analysis
- AI stock prediction backtesting
- earnings calendar
- analyst price target
- stock market sector signals
- golden cross scanner

## Current Stage

PR #428 (2026-05) 머지 — 5축 분석(기술/펀더/뉴스/공포탐욕/종합) + 백테스팅 페이지 + 회원 시스템 + BYOK가 모두 라이브. 종목별 단기 매수 분위기를 0~100 점수로 보여주는 공포 탐욕 지수가 신규 추가됨. 11개 섹터 신호 스캐너(`/market`), AI 챗봇(컨텍스트 자동 전환), 67+ Skills, 200+ 티커 × 5축 = 1000+ 분석 페이지가 sitemap에 등록.

## Disclaimer

Siglens는 분석 정보만 제공하며 투자 자문이 아닙니다. 분석을 기반으로 한 모든 투자 판단의 책임은 사용자에게 있습니다.
