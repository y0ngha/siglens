import {
    INVESTOR_FLOWS_AGGREGATE_RETENTION_MONTHS,
    INVESTOR_FLOWS_STATE_BACKFILL_DONE,
} from '../lib/investorFlowsPolicy';
import {
    addDays,
    latestQuarterEndOnOrBefore,
    positionsRetentionFloor,
} from '../lib/investorFlowsDates';
import type { Ingest13fDeps, Ingest13fResult } from './ingest13fTypes';

/** 제출 원장 보존(일). 멱등 판정은 daily index 범위(200일)만 보면 되고, 실패 재시도 여유를 더한다. */
const FILING_LEDGER_RETENTION_DAYS = 800;
const STATE_POSITIONS_FLOOR = 'sec13f_positions_pruned_floor';
const STATE_DATE_PRUNE_DAY = 'sec13f_date_prunes_day';

/**
 * 초기 백필 완료 표식을 세운다(set-once, 다시 지우지 않는다). 날짜 순회가 마감·차단 없이 **오늘까지** 끝났고(`complete`)
 * 원장에 처리된 제출이 하나라도 있을 때만 선다 — SEC가 계속 빈 응답을 주는 환경에서 아무것도 모으지 못하고 "완료"가
 * 되는 것을 막는다. dirty 큐가 비어 있어야 한다(`takeDirty` null). 커서가 항상 앞으로만 가므로(`max(filing_date)` − 겹침) 한 번 오늘에 닿은 실행은 백필 창 전체를
 * 지난 것이다. 새로 세웠으면 `true`.
 */
export async function markBackfillDone(deps: Ingest13fDeps): Promise<boolean> {
    const { repo } = deps;
    if ((await repo.getState(INVESTOR_FLOWS_STATE_BACKFILL_DONE)) !== null)
        return false;
    if ((await repo.latestFilingDate()) === null) return false;
    // dirty 큐가 남아 있으면 일부 종목의 집계가 아직 반영 전이다. `takeDirty`는 실제 dirty 행을 점유하거나 지우지 않지만 순수한
    // 읽기는 아니다 — cusip_symbol_map에 없는 id만 남은 고아 dirty 행은 정리(삭제)한다. 읽기 전용 트랜잭션으로 감싸지 말 것.
    if ((await repo.takeDirty(1)) !== null) return false;
    await repo.setState(INVESTOR_FLOWS_STATE_BACKFILL_DONE, 'done');
    deps.log('[sec-13f] initial backfill complete');
    return true;
}

/**
 * 보존 정책: 포지션은 하한 이전 삭제(**하한이 움직였을 때만**, 배치로), 집계 36개월·원장 800일은
 * 하루에 한 번. 마지막으로 정리한 값은 `investor_flows_state`에 둔다 — 정리가 시간 상자에 걸려 못 끝났으면 기록하지
 * 않아 다음 실행이 이어 간다.
 */
export async function pruneRetention(
    deps: Ingest13fDeps,
    today: string,
    shouldStop: () => boolean
): Promise<Ingest13fResult['pruned']> {
    const { repo } = deps;
    const pruned = { positions: 0, aggregates: 0, filings: 0 };
    const floor = positionsRetentionFloor(today);
    const lastFloor = await repo.getState(STATE_POSITIONS_FLOOR);
    if (lastFloor === null || lastFloor < floor) {
        const result = await repo.prunePositionsBefore(floor, shouldStop);
        pruned.positions = result.deleted;
        if (result.done) await repo.setState(STATE_POSITIONS_FLOOR, floor);
    }
    if ((await repo.getState(STATE_DATE_PRUNE_DAY)) !== today) {
        const aggregateCutoff = latestQuarterEndOnOrBefore(
            addDays(
                today,
                -Math.round(INVESTOR_FLOWS_AGGREGATE_RETENTION_MONTHS * 30.5)
            )
        );
        pruned.aggregates = await repo.pruneAggregatesBefore(aggregateCutoff);
        pruned.filings = await repo.pruneFilingsBefore(
            addDays(today, -FILING_LEDGER_RETENTION_DAYS)
        );
        await repo.setState(STATE_DATE_PRUNE_DAY, today);
    }
    return pruned;
}
