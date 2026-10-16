import {
    INVESTOR_FLOWS_STATE_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../lib/investorFlowsPolicy';
import {
    deriveInstitutionalStatus,
    deriveShortStatus,
} from '../lib/investorFlowsReadiness';
import type { InvestorFlowsPipelineReadiness } from '../model';

export interface PipelineReadinessDeps {
    /** `investor_flows_state` 한 키 읽기. */
    getState(key: string): Promise<string | null>;
    /** FINRA 잔고·일별 거래량 중 어느 쪽이든 행이 있는가. */
    hasAnyShortRow(): Promise<boolean>;
    isFinraEnabled(): boolean;
}

/**
 * 수집 파이프라인 준비 상태를 DB에서 읽는다 — 종목과 무관한 전역 값이다.
 *
 * - 기관(13F): cusip-map 전수 한 바퀴 표식 **그리고** sec-13f 초기 백필 완료 표식이 모두 있어야 `ready`.
 * - 공매도(FINRA): 플래그가 켜져 있고 두 테이블 중 한 곳에 행이 있으면 `ready`, 켜졌는데 비어 있으면 `collecting`.
 *   꺼져 있으면 읽지 않는다(DB 조회 0).
 *
 * 인프라 실패는 **그대로 던진다** — 호출부(`getInvestorFlowsPipelineReadiness`)가 `unknown`으로 바꾸므로, 장애가
 * "수집 중"으로 보이지도 TTL 동안 캐시에 굳지도 않는다.
 */
export async function loadInvestorFlowsPipelineReadiness(
    deps: PipelineReadinessDeps
): Promise<InvestorFlowsPipelineReadiness> {
    const finraEnabled = deps.isFinraEnabled();
    const [universe, backfill, hasAnyRow] = await Promise.all([
        deps.getState(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE),
        deps.getState(INVESTOR_FLOWS_STATE_BACKFILL_DONE),
        finraEnabled ? deps.hasAnyShortRow() : Promise.resolve(false),
    ]);
    return {
        institutional: deriveInstitutionalStatus({
            universeComplete: universe !== null,
            backfillDone: backfill !== null,
        }),
        short: deriveShortStatus({ finraEnabled, hasAnyRow }),
    };
}
