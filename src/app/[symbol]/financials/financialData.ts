import { computeFinancialsScorecard } from '@y0ngha/siglens-core';
import type {
    FinancialsScorecard,
    FinancialsSnapshot,
} from '@y0ngha/siglens-core';
import { getFinancialsSnapshot } from '@/entities/financials-statements';

/** `/[symbol]/financials` 페이지 렌더에 필요한 데이터 묶음. */
export interface FinancialsPageData {
    /** 정규화된 재무제표 스냅샷(연간). */
    snapshot: FinancialsSnapshot;
    /** 4개 축 등급 + composite 점수. */
    scorecard: FinancialsScorecard;
}

/**
 * `/[symbol]/financials` 페이지가 필요로 하는 데이터를 한 번의 호출로 반환한다.
 * `snapshot`(정규화된 재무제표)과 `scorecard`(4개 축 등급 + composite)를 포함한다.
 */
export async function getFinancialsPageData(
    symbol: string
): Promise<FinancialsPageData> {
    const snapshot = await getFinancialsSnapshot(symbol);
    return { snapshot, scorecard: computeFinancialsScorecard(snapshot) };
}
