import { computeFinancialsScorecard } from '@y0ngha/siglens-core';
import type {
    FinancialsScorecard,
    FinancialsSnapshot,
} from '@y0ngha/siglens-core';
import {
    getFinancialsSnapshot,
    QUARTER_LIMIT,
} from '@/entities/financials-statements/lib/getFinancialsSnapshot';

/**
 * 6-fetch+normalize는 entity lib(`entities/financials-statements/lib/getFinancialsSnapshot`)이
 * 단일 source다. 이 파일은 재export 후 page 전용 조합(scorecard 동봉)만 추가한다.
 */
export { getFinancialsSnapshot };

/**
 * `/[symbol]/financials` 페이지가 필요로 하는 데이터를 한 번의 호출로 반환한다.
 * `snapshot`(정규화된 재무제표)과 `scorecard`(5개 축 등급 + composite)를 포함한다.
 */
export async function getFinancialsPageData(symbol: string): Promise<{
    snapshot: FinancialsSnapshot;
    scorecard: FinancialsScorecard;
}> {
    const snapshot = await getFinancialsSnapshot(symbol);
    return { snapshot, scorecard: computeFinancialsScorecard(snapshot) };
}

/** 분기 데이터를 요청할 때 사용하는 기본 limit (8분기 ≈ 2년). */
export const QUARTER_STATEMENT_LIMIT = QUARTER_LIMIT;
