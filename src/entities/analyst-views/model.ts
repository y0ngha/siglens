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

/** 실적 추정치 한 기간(Yahoo 컨센서스). core `get_analyst_views` 설명의 `estimates` 행 모양이다. */
export interface AnalystEstimatePeriod {
    /** `0q` 이번 분기, `+1q` 다음 분기, `0y` 이번 회계연도, `+1y` 다음 회계연도. */
    period: string;
    endDate: string | null;
    eps: {
        avg: number | null;
        analysts: number | null;
        ago7d: number | null;
        ago30d: number | null;
        ago60d: number | null;
        ago90d: number | null;
        /** 현재 − 30일 전(주당 절대값). 둘 중 하나라도 없으면 `null`. */
        change30d: number | null;
        change90d: number | null;
    };
    revisions: {
        up7d: number | null;
        down7d: number | null;
        up30d: number | null;
        down30d: number | null;
    };
    revenue: {
        avg: number | null;
        analysts: number | null;
        /** 퍼센트(25 = 25%). */
        growthPct: number | null;
    };
}

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
    /** 실적 추정치 추이. 요청하지 않았거나(가벼운 조회) Yahoo를 못 읽었거나 추정치가 없으면 `null`. */
    estimates: AnalystEstimatePeriod[] | null;
    degraded: AnalystSource[];
}

/** 두 출처 목표가 차이가 이 값(%)을 넘으면 불일치다. 정확히 같으면 불일치가 아니다. */
export const TARGET_DISAGREE_THRESHOLD_PCT = 10;

/**
 * 펀더멘털 탭이 쓰는 Yahoo 목표가 요약 — 직렬화 가능한 최소 모양(전체 `AnalystViews`를 캐시·프롭으로
 * 넘기지 않는다). 불일치 여부는 담지 않는다: 화면이 실제로 보여 주는 FMP 컨센서스와 이 평균으로 렌더 때 계산한다
 * (`targetsDisagree`) — 따로 캐시된 두 값 사이에서 낡은 플래그가 남지 않게 한다.
 */
export interface AnalystTargetsSummary {
    yahooMean: number;
    yahooAnalysts: number | null;
}
