/**
 * `get_bars_indicators`·`get_fundamentals` 결과의 `notes` 문구.
 *
 * 각 문장은 그 필드가 **이 결과에서** null일 때만 실행기가 결과의 `notes` 배열에 붙인다. 필드가 null일 때만
 * 필요한 문장을 매 턴 읽히는 도구 설명에 두지 않으려고 여기로 뺐고, 도구 설명은 null이 아닌 경우의 규칙과
 * "notes가 있으면 따르라"만 남긴다(시스템 프롬프트에도 같은 규칙이 한 줄 있다).
 *
 * 문장은 코드가 이 결과에 대해 아는 것만 말한다(데이터의 빈 칸은 시장에 대한 사실이 아니다). 대신한 설명 구절의
 * 의무(출처 인용, 웹 검색이 있으면 검색, 기억으로 답하지 않기, 직접 계산하지 않기)는 그대로 지킨다. 테스트와
 * 평가 검사는 문장을 다시 쓰지 않고 이 상수를 import한다.
 */

/**
 * Result-note texts the executor attaches to a `get_bars_indicators` result.
 */
export const BARS_RESULT_NOTES = {
    /**
     * Any timeframe other than 1Day. `timeframe` is the requested one.
     */
    dailyOnlyFields: (timeframe: string): string =>
        `This result is on timeframe ${timeframe}: calendarChange, closeStreak, maCross50_200, pullback, fearGreed and lastCompletedClose are not computed for it (null or absent). When the question needs one of them, call get_bars_indicators with timeframe 1Day and say the figure is on daily bars; if you cannot, say it is not available on this timeframe. Never fill one from these bars, from your own count or from memory. When the question does not need them, do not mention them.`,
    /** 1Day and `derived.closeStreak` is null. */
    closeStreakUnavailable:
        'derived.closeStreak is null in this result: no streak could be computed from the loaded daily bars. If the question asks about consecutive up or down sessions, say the streak cannot be determined; never count one yourself or give it from memory.',
    /** 1Day, and the 252-session cross scan could not be completed. */
    maCrossShortHistory:
        'derived.maCross50_200 is null in this result: the loaded daily history is too short to scan the last 252 sessions for 50/200-day crosses. If the question asks about a golden or dead cross, say the data does not reach that far; never say that no cross happened.',
    /** 1Day and `fearGreed` is null. */
    fearGreedUnavailable:
        "fearGreed is null in this result: SIGLENS could not compute this symbol's fear & greed reading from the loaded data. If the question asks about it, say it is not available; never estimate one and never substitute the market-wide index.",
} as const;

/**
 * Result-note texts the executor attaches to a `get_fundamentals` result.
 */
export const FUNDAMENTALS_RESULT_NOTES = {
    /** A next earnings date is present, earningsSession is null or absent, there is no earningsDateAlt and earningsDateConfirmed is not false. */
    earningsSessionUnknown:
        "earningsSession is null or absent in this result: this tool does not carry the before/after-market timing of this report date. If the question asks about that timing, never state it from memory and do not cite the company's usual reporting time from memory either: search the company announcement and cite it when web_search is available, otherwise say SIGLENS does not carry it and it could not be confirmed.",
    /** A figure field (epsDiluted, revenue, revenueYoYPct) inside a recentQuarters row `sec` is null. */
    secFieldMissing:
        'A figure field of a recentQuarters row `sec` is null in this result: SIGLENS has no filed value for that figure. When the answer needs that figure, say it is not in the filing data SIGLENS has (for a fiscal Q4 derived from the 10-K, sec.epsDiluted is null: the quarterly EPS is not in the filing); never take it from the row fields and never compute it.',
    /** `dividends` has the confirmed non-payer shape. */
    dividendsNonPayer:
        'dividends in this result shows a confirmed non-payer (latestExDate and latestAmount null, trailing12mAmount 0, trailingYieldPct 0): for a dividend question say the company pays no dividend and do not web_search for one.',
    /** `dividends` is null or absent. */
    dividendsUnknown:
        'dividends is null or absent in this result, so SIGLENS has no dividend information here. For a dividend question, search and cite when web_search is available, otherwise say it could not be confirmed; never answer from memory and never derive a yield.',
    /** `dividends.latestExDate` is present and both trailing fields are null. */
    dividendsTrailingUnknown:
        'dividends.latestExDate is present but trailing12mAmount and trailingYieldPct are both null in this result. For a dividend question, report only the latest payment and say the trailing-12-month yield could not be confirmed (or web_search it when available). Never derive an annual or trailing yield from a single payment.',
    /** annualReported is present, yieldOnLastClosePct is null and dpsCommon is not null. */
    krYieldOnLastCloseNull:
        'dividends.annualReported.yieldOnLastClosePct is null in this result. For a yield question, quote dartYieldPct labeled as the DART-reported yield on the record-date price, and when it is null too say the yield could not be confirmed. Never compute a yield yourself.',
    /** annualReported.dpsCommon is null. */
    krDpsUnknown:
        'dividends.annualReported.dpsCommon is null in this result: the DPS for that fiscal year could not be confirmed. For a dividend question, use the trailing fields, never a single payment.',
    /** A US stock whose indexMemberships is null or absent. */
    indexMembershipUnknown:
        'indexMemberships is null or absent in this result. For an index-membership question, search and cite when web_search is available, otherwise say SIGLENS does not carry it and it could not be confirmed; never answer from memory.',
    /** P/E is null. */
    peUntrusted:
        'The P/E in this result is null: SIGLENS returned no usable price-to-earnings figure. When the answer needs a P/E, say it is not available; never estimate it and never compute it from price and EPS yourself.',
} as const;
