# Market Overview Dashboard — Design Spec

**Date:** 2026-04-18
**Status:** Approved

---

## Overview

A new dashboard page that serves as the entry point for users who don't yet know what to analyze. It provides two panels:

- **[B] Market Summary** — Key indices, sector ETF performance, and a short AI-generated market briefing
- **[C] Sector Signal Discovery** — Sector-grouped leading stocks with technical signal badges; clicking a stock navigates to the existing analysis page

The dashboard requires no login and is designed to attract new users and drive engagement with the core analysis flow.

---

## Page Layout

```
/dashboard  (new route)

┌─────────────────────────────────────────────────────┐
│  [B] Market Summary Panel                           │
│                                                     │
│  S&P500 +0.8%  NASDAQ +1.2%  DOW -0.3%  VIX 18.2  │
│  ─────────────────────────────────────────────────  │
│  Sector bar: Tech +2.1% | Energy -1.4% | ...       │
│  ─────────────────────────────────────────────────  │
│  AI Briefing (1 paragraph, 1hr cache)               │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  [C] Sector Signal Discovery                        │
│                                                     │
│  [Technology] [Financials] [Energy] [Healthcare]... │
│                                                     │
│  AAPL  RSI Oversold ↑                              │
│  NVDA  Golden Cross                                 │
│  MSFT  Bollinger Lower Band Bounce                  │
│  (click → existing /[symbol] analysis page)         │
└─────────────────────────────────────────────────────┘
```

---

## Panel B — Market Summary

### Data Sources

| Symbol | Type | Notes |
|--------|------|-------|
| ^GSPC | Index | S&P 500 |
| ^DJI | Index | Dow Jones |
| ^IXIC | Index | NASDAQ Composite |
| ^VIX | Index | Volatility Index |
| XLK | Sector ETF | Technology |
| XLF | Sector ETF | Financials |
| XLE | Sector ETF | Energy |
| XLV | Sector ETF | Healthcare |
| XLY | Sector ETF | Consumer Discretionary |
| XLP | Sector ETF | Consumer Staples |
| XLI | Sector ETF | Industrials |
| XLB | Sector ETF | Materials |
| XLU | Sector ETF | Utilities |
| XLRE | Sector ETF | Real Estate |
| XLC | Sector ETF | Communication Services |

Global indices (^FTSE, ^N225, ^HSI, ^STOXX50E) are optional and can be added later without design changes.

### Index Re-enablement Scope

Index symbols (^GSPC etc.) are currently disabled in the codebase via commented-out code. Re-enabling is scoped to **internal fetch only**:

- Uncomment `findIndexMatch` and `filterIndexResults` in `getAssetInfoAction.ts`
- The user-facing search bar remains unchanged — indices do not appear in search results
- The dashboard fetches indices via a hardcoded symbol list, bypassing the search path entirely

### AI Briefing

- Input: latest daily bar + key indicator values for all 15 symbols above
- Output: 2–3 sentence market summary (bullish/bearish/neutral tone, key themes)
- Prompt: reuses existing Skills-based prompt structure
- Cache: Upstash Redis, TTL = 1 hour (keyed by date + "1Day" timeframe)
- If cache miss: trigger AI call server-side on page load (RSC Server Component)

### Displayed Data Per Index/Sector

- Current price (or latest close)
- Change % vs previous close
- Direction arrow (up/down/flat)

---

## Panel C — Sector Signal Discovery

### Stock Universe

Hardcoded list: 11 sectors × 8–10 leading stocks = ~90–110 stocks total.

Representative sector groupings (exact list defined in `src/domain/constants/dashboard-tickers.ts`):

| Sector | Example Tickers |
|--------|----------------|
| Technology | AAPL, MSFT, NVDA, AVGO, AMD, ORCL, QCOM, INTC |
| Financials | JPM, BAC, GS, MS, WFC, BLK, V, MA |
| Energy | XOM, CVX, COP, SLB, OXY, EOG |
| Healthcare | UNH, LLY, JNJ, ABBV, MRK, PFE, TMO |
| Consumer Discretionary | AMZN, TSLA, HD, MCD, NKE, LOW |
| Consumer Staples | WMT, COST, PG, KO, PEP, PM |
| Industrials | CAT, HON, UNP, GE, RTX, DE |
| Materials | LIN, APD, ECL, NEM, FCX |
| Utilities | NEE, DUK, SO, AEP, EXC |
| Real Estate | AMT, PLD, EQIX, CCI, PSA |
| Communication Services | GOOGL, META, NFLX, DIS, CMCSA, T |

### Signal Calculation

- No AI involved — uses existing `domain/indicators/` TypeScript functions
- Calculated on 1Day timeframe bars for each stock
- Signal detection is pure code: compare indicator values against threshold conditions

### Signal Types (initial set)

| Signal | Condition |
|--------|-----------|
| RSI Oversold | RSI < 30 |
| RSI Overbought | RSI > 70 |
| Golden Cross | MA20 crossed above MA50 (within last 3 bars) |
| Death Cross | MA20 crossed below MA50 (within last 3 bars) |
| MACD Bullish Cross | MACD line crossed above signal line (within last 3 bars) |
| MACD Bearish Cross | MACD line crossed below signal line (within last 3 bars) |
| Bollinger Lower Bounce | Price touched lower band and closed higher |
| Bollinger Upper Breakout | Price closed above upper band |

A stock can carry multiple signals simultaneously. Stocks with no active signals are hidden from the panel.

### Caching

- Batch indicator calculation result cached in Upstash Redis
- TTL = 1 hour (intraday data is not needed; daily bars change once per day)
- Cache key: `dashboard:signals:1Day:<date>`
- On cache miss: compute all ~100 stocks server-side (RSC Server Component with Suspense)

### UX

- Sector tabs at the top of the panel
- Each stock shown as a card: ticker, name, signal badge(s)
- Click → navigates to `/[symbol]` (existing analysis page) — no new page needed
- If a sector has no stocks with active signals: show "No signals today" placeholder

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/app/dashboard/page.tsx` | RSC page — fetches and passes data to client |
| `src/components/dashboard/MarketSummaryPanel.tsx` | Panel B component |
| `src/components/dashboard/SectorSignalPanel.tsx` | Panel C component |
| `src/components/dashboard/IndexCard.tsx` | Single index/ETF card |
| `src/components/dashboard/SignalStockCard.tsx` | Single stock signal card |
| `src/domain/constants/dashboard-tickers.ts` | Hardcoded index list + sector stock list |
| `src/domain/signals/detectSignals.ts` | Pure function: bar[] + indicators → Signal[] |
| `src/infrastructure/dashboard/marketSummaryApi.ts` | Fetch + cache logic for Panel B |
| `src/infrastructure/dashboard/sectorSignalsApi.ts` | Batch fetch + cache logic for Panel C |

### Modified Files

| File | Change |
|------|--------|
| `src/infrastructure/ticker/getAssetInfoAction.ts` | Uncomment index support (internal fetch only) |

### Layer Rules

- `domain/signals/detectSignals.ts` — pure function, no external imports
- `domain/constants/dashboard-tickers.ts` — pure constants
- `infrastructure/dashboard/` — may import from domain, handles API + cache
- `components/dashboard/` — may import from domain and lib; no direct infrastructure imports
- `app/dashboard/page.tsx` — RSC, imports from infrastructure

---

## Caching Summary

| Data | Cache Key Pattern | TTL |
|------|------------------|-----|
| Index/sector prices (Panel B) | `dashboard:prices:1Day:<date>` | 1 hour |
| AI briefing text (Panel B) | `dashboard:briefing:1Day:<date>` | 1 hour |
| Sector signals (Panel C) | `dashboard:signals:1Day:<date>` | 1 hour |

---

## Out of Scope

- User-facing index search (search bar remains unchanged)
- Alert / notification system (separate future feature)
- Watchlist persistence (requires auth, separate feature)
- Intraday signal updates (daily bars only for now)
- Backtesting of signals
- Global indices in Panel B (deferred, easy to add later)
