# Daily AI analysis backtest (2024-11-01 to 2026-11-02)

[한국어](./README.ko.md)

We ran SIGLENS's production technical analysis once per trading day over two years of daily bars, then measured what would have happened if a member had followed the plan shown on screen. Every trading decision comes from an AI response; the simulation only executes those responses under fixed rules.

## Summary

Equal capital split across 10 tickers, no rebalancing.

| | AI strategy | Buy and hold (10-ticker mean) | SPY buy and hold |
|---|---|---|---|
| 2-year return | **+29.1%** | +44.3% | +31.7% |
| Max drawdown (AI on closed trades, buy and hold on daily closes) | **−9.3%** | — | −19.0% |
| Time in market | 62% on average | 100% | 100% |

| Trades | Win rate | Mean per trade | Median per trade | Mean holding |
|---|---|---|---|---|
| 690 | 57.4% | +0.39% | +0.43% | 4.5 trading days |

### By ticker

| Ticker | Trades | Win rate | AI strategy | Max DD | Time in market | Buy and hold | Buy and hold max DD |
|---|---|---|---|---|---|---|---|
| GOOGL | 65 | 66.2% | +77.3% | −11.6% | 66% | +62.9% | −30.7% |
| NVDA | 68 | 63.2% | +71.1% | −18.0% | 61% | +49.2% | −36.9% |
| META | 77 | 59.7% | +47.8% | −14.7% | 59% | +7.0% | −34.2% |
| MSFT | 65 | 60.0% | +47.1% | −14.4% | 67% | +23.6% | −34.9% |
| AVGO | 79 | 54.4% | +43.0% | −17.3% | 58% | +90.8% | −41.5% |
| AAPL | 59 | 66.1% | +29.6% | −11.8% | 69% | +51.8% | −33.4% |
| SPY | 64 | 57.8% | +5.0% | −12.0% | 65% | +31.7% | −19.0% |
| AMZN | 70 | 51.4% | −3.6% | −20.1% | 60% | +24.1% | −30.9% |
| QQQ | 65 | 46.2% | −11.5% | −15.0% | 65% | +39.7% | −22.9% |
| TSLA | 78 | 51.3% | −14.9% | −42.4% | 55% | +62.2% | −53.8% |

The AI strategy's drawdown is measured on closed trades only. Open-position marks are not included, so a real account would show a deeper drawdown.

### Exit paths

| Exit path | Trades | Mean return |
|---|---|---|
| First target + final target | 94 | +5.59% |
| First target + raised stop loss line | 70 | +2.41% |
| First stop loss line + final target | 37 | +1.95% |
| First target + breakeven stop | 199 | +0.38% |
| First stop loss line + second stop loss line | 241 | −2.57% |
| Sell-off rule: MA5 recovery exit | 30 | +3.01% |
| Sell-off rule: stop | 19 | −2.55% |

The AI can raise the stop loss line during holding reviews, so some trades closed at a stop loss line still ended in profit.

### AI decisions

- 1,168 decisions while flat: `wait` 1,108, `enter` 49, `avoid` 1, missing field 10.
- All 49 `enter` calls came from the prompt's deterministic sell-off rule (close above MA200 and Williams %R ≤ −90). The LLM never returned `enter` outside that rule.
- 641 of the 690 trades were filled inside the conditional entry zone that came with a `wait`.
- Position buckets across 2,493 holding reviews: near breakeven 1,944, profit 493, loss 38, deep profit 18.

### Trend recognition

We counted whether each trend call (`trend`) pointed the same way as the actual move over the 10 trading days before it. This measures whether the analysis read the move so far, not whether it predicted what came next. Neutral calls state no direction and are left out of the match rate.

**Trend recognition match rate: 89.2%** (2,284 bullish or bearish calls)

| Trend call | Calls | Previous 10 days, mean | Previous 10 days, share up |
|---|---|---|---|
| Bullish | 1,562 | +5.47% | 90.7% |
| Bearish | 722 | −5.28% | 14.1% |
| Neutral | 1,377 | +0.57% | 50.1% |

Because the value describes the move up to the analysis, SIGLENS labels it "current trend" on screen. The trading results came from the price plan (entry zones, targets, stops), not from this call.

## Strategy

1. **Analysis**: once per trading day after the close, call the production `runAnalysis` at member tier. Model: DeepSeek V4.1 Flash (API `deepseek-flash`), reasoning off. Only bars up to that day are supplied.
2. **Prior analyses**: the simulation's own earlier analyses of that ticker go into the prompt under the production rules (within the last 21 bars, at most 7 rendered).
3. **Entry**
   - `enter`: buy at that day's close.
   - `wait`: place a limit order for the next day inside the entry zone the AI returned. Fill at the open if the open is inside the zone, at the zone top if price comes down into it. An unfilled order is replaced by the next day's analysis.
   - `avoid`: no trade.
4. **Split exit**: the position is split into two halves.
   - Half A exits at the first target or at the AI stop.
   - Half B is held for the final target. If A took profit, B's stop moves to breakeven (or a higher AI stop). If A was stopped out, B's stop is the next support level the AI listed.
5. **Holding reviews**: re-analyze daily with the position bucket (near breakeven, profit, and so on) and update targets and stops from the new response.
6. **Sell-off rule entries** are not split. They exit under the rule written in the prompt: the first close above MA5, or the close on the 10th trading day. The AI stop serves only as a disaster stop.
7. **Intraday fills** are approximated from the daily high and low. If a bar touches both the stop and the target, the stop wins. Gaps fill at the open. Maximum holding is 60 trading days.

## Limitations

- No commissions or slippage.
- Intraday order is unknown, so fills are approximated from daily highs and lows.
- Technical analysis only. No news, earnings dates, or market events, because historical news was not available on our data plan.
- Tickers were chosen in advance as the largest by market cap, but they are today's large caps, so survivorship bias remains.
- Member behavior (analyzing daily, following the plan) is assumed.

## Files

| File | Contents |
|---|---|
| [`trades.csv`](./trades.csv) | One row per trade: entry type, decision date, entry, exit date, price, reason and return for each half, initial plan |
| [`decisions.csv`](./decisions.csv) | One row per AI call (1,168 entry decisions + 2,493 holding reviews): decision, entry zone, stop, targets, 5- and 10-day forward returns, prompt and response file paths |
| [`summary.json`](./summary.json) | All aggregated results |
| [Full prompts and responses (release asset)](https://github.com/y0ngha/siglens/releases/tag/backtest-2026-11-daily-ai) | `2026-11-daily-ai-prompts-and-responses.tar.gz`: per-call prompts (with prior analyses), full AI responses, and the system prompt. `prompt_file` and `response_file` in `decisions.csv` are paths inside this archive |
| [Raw data repository](https://github.com/y0ngha/siglens-backtest-data) | Daily bars, per-day indicators, chart patterns, Fibonacci levels and candles, raw DeepSeek requests and responses, and the scripts |

## Reproduction

| Item | Value |
|---|---|
| Period | 2024-11-01 to 2026-11-02 (entry decisions stop 10 trading days before the end) |
| Tickers | NVDA, AAPL, MSFT, AMZN, GOOGL, META, AVGO, TSLA, SPY, QQQ |
| SIGLENS | v0.114.1 (`50da57f`), `skills/` at the same commit |
| siglens-core | 2.29.0, prompt version `p32` |
| Model | `deepseek-v4.1-flash`, reasoning off, member tier |
| AI calls | 3,661 (1,168 entry decisions + 2,493 holding reviews) |
| Run date | 2026-11-04 |
