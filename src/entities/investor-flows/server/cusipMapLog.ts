import type { CusipConflict } from '../lib/cusipMapConflicts';
import { CUSIP_MAP_TRANSIENT_OUTAGE_CHUNKS } from '../lib/cusipMapPlan';
import type { SyncCusipMapDeps } from './syncCusipMapTypes';

/** 중복 CUSIP 로그에 싣는 예시 수 — 경로(후보·재대조)마다 실행당 한 줄로 남긴다. */
const CONFLICT_LOG_EXAMPLES = 5;

/** 한 경로의 중복 CUSIP을 한 줄로 남긴다(없으면 남기지 않는다). `note`는 버린 심볼을 어떻게 다뤘는지다. */
export function logConflicts(
    deps: Pick<SyncCusipMapDeps, 'log'>,
    conflicts: readonly CusipConflict[],
    note: string
): void {
    if (conflicts.length === 0) return;
    const droppedSymbols = conflicts.reduce(
        (total, conflict) => total + conflict.dropped.length,
        0
    );
    deps.log(
        `[cusip-map] ${conflicts.length} CUSIP(s) claimed by more than one symbol — kept one symbol each, dropped ${droppedSymbols} (${note}), e.g.:`,
        conflicts.slice(0, CONFLICT_LOG_EXAMPLES)
    );
}

/** FMP 일시 장애로 실행을 접을 때 한 줄을 남긴다 — `phase`는 어느 단계의 묶음이 연달아 실패했는지다. */
export function logTransientOutage(
    deps: Pick<SyncCusipMapDeps, 'log'>,
    phase: 'profile' | 'recheck'
): void {
    deps.log(
        `[cusip-map] FMP transient outage: ${CUSIP_MAP_TRANSIENT_OUTAGE_CHUNKS} consecutive ${phase} chunks failed entirely — run stopped, failures not counted, next run retries`
    );
}
