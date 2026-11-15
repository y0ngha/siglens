import 'server-only';
import type { FundamentalGradesConsensusInput } from '@y0ngha/siglens-core';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getFundamentalDataProvider } from './getFundamentalDataProvider';
import {
    gradeCountsOnly,
    isYahooFailedGrades,
    type GradesConsensusWithSource,
} from './gradesConsensusSource';

/**
 * 로더가 "Yahoo 실패로 내려온 FMP 값"을 데이터 캐시에 넣지 않으려고 던지는 내부 신호. 던진 값은
 * `unstable_cache`가 저장하지 않으므로 이 값이 페이지 캐시(24h)에 굳지 않는다.
 */
class YahooFailedGradesFallback extends Error {
    constructor(readonly fallback: GradesConsensusWithSource) {
        super('Yahoo grades failed; FMP fallback is not cached by the page');
        this.name = 'YahooFailedGradesFallback';
    }
}

export interface PageGradesConsensus {
    grades: FundamentalGradesConsensusInput | null;
    /** Yahoo가 실패해 FMP 누적 분포로 내려온 값인가. 호출부는 revalidate를 낮추고 인원 수 줄을 그리지 않는다. */
    yahooFailed: boolean;
}

/**
 * 펀더멘털 탭 투자의견 분포의 **페이지 캐시 로더** — 섹션(`FutureDirectionSection`)과 사실 블록
 * (`getFundamentalFacts`)이 같은 keyParts로 한 엔트리를 공유하도록 이 한 곳에서만 만든다.
 *
 * 프로바이더의 `yahooFailed` 값은 Redis에 10분만 남지만(`CachedFundamentalProvider`) 이 위의
 * `staticSymbolCache`는 24시간을 쥔다. 콜드 렌더가 Yahoo 장애와 겹치면 틀린 누적값(AAPL 112)이 하루 동안
 * 굳으므로, 그 값은 던져서 캐시에 넣지 않고 여기서 받아 `yahooFailed: true`와 함께 돌려준다. FMP 자체의
 * 실패는 종전처럼 그대로 전파한다. 반드시 서버 렌더에서만(데이터 캐시 스코프 안) 부른다.
 */
export async function loadPageGradesConsensus(
    symbol: string
): Promise<PageGradesConsensus> {
    try {
        const grades = await staticSymbolCache(
            ['fundamental:grades-consensus-v2', symbol],
            symbol,
            async () => {
                const value =
                    await getFundamentalDataProvider(symbol).getGradesConsensus(
                        symbol
                    );
                if (value !== null && isYahooFailedGrades(value)) {
                    const fallback: GradesConsensusWithSource = {
                        ...gradeCountsOnly(value),
                        source: 'fmp',
                    };
                    throw new YahooFailedGradesFallback(fallback);
                }
                return value;
            },
            [],
            SECONDS_PER_DAY
        );
        return { grades, yahooFailed: false };
    } catch (error) {
        if (error instanceof YahooFailedGradesFallback) {
            return { grades: error.fallback, yahooFailed: true };
        }
        throw error;
    }
}
