# Product Marketing Context

## Product Overview

**Product Name:** Siglens
**Version:** 0.5.0
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
- Extensible analysis via the Skills system — new techniques added as markdown files, no code required

## Target Audience

- **Primary language:** Korean (ko_KR)
- **Geographic focus:** Korean investors interested in U.S. stock markets

1. **Investors interested in technical analysis** but fatigued by manually configuring and interpreting each indicator
2. **Beginner investors** who find chart analysis difficult
3. **Investors who want consolidated interpretation** of multiple indicators in one report

## Key Features

- **Chart Rendering:** Lightweight Charts v5-based candlestick, volume, and indicator overlay rendering
- **13 Indicators:** RSI, MACD, Bollinger Bands, ADX, DMI, Stochastic, StochRSI, CCI, VWAP, MA, EMA, Volume Profile, Ichimoku Cloud — all auto-calculated
- **Candle Pattern Detection:** 15 single-candle patterns + 34 multi-candle patterns (algorithmic detection in domain layer)
- **Chart Pattern Detection via Skills:** Head & Shoulders, Inverse H&S, Double Top/Bottom, Ascending/Descending Wedge (AI + Skills-based detection)
- **Trading Strategies via Skills:** Elliott Wave analysis, MA Cycle (Granville's Law), MACD Cycle (6-stage rotation)
- **AI Comprehensive Report:** Trend direction (bullish/bearish/neutral), risk level, key support/resistance levels, price targets, signal strength, action recommendations
- **Multi-Timeframe:** 1Min, 5Min, 15Min, 1Hour, 1Day
- **Skills System:** 21 analysis skills (13 indicators + 6 patterns + 3 strategies) in `/skills/` directory — add new techniques by dropping a markdown file, no code changes needed
- **Korean Name Support:** Automatic Korean company name translation and display for major tickers

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
- Claude AI (analysis engine)
- Redis (asset info caching)
- Deployed on Vercel

## Site Architecture (SEO-relevant)

```
/                     → Homepage (RSC, WebApplication JSON-LD)
/[symbol]             → Dynamic stock analysis page (generateMetadata, WebPage + FinancialProduct JSON-LD)
/robots.txt           → Auto-generated via robots.ts
/sitemap.xml          → Auto-generated via sitemap.ts
```

**Current metadata setup:**
- Root `lang="ko"`, OpenGraph `locale: ko_KR`
- Dynamic metadata via `generateMetadata()` on symbol pages
- Canonical URLs on symbol pages
- JSON-LD: WebApplication (homepage) + WebPage/FinancialProduct (symbol pages)
- Sitemap: homepage + 6 popular tickers (AAPL, TSLA, NVDA, MSFT, GOOGL, AMZN)
- Robots: allow all, disallow /api/

## Competitive Differentiation

- **AI-first approach:** Unlike traditional charting platforms (TradingView, Thinkorswim) that require manual analysis, Siglens automates interpretation
- **Skills system:** Unique extensibility model — traders and non-developers can contribute analysis techniques via natural language markdown files
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
| 주식 보조지표 분석 | Informational | P1 |
| 자동 차트 분석 | Service discovery | P1 |
| 주가 분석 | Informational | P1 |

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

## SEO Keywords (Korean) — Pattern & Strategy

| Keyword | Mapped Skill |
|---------|-------------|
| 캔들패턴 / 캔들차트 보는 법 | domain/analysis/candle.ts (15 single + 34 multi) |
| 헤드앤숄더 / 머리어깨 패턴 | skills/patterns/head-and-shoulders.md |
| 이중천장 / 더블탑 | skills/patterns/double-top.md |
| 이중바닥 / 더블바텀 | skills/patterns/double-bottom.md |
| 쐐기형 패턴 | skills/patterns/ascending-wedge.md, descending-wedge.md |
| 지지선 저항선 | AI analysis output |
| 엘리어트 파동 | skills/strategies/elliott-wave.md |
| 이동평균선 대순환 / 그랜빌 법칙 | skills/strategies/ma-cycle.md |

## SEO Keywords (Korean) — Stock-specific patterns

| Pattern | Example |
|---------|---------|
| {종목명} 주가 분석 | 애플 주가 분석, 테슬라 주가 분석 |
| {종목명} 기술적 분석 | 엔비디아 기술적 분석 |
| {종목명} 차트 분석 | 마이크로소프트 차트 분석 |
| {티커} 주가 | AAPL 주가, TSLA 주가 |

## SEO Keywords (English)

- AI stock technical analysis
- automated chart analysis
- stock indicator calculator
- candlestick pattern detection
- AI trading analysis report
- US stock analysis platform
- free stock technical analysis
- RSI MACD Bollinger Bands analyzer

## Current Stage

v0.5.0 — Core features functional. Skills system established with 21 skills. Korean name translation working. Community contribution process not yet established.

## Disclaimer

Siglens provides analysis information only and does not constitute investment advice. All investment decisions based on the analysis are the user's sole responsibility.
