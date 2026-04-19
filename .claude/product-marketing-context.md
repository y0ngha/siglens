# Product Marketing Context

## Product Overview

**Product Name:** Siglens
**Version:** 0.8.15
**Website:** https://siglens.io
**Tagline:** AI가 분석하는 미국 주식 기술적 분석 (AI-powered technical analysis for U.S. stocks)

Siglens automates the entire technical analysis workflow with AI. Users enter a ticker symbol and receive a comprehensive analysis report — no manual indicator configuration, no chart pattern interpretation required.

## Problem Statement

Technical analysis is hard to learn and exhausting to perform. Investors must simultaneously read multiple indicators (RSI, MACD, Bollinger Bands, DMI, etc.), adjust settings per timeframe, and identify chart patterns (head and shoulders, wedges, double tops). The barrier to entry is high and the process is time-consuming.

## Core Value Proposition

- **AI handles complex technical analysis automatically** — the user only needs to enter a ticker symbol
- Zero-config indicator calculation and chart rendering
- AI-generated comprehensive analysis reports combining indicators, candle patterns, chart patterns, and support/resistance levels
- Multi-timeframe support (1-minute to daily charts)
- **Market Dashboard:** sector-by-sector signal overview — golden cross, RSI divergence, Bollinger Squeeze signals across 11 sectors with one-click navigation to AI analysis
- Extensible analysis via the Skills system — new techniques added as markdown files, no code required

## Target Audience

- **Primary language:** Korean (ko_KR)
- **Geographic focus:** Korean investors interested in U.S. stock markets

1. **Investors interested in technical analysis** but fatigued by manually configuring and interpreting each indicator
2. **Beginner investors** who find chart analysis difficult
3. **Investors who want consolidated interpretation** of multiple indicators in one report
4. **Active traders** who need quick market-wide signal scanning across sectors

## Key Features

- **Chart Rendering:** Lightweight Charts v5-based candlestick, volume, and indicator overlay rendering
- **25 Indicators:** RSI, MACD, Bollinger Bands, ADX, DMI, Stochastic, StochRSI, CCI, VWAP, MA, EMA, Volume Profile, Ichimoku Cloud, ATR, Donchian Channel, Keltner Channel, SuperTrend, OBV, CMF, MFI, Buy/Sell Volume, Parabolic SAR, Williams %R, Squeeze Momentum, Smart Money Concepts — all auto-calculated
- **Candle Pattern Detection:** 15 single-candle patterns + 30 multi-candle patterns (algorithmic detection in domain layer)
- **Chart Pattern Detection via Skills:** Head & Shoulders, Inverse H&S, Double Top/Bottom, Triple Top/Bottom, Ascending/Descending/Symmetrical Triangle, Ascending/Descending Wedge, Bear/Bull Flag, Pennant, Cup & Handle, Rectangle, Rounding Bottom (AI + Skills-based detection)
- **Trading Strategies via Skills:** Elliott Wave, Divergence, Multi-Timeframe analysis, Breakout, Mean Reversion, Wyckoff Method, MA Cycle (Granville's Law), MACD Cycle (6-stage rotation), Fibonacci analysis
- **Support & Resistance via Skills:** Fibonacci Retracement, Fibonacci Extension, Pivot Points
- **Candlestick Education Skills:** Doji, Engulfing, Hammer & Shooting Star, Marubozu, Harami, Morning/Evening Star, Three Soldiers/Crows
- **AI Comprehensive Report:** Trend direction (bullish/bearish/neutral), risk level, key support/resistance levels, price targets, signal strength, action recommendations
- **Multi-Timeframe:** 1Min, 5Min, 15Min, 1Hour, 1Day
- **Market Dashboard (/market):** 11-sector signal scanner — identifies tickers with golden cross, RSI divergence, Bollinger Squeeze across 200+ popular tickers
- **AI Chatbot:** Context-aware follow-up Q&A on analysis results — powered by Gemini 2.5 Flash, IP-based rate limiting (5 messages per 24h per user), session history preserved in localStorage
- **Skills System:** 61 analysis skills across 5 categories (indicators / patterns / strategies / support-resistance / candlesticks) — add new techniques by dropping a markdown file, no code changes needed
- **Korean Name Support:** Automatic Korean company name translation and display for major tickers
- **200+ Tickers in Sitemap:** Mega-cap, AI/Semiconductor, Software, Fintech/Crypto, EV, Leveraged ETFs, Financials, Consumer, Energy, Healthcare, China ADR, and trending stocks

## What Siglens Does NOT Provide

- No order/trade execution
- No real-time data (15-minute delay via Alpaca Markets IEX)
- No investment advice or buy/sell recommendations

## Tech Stack

- Next.js 16.2.0 (App Router + Turbopack + React Compiler)
- React 19.2.4, TypeScript 5, Tailwind CSS 4
- Lightweight Charts 5.1 for charting
- Alpaca Markets API (market data source)
- FMP API (ticker/company info)
- Claude AI / Google Gemini (analysis engine)
- Upstash Redis (asset info caching)
- Vercel (deployment + edge functions)
- TanStack Query v5 (client-side data fetching)

## Site Architecture (SEO-relevant)

```
/                     → Homepage (RSC, WebApplication JSON-LD)
/market               → Market Dashboard — sector signal scanner (priority 0.9)
/[symbol]             → Dynamic stock analysis page (generateMetadata, WebPage + FinancialProduct JSON-LD)
/privacy              → Privacy Policy (yearly changeFrequency)
/terms                → Terms of Service (yearly changeFrequency)
/robots.txt           → Auto-generated via robots.ts
/sitemap.xml          → Auto-generated via sitemap.ts
```

**Current metadata setup:**
- Root `lang="ko"`, OpenGraph `locale: ko_KR`
- Dynamic metadata via `generateMetadata()` on symbol pages and market page
- Canonical URLs on symbol pages
- JSON-LD: WebApplication (homepage) + WebPage/FinancialProduct (symbol pages)
- Sitemap: homepage (priority 1.0) + /market (priority 0.9) + 200+ popular tickers (priority 0.8) + privacy/terms (priority 0.3)
- Robots: allow all, disallow /api/

## Competitive Differentiation

- **AI-first approach:** Unlike traditional charting platforms (TradingView, Thinkorswim) that require manual analysis, Siglens automates interpretation
- **Market-wide signal scanner:** /market dashboard shows sector-level signals at a glance — no other free tool targets Korean retail investors this way
- **AI Chatbot follow-up:** After receiving an analysis report, users can ask follow-up questions in natural language — powered by Gemini 2.5 Flash with full analysis context injected
- **Skills system:** Unique extensibility model — traders and non-developers can contribute analysis techniques via natural language markdown files (61 skills and growing)
- **Korean-first:** UI, analysis reports, and meta content are all in Korean, targeting the underserved Korean investor market for U.S. stock technical analysis
- **Free & open source:** No paywall, no registration required

## Brand Voice & Tone

- Language: Korean (primary), English (technical terms only)
- Tone: Professional, approachable, educational
- Always includes disclaimer: analysis only, not investment advice
- Dark theme (#0f172a base) with Trust Blue (#3b82f6) primary accent

## SEO Keywords (Korean) — Primary

| Keyword | Search Intent | Priority |
|---------|--------------|----------|
| 미국 주식 기술적 분석 | Informational | P0 |
| AI 주식 분석 | Service discovery | P0 |
| 미국 주식 차트 분석 | Informational | P0 |
| 무료 주식 분석 | Service discovery | P0 |
| 미국 주식 섹터 분석 | Informational | P0 |
| 주식 보조지표 분석 | Informational | P1 |
| 자동 차트 분석 | Service discovery | P1 |
| 주가 분석 | Informational | P1 |
| 미국 주식 시장 동향 | Informational | P1 |
| 골든크로스 종목 | Service discovery | P1 |

## SEO Keywords (Korean) — Indicator-specific

| Keyword | Mapped Skill |
|---------|-------------|
| RSI 보는 법 / RSI 지표 | skills/indicators/rsi.md |
| MACD 분석 / MACD 보는 법 | skills/indicators/macd.md |
| 볼린저밴드 분석 | skills/indicators/bollinger-bands.md |
| 이동평균선 / 골든크로스 / 데드크로스 | skills/indicators/ma.md, ema.md |
| 스토캐스틱 | skills/indicators/stochastic.md |
| 일목균형표 | skills/indicators/ichimoku-cloud.md |
| ADX 지표 | skills/indicators/adx.md |
| DMI 분석 | skills/indicators/dmi.md |
| VWAP 분석 | skills/indicators/vwap.md |
| 볼륨 프로파일 | skills/indicators/volume-profile.md |
| CCI 지표 | skills/indicators/cci.md |
| ATR 지표 / 변동성 지표 | skills/indicators/atr.md |
| OBV / 온밸런스볼륨 | skills/indicators/obv.md |
| 슈퍼트렌드 | skills/indicators/supertrend.md |
| 파라볼릭 SAR | skills/indicators/parabolic-sar.md |
| 윌리엄스 %R | skills/indicators/williams-r.md |
| 스퀴즈 모멘텀 | skills/indicators/squeeze-momentum.md |
| 스마트머니 개념 | skills/indicators/smart-money-concepts.md |

## SEO Keywords (Korean) — Pattern & Strategy

| Keyword | Mapped Skill |
|---------|-------------|
| 캔들패턴 / 캔들차트 보는 법 | skills/candlesticks/*.md |
| 도지 캔들 | skills/candlesticks/doji.md |
| 장악형 / 상승장악형 | skills/candlesticks/engulfing.md |
| 망치형 / 유성형 | skills/candlesticks/hammer-shooting-star.md |
| 헤드앤숄더 / 머리어깨 패턴 | skills/patterns/head-and-shoulders.md |
| 이중천장 / 더블탑 | skills/patterns/double-top.md |
| 이중바닥 / 더블바텀 | skills/patterns/double-bottom.md |
| 삼중천장 / 트리플탑 | skills/patterns/triple-top.md |
| 삼중바닥 | skills/patterns/triple-bottom.md |
| 쐐기형 패턴 | skills/patterns/ascending-wedge.md, descending-wedge.md |
| 삼각수렴 / 대칭삼각형 | skills/patterns/symmetrical-triangle.md |
| 상승삼각형 / 하락삼각형 | skills/patterns/ascending-triangle.md, descending-triangle.md |
| 불플래그 / 베어플래그 | skills/patterns/bull-flag.md, bear-flag.md |
| 컵앤핸들 | skills/patterns/cup-and-handle.md |
| 페넌트 패턴 | skills/patterns/pennant.md |
| 지지선 저항선 | AI analysis output |
| 피보나치 되돌림 | skills/support-resistance/fibonacci-retracement.md |
| 피보나치 확장 | skills/support-resistance/fibonacci-extension.md |
| 피봇포인트 | skills/support-resistance/pivot-points.md |
| 엘리어트 파동 | skills/strategies/elliott-wave.md |
| 이동평균선 대순환 / 그랜빌 법칙 | skills/strategies/ma-cycle.md |
| RSI 다이버전스 / MACD 다이버전스 | skills/strategies/divergence.md |
| 와이코프 이론 | skills/strategies/wyckoff.md |
| 돌파 매매 / 브레이크아웃 | skills/strategies/breakout.md |
| 평균회귀 전략 | skills/strategies/mean-reversion.md |

## SEO Keywords (Korean) — Stock-specific patterns

| Pattern | Example |
|---------|---------|
| {종목명} 주가 분석 | 애플 주가 분석, 테슬라 주가 분석 |
| {종목명} 기술적 분석 | 엔비디아 기술적 분석 |
| {종목명} 차트 분석 | 마이크로소프트 차트 분석 |
| {티커} 주가 | AAPL 주가, TSLA 주가, NVDA 주가 |
| {섹터명} 주식 | AI 반도체 주식, 핀테크 주식 |

## SEO Keywords (English)

- AI stock technical analysis
- automated chart analysis
- stock indicator calculator
- candlestick pattern detection
- AI trading analysis report
- US stock analysis platform
- free stock technical analysis
- RSI MACD Bollinger Bands analyzer
- stock market sector signals
- golden cross scanner

## Current Stage

v0.8.15 — Core features fully functional. Market Dashboard (/market) live with 11-sector signal scanning. AI Chatbot live on symbol pages (Gemini 2.5 Flash, 5 messages/day/IP). Skills system at 61 skills across 5 categories. 200+ tickers in sitemap. Privacy and Terms pages added. Dual AI engine (Claude for analysis reports, Gemini for chatbot).

## Disclaimer

Siglens provides analysis information only and does not constitute investment advice. All investment decisions based on the analysis are the user's sole responsibility.
