# Product Marketing Context

## Product Overview

**Product Name:** Siglens
**Website:** https://siglens.io
**Tagline:** AI-powered technical analysis platform for U.S. stocks

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

1. **Investors interested in technical analysis** but fatigued by manually configuring and interpreting each indicator
2. **Beginner investors** who find chart analysis difficult
3. **Investors who want consolidated interpretation** of multiple indicators in one report

## Key Features

- **Chart Rendering:** Lightweight Charts-based candlestick, volume, and indicator rendering
- **13+ Indicators:** RSI, MACD, Bollinger Bands, DMI, Stochastic, StochRSI, CCI, VWAP, MA, EMA, Volume Profile, Ichimoku Cloud — all auto-calculated
- **Candle Pattern Detection:** 15 single-candle patterns + 30 multi-candle patterns (algorithmic detection)
- **Chart Pattern Detection:** Head and shoulders, double top/bottom, wedges (AI + Skills-based detection)
- **AI Comprehensive Report:** Trend direction (bullish/bearish/neutral), risk level, key support/resistance levels, price targets, signal strength
- **Multi-Timeframe:** 1Min, 5Min, 15Min, 1Hour, 1Day
- **Skills System:** Add new analysis techniques by dropping a markdown file into /skills/ — no code changes needed

## What Siglens Does NOT Provide

- No order/trade execution
- No real-time data (15-minute delay via Alpaca Markets IEX)
- No investment advice or buy/sell recommendations

## Tech Stack

- Next.js 16.2 (App Router + Turbopack)
- React 19.2, TypeScript, Tailwind CSS
- Lightweight Charts for charting
- Alpaca Markets API (data source)
- Claude AI (analysis engine)
- Deployed on Vercel

## Competitive Differentiation

- **AI-first approach:** Unlike traditional charting platforms (TradingView, Thinkorswim) that require manual analysis, Siglens automates interpretation
- **Skills system:** Unique extensibility model — traders and non-developers can contribute analysis techniques via natural language markdown files
- **Harness Engineering:** 99% of code written by AI (Claude Code), demonstrating a new development paradigm

## Brand Voice & Tone

- Language: Korean (primary), English (technical terms)
- Tone: Professional, approachable, educational
- Always includes disclaimer: analysis only, not investment advice

## SEO Keywords (Korean)

- 미국 주식 기술적 분석
- AI 주식 분석
- 자동 차트 분석
- 보조지표 자동 계산
- RSI MACD 볼린저밴드 분석
- 캔들 패턴 감지
- 헤드앤숄더 이중천장 패턴
- 주식 AI 리포트

## SEO Keywords (English)

- AI stock technical analysis
- automated chart analysis
- stock indicator calculator
- candlestick pattern detection
- AI trading analysis report
- US stock analysis platform

## Current Stage

MVP — actively developing core features. Community contribution process not yet established.

## Disclaimer

Siglens provides analysis information only and does not constitute investment advice. All investment decisions based on the analysis are the user's sole responsibility.
