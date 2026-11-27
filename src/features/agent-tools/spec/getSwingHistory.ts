import {
    SWING_EPISODES_LISTED_MAX,
    SWING_LOOKBACK_YEARS,
    SWING_MIN_PCT,
    type AgentToolDefinition,
} from '@y0ngha/siglens-core';
import { SYMBOL_PROP } from './toolSchema';

/**
 * 사용자의 말에서 `minSwingPct`를 고르는 기준. 도구 설명과 라우팅 줄이 같은 값을 써서 둘이 따로 바뀌지 않는다.
 * core의 같은 문장(`SWING_THRESHOLD_GUIDE`, core 내부 전용)을 바이트 그대로 옮긴 것이다.
 */
export const SWING_THRESHOLD_GUIDE =
    'minSwingPct 10 for 조정 or an ordinary rally, 20 for 약세장 or 강세장 (a bear or bull market), 5 for 눌림목 or a short swing; for a coin or a volatile theme or small-cap stock a 10% swing is routine (it comes every few weeks), so use 20 when the user means a real correction of such a name';

/** `get_swing_history`로 가는 질문 예시. 도구 설명과 라우팅 줄이 같은 목록을 쓴다(core `SWING_TRIGGER_EXAMPLES`와 같은 바이트). */
export const SWING_TRIGGER_EXAMPLES =
    '조정은 보통 며칠 가?, 월봉 조정 기간, 상승 구간은 보통 얼마나 가?, 평균 낙폭, 평균 상승폭, 고점 회복까지 얼마나 걸려, 역대 하락장·상승장, 지금 조정 깊은 편이야?, 이번 상승 오래된 편이야?, 조정 며칠째야?, 이번 하락은 보통 며칠 더 가?';

/**
 * `get_swing_history` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_SWING_HISTORY_SPEC: AgentToolDefinition = {
    name: 'get_swing_history',
    description: `Past swings of one stock, ETF, coin or Korean stock from its daily close history: every completed decline (조정, 하락장) and every completed rally (상승 구간, 상승장, 랠리), how long and how far each went, and where the current leg stands against them. One threshold works both ways: a close minSwingPct (default ${SWING_MIN_PCT.default}) percent below the running high confirms that high and starts a decline; a close minSwingPct above the running low confirms that low, ends the decline and starts a rally, which ends at the next confirmed high. A bear market's relief rallies therefore split it into several declines. Returns {asOf, symbol, minSwingPct, firstDate, lastDate, sessions, windowHigh {date, close, fromHighPct}, declines {summary {episodes, days {samples, medianDays, avgDays, minDays, maxDays}, sessionsMedian, change {medianPct, avgPct, extremePct (deepest)}, recovered, daysToRecover {…}, peakToRecoveryDays {…}}, bySize [{fromPct, toPct (null = open-ended), episodes, medianDays, recovered, medianDaysToRecover}], episodes [{peakDate, peakClose, troughDate, troughClose, changePct, days, sessions, recoveryDate (null = never got back to the peak close), daysToRecover}], notListed}, rallies {summary {episodes, days {…}, sessionsMedian, change {medianPct, avgPct, extremePct (largest)}}, bySize [{fromPct, toPct, episodes, medianDays}], episodes [{troughDate, troughClose, peakDate, peakClose, changePct, days, sessions}], notListed}, current}. Each episodes list is newest first, at most ${SWING_EPISODES_LISTED_MAX}; notListed counts the older ones, which are still in summary and bySize. firstDate and sessions tell how much history there was: say the period from them. current.state in_decline: a decline from the latest confirmed swing high (startDate) is still open; in_rally: a rally from the latest confirmed swing low (startDate) is still open, and fromExtremePct is the pullback from its high so far; no_confirmed_swing: the history has no confirmed swing point yet. For both open legs: startDate/startClose is the confirmed swing point the leg started from, extremeDate/extremeClose/extremePct is the low (decline) or high (rally) so far vs the start, lastClose and changePct are the last close and its change vs the start, daysSinceStart runs from the start to the last close and daysToExtreme from the start to the extreme. pastEpisodes is the number of completed episodes of the same direction and pastBiggerThanNow counts those that went further than extremePct: quote it as M of pastEpisodes (e.g. 과거 N번 중 M번). afterThisAge answers how much longer a leg of this age usually ran. The open leg has started (its start was confirmed by a minSwingPct move) and not ended (no minSwingPct reversal yet), so afterThisAge.unendedAtThisAge counts the completed episodes of the same direction that were in the same state afterThisAge.ageDays (= daysSinceStart) days after their start (start already confirmed, end still to come); afterThisAge.extremeAlreadyIn counts those whose low (decline) or high (rally) had already come by then; afterThisAge.extraDaysToExtreme {samples, medianDays, p25Days, p75Days, maxDays} is, for the rest, how many more calendar days they took to reach it. The extra days run from this age (today's point in the leg) to the extreme, never from the start. Quote all three counts with the period (e.g. 과거에 이 시점에도 끝나지 않았던 조정 N번 중 K번은 이미 저점을 찍은 뒤였고, 나머지 M번은 이 시점부터 저점까지 중앙값 X일이 더 걸렸어요(중간 범위 A~B일), taking N from unendedAtThisAge, K from extremeAlreadyIn, M from extraDaysToExtreme.samples and A~B from p25Days~p75Days; for a rally say 고점 instead of 저점). p25Days and p75Days are null below a few samples: then give the median and the maximum only. When extraDaysToExtreme.samples is 0 (every one of them had already set its low or high), say so and leave out the extra-days clause. Say that the low or high may already be in, and never turn it into a date or a promise. When unendedAtThisAge is 0, no past episode of this direction was still unended this long: say so. endsAtClose is the close that would end the open leg under this tool's rule (minSwingPct above the low so far for a decline, rounded up; below the high so far for a rally, rounded down; it moves with a new extreme): when the user asks what would end or confirm the turn, quote it as that rule's level, already minSwingPct away from the extreme and measured from the low for a decline and from the high for a rally (using this call's minSwingPct, e.g. with 10: 저점 647.05달러보다 10% 높은 711.76달러 이상 종가가 나오면 이번 조정이 끝난 것으로 기록돼요; 고점 356.27달러보다 10% 낮은 320.64달러 이하 종가가 나오면 이번 상승이 끝난 것으로 기록돼요; never "320.64달러에서 10% 더 밀리면" and never measure a decline's level from its high), and never invent another level such as the leg's start. The swing high is the latest one, not the all-time high: for how far the price is below its high use windowHigh.fromHighPct (the highest close in the history). Days are calendar days and sessions are trading days: say which. Figures are from daily closes (intraday extremes went further) and are price-only (no dividends). Every figure is precomputed: quote it, do not recompute it or count episodes yourself. Give medians with the sample count and the period (e.g. 1999년 이후 10% 이상 조정 N번, 고점에서 저점까지 중앙값 M일); for an open leg quote afterThisAge as above (unended at this age: start already confirmed, end still to come) and pastBiggerThanNow as M of pastEpisodes, never when it will end. This is the past, not a forecast. Use ${SWING_THRESHOLD_GUIDE}, and lookbackYears only when the user names a period (최근 10년). For a whole index pass its tracking ETF and say the figures are that ETF's: SPY for the S&P 500, QQQ for the Nasdaq (it tracks the Nasdaq 100), 069500.KS for KOSPI (KOSPI 200) and 229200.KS for KOSDAQ (KOSDAQ 150). Use for questions like ${SWING_TRIGGER_EXAMPLES} about one symbol. found false means no price history; available false with reason provider_failed means it could not be loaded: say so.`,
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: SYMBOL_PROP,
            minSwingPct: {
                type: 'integer',
                minimum: SWING_MIN_PCT.min,
                maximum: SWING_MIN_PCT.max,
                description: `Smallest move (percent) that confirms a swing, both ways; default ${SWING_MIN_PCT.default}`,
            },
            lookbackYears: {
                type: 'integer',
                minimum: SWING_LOOKBACK_YEARS.min,
                maximum: SWING_LOOKBACK_YEARS.max,
                description:
                    'Only the last N years of closes; omit for the whole history',
            },
        },
        required: ['symbol'],
        additionalProperties: false,
    },
};
