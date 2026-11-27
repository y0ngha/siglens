import type { MarketBenchmark } from '@y0ngha/siglens-core';
import { KR_MARKET_INDICES } from '../dashboard-tickers-kr';
import type { MarketProfileId } from './types';

const US_BENCHMARK: MarketBenchmark = {
    symbol: 'SPY',
    label: 'S&P 500 (SPY)',
};
/**
 * 한국 지수는 `/market/kr` 대시보드와 같은 정의(`KR_MARKET_INDICES`)에서 가져온다 — 대시보드가 이미 yahoo로
 * 읽는 심볼이라, 두 곳이 따로 적히면 한쪽만 바뀌어 어긋난다. `fmpSymbol`은 core 필드명일 뿐 yahoo 심볼이다.
 */
function krIndexBenchmark(symbol: 'KS11' | 'KQ11'): MarketBenchmark {
    const index = KR_MARKET_INDICES.find(item => item.symbol === symbol);
    if (index === undefined) {
        throw new Error(`KR_MARKET_INDICES has no ${symbol}`);
    }
    return {
        symbol: index.symbol,
        fmpSymbol: index.fmpSymbol,
        label: index.displayName,
    };
}

const KOSPI_BENCHMARK = krIndexBenchmark('KS11');
const KOSDAQ_BENCHMARK = krIndexBenchmark('KQ11');

/**
 * 분석 프롬프트의 `### Market Backdrop` 블록이 종목을 견줄 지수를 시장 프로필로 고른다.
 * core는 심볼에서 지수를 고르지 않는다 — 어느 시장의 어느 지수인지는 제품 설정이라 여기 둔다.
 *
 * 핵심 불변식: 같은 종목에는 **모든 호출부가 같은 값**을 넘겨야 한다. core가 `benchmark.symbol`을
 * 분석 캐시 키(`:bm=`)에 접으므로, 쓰는 쪽(`runAnalysis`)과 읽는 쪽(`peekAnalysisCache`의
 * `benchmarkSymbol`)이 어긋나면 peek은 항상 미스다. 그래서 쓰는 쪽도 읽는 쪽도 이 함수만 거친다.
 *
 * - 미국 주식·ETF: S&P 500(SPY). SPY 자신을 분석할 때도 그대로 넘긴다(core가 자기 자신은 건너뛰되 키는 같다).
 * - 코스피(.KS): KOSPI, 코스닥(.KQ): KOSDAQ. 지수 봉은 같은 yahoo 제공처로 읽는다.
 * - 크립토: 지수 없음(`undefined`).
 */
export function benchmarkFor(
    profile: MarketProfileId,
    symbol: string
): MarketBenchmark | undefined {
    switch (profile) {
        case 'us-equity':
            return US_BENCHMARK;
        case 'kr-equity':
            return symbol.toUpperCase().endsWith('.KQ')
                ? KOSDAQ_BENCHMARK
                : KOSPI_BENCHMARK;
        case 'crypto':
            return undefined;
    }
}
