import 'server-only';
import {
    computeFinancialsScorecard,
    isEtRegularSessionOpen,
    type FinancialsScorecard,
    type OptionsSnapshot,
} from '@y0ngha/siglens-core';
import { getFinancialsSnapshot } from '@/entities/financials-statements/lib/getFinancialsSnapshot';
// 교차 entity(options-chain): overall이 옵션 스냅샷을 조합한다 — `src/entities/CLAUDE.md`
// "의도적 예외" 표에 등재된 허용 경로.
import { fetchOptionsSnapshot } from '@/entities/options-chain/lib/optionsDataCache';
import { isOpenInterestSnapshotStale } from '@/shared/lib/options/openInterestStale';

/**
 * 종합 분석의 옵션 스냅샷 입력. 실패하면 경고만 남기고 `null`로 내려가 분석을 막지
 * 않는다. 요청 경로(`executeOverallAnalysis`)와 프리웜(`prewarmOverall`)이 공유하며,
 * `logTag`는 호출한 쪽을 가르는 로그 접두어다.
 */
export function loadOptionsSnapshotOrNull(
    symbol: string,
    logTag: string
): Promise<OptionsSnapshot | null> {
    return fetchOptionsSnapshot(symbol).catch(error => {
        console.warn(`${logTag} options snapshot fetch failed:`, error);
        return null;
    });
}

/**
 * 종합 분석의 재무 점수표 입력. fetch·계산이 실패하면 경고만 남기고 `undefined`로
 * 내려가, 재무가 없어도 나머지 축으로 종합 분석을 계속한다. `logTag`는
 * {@link loadOptionsSnapshotOrNull}과 같다.
 */
export function loadFinancialsScorecardOrUndefined(
    symbol: string,
    logTag: string
): Promise<FinancialsScorecard | undefined> {
    return getFinancialsSnapshot(symbol)
        .then(snapshot => computeFinancialsScorecard(snapshot))
        .catch(error => {
            console.warn(`${logTag} financials scorecard fetch failed:`, error);
            return undefined;
        });
}

/**
 * 옵션 스냅샷의 미결제약정(OI)이 낡았는지 본다. 정규장 시간대에는 OI=0 비율이 높아도
 * stale로 보지 않는다 — deep OTM strike의 OI 0이 흔해 false positive 위험이 크므로
 * 정규장 밖에서만 stale 휴리스틱을 적용한다. 스냅샷이 없으면 `false`다.
 */
export function isOptionsOiStale(
    optionsSnapshot: OptionsSnapshot | null,
    now: Date
): boolean {
    return (
        optionsSnapshot !== null &&
        !isEtRegularSessionOpen(now) &&
        isOpenInterestSnapshotStale(optionsSnapshot)
    );
}
