import { toUtcIsoDate } from '@/shared/lib/isoDate';
import {
    INVESTOR_FLOWS_STATE_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_FINRA_REBACKFILL,
    INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../lib/investorFlowsPolicy';
import {
    deriveDartStatus,
    deriveFilingsStatus,
    deriveFtdStatus,
    deriveInstitutionalStatus,
    deriveShortStatus,
    deriveThresholdListStatus,
} from '../lib/investorFlowsReadiness';
import type { InvestorFlowsPipelineReadiness } from '../model';

export interface PipelineReadinessDeps {
    /** `investor_flows_state` 한 키 읽기. */
    getState(key: string): Promise<string | null>;
    /** FINRA 잔고·일별 거래량 중 어느 쪽이든 행이 있는가. */
    hasAnyShortRow(): Promise<boolean>;
    /** SEC FTD 반월 파일이 하나라도 저장됐는가. */
    hasAnyFtdFile(): Promise<boolean>;
    /** Reg SHO 과열 목록을 받은 거래일들(수집 상태 `reg_sho_cursor`). */
    listThresholdTradeDates(): Promise<string[]>;
    isFinraEnabled(): boolean;
    isRegShoEnabled(): boolean;
    /** `DART_API_KEY`가 설정돼 있는가. 없으면 DART 표식을 읽지 않는다. */
    isDartEnabled(): boolean;
    now(): Date;
}

/**
 * 수집 파이프라인 준비 상태를 DB에서 읽는다 — 종목과 무관한 전역 값이다.
 *
 * - 기관(13F): cusip-map 전수 한 바퀴 표식 **그리고** sec-13f 초기 백필 완료 표식이 모두 있어야 `ready`.
 * - 공매도(FINRA): 플래그가 켜져 있고 두 테이블 중 한 곳에 행이 있으며 유니버스가 다 찼고 1회 재수집 요청
 *   (`finra_rebackfill_pending`)이 없으면 `ready`, 아니면 `collecting`. 꺼져 있으면 FINRA 쪽은 읽지 않는다.
 * - FTD: 반월 파일이 하나라도 저장됐으면 `ready`.
 * - Form 144·증자 공시: 공시 커서(`sec_filings_cursor`)가 오늘에서 며칠 안까지 따라잡았으면 `ready`.
 * - 과열 목록: 플래그가 켜져 있고 목록을 받은 거래일이 하나라도 있으면 `ready`. 꺼져 있으면 읽지 않는다.
 * - DART(한국): 키가 있고 초기 백필 표식(`dart_backfill_done`)이 있으면 `ready`. 키가 없으면 읽지 않고 `unknown`.
 *
 * 인프라 실패는 **그대로 던진다** — 호출부(`getInvestorFlowsPipelineReadiness`)가 `unknown`으로 바꾸므로, 장애가
 * "수집 중"으로 보이지도 TTL 동안 캐시에 굳지도 않는다.
 */
export async function loadInvestorFlowsPipelineReadiness(
    deps: PipelineReadinessDeps
): Promise<InvestorFlowsPipelineReadiness> {
    const finraEnabled = deps.isFinraEnabled();
    const regShoEnabled = deps.isRegShoEnabled();
    const dartEnabled = deps.isDartEnabled();
    const today = toUtcIsoDate(deps.now());
    const [
        universe,
        backfill,
        hasAnyRow,
        hasAnyFtdFile,
        filingsCursor,
        thresholdDates,
        dartBackfill,
        finraRebackfill,
    ] = await Promise.all([
        deps.getState(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE),
        deps.getState(INVESTOR_FLOWS_STATE_BACKFILL_DONE),
        finraEnabled ? deps.hasAnyShortRow() : Promise.resolve(false),
        deps.hasAnyFtdFile(),
        deps.getState(INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR),
        regShoEnabled ? deps.listThresholdTradeDates() : Promise.resolve([]),
        dartEnabled
            ? deps.getState(INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE)
            : Promise.resolve(null),
        finraEnabled
            ? deps.getState(INVESTOR_FLOWS_STATE_FINRA_REBACKFILL)
            : Promise.resolve(null),
    ]);
    return {
        institutional: deriveInstitutionalStatus({
            universeComplete: universe !== null,
            backfillDone: backfill !== null,
        }),
        short: deriveShortStatus({
            finraEnabled,
            hasAnyRow,
            universeComplete: universe !== null,
            rebackfillPending: finraRebackfill !== null,
        }),
        failsToDeliver: deriveFtdStatus(hasAnyFtdFile),
        filings: deriveFilingsStatus(filingsCursor, today),
        thresholdList: deriveThresholdListStatus({
            regShoEnabled,
            hasIngestedDate: thresholdDates.length > 0,
        }),
        dart: deriveDartStatus({
            dartEnabled,
            backfillDone: dartBackfill !== null,
        }),
    };
}
