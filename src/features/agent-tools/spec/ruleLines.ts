import { PULLBACK_MEASURED_RATE_MEANING } from '@y0ngha/siglens-core';
import { watchlistAlertRuleLines } from './watchlistAlertTools';

/**
 * 도구별 규칙 줄. core 프레임의 도구와 무관한 앞 줄과 뒤 줄 사이에 이 순서로 들어간다. 도구가 없어 `false`가 된
 * 항목은 줄을 남기지 않는다.
 */
export function agentToolRuleLines(
    available: ReadonlySet<string>
): readonly (string | false)[] {
    const newsGapRule = available.has('web_search')
        ? 'use web_search for the gap and mention the gap at most once, in one short clause'
        : 'say once, in one short clause, that SIGLENS news has nothing on it yet';
    return [
        available.has('get_bars_indicators') &&
            '- Horizon: every directional read names its horizon from the timeframe it came from — 1Month bars → months to years; 1Week → weeks to a few months; 1Day bars → days to a few weeks; 4Hour/1Hour → a few days; 30Min and shorter → intraday to a day or two.',
        available.has('get_cached_analysis') &&
            "- Analysis vs now: get_cached_analysis carries sinceAnalysis. When sinceAnalysis.levelsBroken is non-empty, or sinceAnalysis.planNow.belowStopLoss or sinceAnalysis.planNow.exceedsEntryZone is true, say SIGLENS's analysis predates that move and lead with the current bars/indicators — quote movePct as the move since the analysis; relay the analysis as the earlier view.",
        available.has('get_bars_indicators') &&
            "- Symbol fear & greed history: when a get_bars_indicators result carries fearGreed, never say its history is unavailable. When fearGreed.history is present, use it for any comparison over time (a week, month, three months or a year ago, and the year's low and high), quoting each past score with its date as given and never re-deriving it; a null entry means that point is missing, so say only that one point is missing. When fearGreed.groups[].label is present, call each group by that label (the name the symbol's fear & greed page uses), not by the key.",
        available.has('get_bars_indicators') &&
            '- Symbol fear & greed has no measured forward record: never say what such readings have historically led to (short-term lows, bounces, reversals, "often marks a bottom"), and never attribute a backtest to it. Describe the reading as it is now and compare it with its own history only. The pullback reading is the only figure that carries a measured base rate.',
        available.has('get_bars_indicators') &&
            "- Higher timeframe: a bars result's higherTimeframe is the next larger timeframe's trend and tally; when it disagrees with the requested timeframe, say so.",
        available.has('run_fresh_analysis') &&
            available.has('get_cached_analysis') &&
            '- If get_cached_analysis returns found:false or stale:true, call run_fresh_analysis right away (do not ask permission); it takes up to a few minutes and the UI shows progress.',
        available.has('get_news') &&
            `- If get_news returns nothing useful for the period the user asks about, ${newsGapRule}.`,
        available.has('get_news') &&
            "- Explaining a move with news: tie a completed session's move only to headlines whose session is that date or an earlier date in the window (get_news priceMoves lists them for the window's largest moves). An item whose session is null was published after the last completed close: it can bear on today's move in progress, never on an earlier session's move. A listed move day with no headline is not explained by SIGLENS news: say so in one clause (or follow the gap rule above), and never guess a cause the tool results do not show.",
        available.has('get_bars_indicators') &&
            '- When you called get_bars_indicators for a symbol question, reflect how many indicator groups agree: at the Detailed level say which signals lean bullish and which bearish and how far the indicator families agree, never printing its 0–100 score, and say once in the answer that it is a rule-based tally, not a forecast (it has no measured forward edge) — add no other qualifier about what it is; at the Plain level say in words how much the indicators agree, with no score or "/100" figure. If it is null, never guess an agreement: at both levels say briefly that the trading history is too short for this indicator tally (Plain: in one plain clause, no jargon).',
        available.has('get_bars_indicators') &&
            // The 66-75% meaning is shared with the analysis prompt and PULLBACK_BASE_RATES: PULLBACK_MEASURED_RATE_MEANING.
            '- Short-term sell-off reading: when a get_bars_indicators result carries a pullback (it is null when there is no such reading), reflect it next to the indicator agreement. At the Detailed level quote the reading, its inputs and its measured line as given — a historical base rate, never a buy instruction; the measured ' +
                PULLBACK_MEASURED_RATE_MEANING +
                ", never a win rate or a holding-period result, and never present it as the chance the stock is higher later; say that this measured line is SIGLENS's backtest across many stocks since 2000, not this stock's own history. At the Plain level say in words that the stock has dropped sharply within a longer uptrend (washoutInUptrend / nearWashoutInUptrend) or below its long-term average, which has been the riskier case (washoutBelowMa200); if the answer mentions what such drops have historically led to, say this is SIGLENS's backtest across many stocks since 2000, not this stock's own history. Whenever you cite the 66-75% figure at either level, give its exit condition (a short trade exited at the first close above MA5, or after about 10 days) and that attribution, and never call it a win rate (승률); in Korean write it as \"수익으로 끝난 비율\" together with the MA5 exit condition. When the reading is washoutInUptrend and the tally leans bearish, say that this combination is normal for such pullbacks rather than a reason for caution by itself. When pullback.caveat is a string, say the base rate may not apply to this drop and give that reason in one clause. When pullback is null, do not bring it up at either level; if the question asks about it, answer as the get_bars_indicators description says (no reading, or too little history when range.bars is below 200).",
        available.has('get_bars_indicators') &&
            '- Overbought / oversold: applies when the question asks whether something is overbought or oversold, or when your answer is about to call any reading overbought, oversold or "near" either. Take every such word from latest.oscillatorZones and latest.oscillatorSummary of get_bars_indicators, never from your own comparison, and give no zone word to a reading whose computed zone is neutral (the summary may call one just above or just below a line, nothing more). To answer the question itself, use the whole summary line, never RSI alone, quoting its counts and names as given; at the Plain level its counts are enough and the names you give stay within the two or three indicators allowed there. When those fields are absent, use latest.rsiZone for RSI (neutral between 30 and 70) and give no zone word to any other oscillator.',
        available.has('get_options_summary') &&
            "- Options answers: for max pain give only what it is (the smallest-payout strike) and its distance from the price; never mention the pinning or gravitation idea that price drifts toward it, not even hedged or to say it is not guaranteed, and never use max pain to tilt a directional read. Never call implied volatility high, low or normal for this stock unless a tool result gives its IV history; just state the figure, without explaining that the history is missing. Never claim timing (\"tonight\", \"this week\") beyond daysToExpiration and the expiration date. Write option premiums in dollars to the cent ($0.10), never in cents or fractions of a cent (not '9.5 cents', not 'half a cent'); below $0.01 say 'under one cent'.",
        available.has('get_quote') &&
            "- If a quote's quoteDelayMinutes is greater than 0, say the quote is delayed by that many minutes; never present it as real-time.",
        (available.has('get_analyst_views') ||
            available.has('get_fundamentals')) &&
            '- Analyst price targets: when a tool result marks its two target sources as disagreeing (sourcesDisagree or targetSourcesDisagree is true), give both figures with their source names (Yahoo Finance, FMP), give the analyst count only for the Yahoo Finance figure (the other carries none), and say the aggregators differ; never average them, pick one, or call either "the consensus". Targets and ratings are the firms\' opinions, not SIGLENS\'s view and not a forecast: attribute them to analysts.',
        available.has('get_analyst_views') &&
            '- Analyst actions: cite a rating or target change with its date and firm, and take the number of upgrades, downgrades, target raises or cuts over the last 30 or 90 days from actions.tally, never by counting rows; for any other window list the dated rows inside it without giving a total. Beside a price move, a change is something published on that date: say it coincided with the move, never that it caused it.',
        available.has('get_macro_quotes') &&
            '- Commodity and futures quotes: a get_macro_quotes item whose contract is not null is the front-month futures price (근월물 in Korean, never 전월물) — say so once and never call it the spot price. When its quoteDelayMinutes is above zero say the quote is delayed by that many minutes; when it is 0 or null do not mention a delay. A null changes entry or a null range52w means that history is not available: leave it out, never fill it in.',
        ...watchlistAlertRuleLines(available),
    ];
}
