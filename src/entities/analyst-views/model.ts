export type AnalystActionKind =
    | 'upgrade'
    | 'downgrade'
    | 'maintain'
    | 'initiate'
    | 'reiterate';
export type AnalystTargetAction = 'raise' | 'lower' | 'maintain' | 'announce';
export type EarningsSession =
    | 'before_market'
    | 'during_market'
    | 'after_market';

export interface AnalystAction {
    /** 등급 변경일(UTC 기준 `YYYY-MM-DD`). */
    date: string;
    firm: string;
    action: AnalystActionKind;
    fromGrade: string | null;
    toGrade: string | null;
    priorTarget: number | null;
    target: number | null;
    targetAction: AnalystTargetAction | null;
}

export interface AnalystActionTally {
    upgrades: number;
    downgrades: number;
    initiations: number;
    targetRaises: number;
    targetCuts: number;
}

export interface AnalystRatings {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    analysts: number;
    source: 'yahoo';
}

export interface AnalystYahooTargets {
    mean: number | null;
    median: number | null;
    low: number | null;
    high: number | null;
    analysts: number | null;
}

/** `count`는 FMP 어댑터가 건수를 버려 현재는 항상 `null`이다. */
export interface AnalystPeriodAverage {
    count: number | null;
    avg: number | null;
}

export interface AnalystFmpTargets {
    consensus: number | null;
    median: number | null;
    low: number | null;
    high: number | null;
    lastMonth: AnalystPeriodAverage;
    lastQuarter: AnalystPeriodAverage;
}

export interface AnalystEarningsHint {
    /** 미국 동부 달력 날짜 `YYYY-MM-DD`. */
    date: string;
    /** `true`·`false`·`null`(Yahoo가 말하지 않음) 3상태. */
    isEstimate: boolean | null;
    /** 확정(`isEstimate === false`)일 때만 채운다. */
    session: EarningsSession | null;
    /** 콜 날짜가 발표일(미국 동부)과 같을 때만 채운다. ISO. */
    callAt: string | null;
}

export type AnalystSource = 'yahoo' | 'fmp';

export interface AnalystViews {
    asOf: string;
    symbol: string;
    targets: {
        yahoo: AnalystYahooTargets | null;
        fmp: AnalystFmpTargets | null;
        gapPct: number | null;
        sourcesDisagree: boolean;
    };
    ratings: AnalystRatings | null;
    actions: {
        /**
         * 변경 이력을 실제로 읽었는가. `false`는 요청하지 않았거나(한국 종목, 가벼운 조회) Yahoo 요약을
         * 못 받은 경우다 — 뒤쪽은 `degraded`에 `'yahoo'`가 있어 구분된다. `false`일 때 `rows`는 `[]`이고
         * `tally`는 `null`이다(0건 집계로 "변경 없음"처럼 읽히지 않게).
         */
        available: boolean;
        rows: AnalystAction[];
        tally: {
            last30d: AnalystActionTally;
            last90d: AnalystActionTally;
        } | null;
    };
    earnings: AnalystEarningsHint | null;
    degraded: AnalystSource[];
}
