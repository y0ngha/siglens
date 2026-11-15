import type { FundamentalGradesConsensusInput } from '@y0ngha/siglens-core';
import type { YahooAnalystSummary } from '@/shared/api/yahoo/yahooAnalystSource';

/**
 * 투자의견 분포의 출처. `yahoo`는 지금 이 종목을 다루는 애널리스트의 현재 분포이고, `fmp`는 FMP
 * `grades-consensus`(지난 의견이 누적된 값이라 합계가 실제 애널리스트 수보다 크다 — AAPL 112 대 Yahoo 45,
 * 2026-11-15 실측)다. core 타입은 그대로 두고 siglens 쪽 하위 타입으로만 출처를 싣는다 — `source`를 모르는
 * 소비자는 종전처럼 읽는다.
 */
export type GradesConsensusSource = 'yahoo' | 'fmp';

export type GradesConsensusWithSource = FundamentalGradesConsensusInput & {
    source?: GradesConsensusSource;
    /**
     * Yahoo 호출이 실패해 FMP 값으로 내려왔다는 표시. 캐시가 이 값을 짧게(`GRADES_YAHOO_FAILED_TTL_SECONDS`)
     * 들고 있다가 다시 시도하게 하는 용도이고, 화면·도구·공개 API 출력에는 싣지 않는다.
     */
    yahooFailed?: true;
};

/** Yahoo 요약 한 번의 결과를 "데이터 / 데이터 없음 / 실패"로 가른 것. */
export type YahooGradesResult =
    | { kind: 'data'; grades: FundamentalGradesConsensusInput }
    | { kind: 'empty' }
    | { kind: 'failed' };

/**
 * `getYahooAnalystSummary`의 반환값을 가른다. `null`은 실패(캐시되지 않음), 분포가 없거나 합이 0인
 * 요약은 "데이터 없음"(ETF·미커버 종목의 캐시된 빈 결과)이다.
 */
export function classifyYahooGrades(
    summary: YahooAnalystSummary | null
): YahooGradesResult {
    if (summary === null) return { kind: 'failed' };
    const { trend } = summary;
    if (trend === null) return { kind: 'empty' };
    const total =
        trend.strongBuy +
        trend.buy +
        trend.hold +
        trend.sell +
        trend.strongSell;
    if (total <= 0) return { kind: 'empty' };
    return {
        kind: 'data',
        grades: {
            strongBuy: trend.strongBuy,
            buy: trend.buy,
            hold: trend.hold,
            sell: trend.sell,
            strongSell: trend.strongSell,
        },
    };
}

/**
 * 출처 결정의 단일 지점(순수). Yahoo 데이터가 있으면 그것을, 데이터 없음이면 FMP 값을 돌려준다.
 * Yahoo 실패도 FMP 값으로 내려가되 `yahooFailed`를 달아 캐시가 짧게 들고 있게 한다.
 *
 * **Yahoo 때문에 던지지 않는다**: core의 `runFundamentalAnalysis`가 이 호출을 맨 `Promise.all` 안에서 부르므로
 * 던지면 Yahoo 장애 동안 미국 종목의 펀더멘털 AI 분석(과 종합 분석의 펀더멘털 축) 전체가 실패한다.
 * FMP 호출이 던지면 종전대로 그대로 전파한다.
 */
export async function resolveGradesConsensus(
    yahoo: YahooGradesResult,
    fmp: () => Promise<FundamentalGradesConsensusInput | null>
): Promise<GradesConsensusWithSource | null> {
    if (yahoo.kind === 'data') return { ...yahoo.grades, source: 'yahoo' };
    const value = await fmp();
    if (value === null) return null;
    return yahoo.kind === 'failed'
        ? { ...value, source: 'fmp', yahooFailed: true }
        : { ...value, source: 'fmp' };
}

/** 소비자 쪽 읽기: 출처 표시가 없으면(구버전 값) `null`. */
export function readGradesSource(
    grades: FundamentalGradesConsensusInput | null
): GradesConsensusSource | null {
    if (grades === null || !('source' in grades)) return null;
    const { source } = grades;
    return source === 'yahoo' || source === 'fmp' ? source : null;
}

/** `yahooFailed` 표시 여부 — 캐시 TTL 결정용. */
export function isYahooFailedGrades(
    grades: FundamentalGradesConsensusInput | null
): boolean {
    return (
        grades !== null &&
        'yahooFailed' in grades &&
        grades.yahooFailed === true
    );
}

/** 출력용: 다섯 건수만 남긴다(`source`·`yahooFailed` 제거). */
export function gradeCountsOnly(
    grades: FundamentalGradesConsensusInput
): FundamentalGradesConsensusInput {
    return {
        strongBuy: grades.strongBuy,
        buy: grades.buy,
        hold: grades.hold,
        sell: grades.sell,
        strongSell: grades.strongSell,
    };
}
