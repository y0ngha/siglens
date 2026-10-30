/**
 * 점수가 없는 축을 "데이터 부족"과 달리 말할 사유 판정.
 */
import type {
    InvestorFlowsAxisId,
    InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import { COLLECTING_MARK, LABEL_MARK } from './scorecardLabels';

/**
 * 점수가 없는 축을 "데이터 부족"과 달리 말할 사유 — 초기 수집 중, FMP 일시 오류로 이번에만 못 불러옴, 또는 (한국) 보고는
 * 있는데 모두 채점 창 밖이라 최근 공시가 없음.
 */
export type AxisGap = 'collecting' | 'unavailable' | 'noRecentReports';

/** 사유별 배지 기호 — 수집 중·일시 오류는 아직 모르는 상태라 말줄임표, 최근 공시 없음은 점수 없음(–) 그대로다. */
export const GAP_MARK: Record<AxisGap, string> = {
    collecting: COLLECTING_MARK,
    unavailable: COLLECTING_MARK,
    noRecentReports: LABEL_MARK.insufficient,
};

/**
 * 축이 `insufficient`일 때만 사유를 정한다. 수집 중이 먼저다 — 그 종목의 원천 자체가 아직 비어 있다는 뜻이고, 일시 오류는 이번에만
 * 못 불러왔다는 뜻이다. 채점된 축이거나 해당 사유가 없으면 `null`이다(`noRecentReports`는 한국 창 판정이 따로 정한다).
 */
export function resolveAxisGap(
    scorecard: InvestorFlowsScorecard,
    axis: InvestorFlowsAxisId,
    collectingAxes: ReadonlySet<InvestorFlowsAxisId>,
    unavailableAxes: ReadonlySet<InvestorFlowsAxisId>
): AxisGap | null {
    if (scorecard[axis].sufficiency !== 'insufficient') return null;
    if (collectingAxes.has(axis)) return 'collecting';
    return unavailableAxes.has(axis) ? 'unavailable' : null;
}
