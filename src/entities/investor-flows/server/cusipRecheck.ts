import type {
    CusipMapRow,
    RecheckCandidate,
} from '../api/investorFlowsUniverseRepository';
import type { CallPacer } from '../lib/callPacer';
import { parseProfileCusip } from '../lib/cusip';
import type { CusipConflict } from '../lib/cusipMapConflicts';
import {
    CUSIP_MAP_TRANSIENT_OUTAGE_CHUNKS,
    PROFILE_CONCURRENCY,
    isTransientOutageChunk,
    mappingKey,
} from '../lib/cusipMapPlan';
import { INVESTOR_FLOWS_CUSIP_RECHECK_BATCH } from '../lib/investorFlowsPolicy';
import { logTransientOutage } from './cusipMapLog';
import type { SyncCusipMapDeps, SyncCusipMapResult } from './syncCusipMapTypes';

/**
 * 이미 저장된 `fmp` 매핑을 FMP profile의 현재 CUSIP과 대조한다(실행당 `INVESTOR_FLOWS_CUSIP_RECHECK_BATCH`개,
 * 가장 오래 안 본 것부터). 프로필 CUSIP이 **맵 어디에도 없으면**(액면병합·재상장 등으로 CUSIP이 바뀜) 새 행으로
 * 기록한다 — `created_at`이 지금이라 새 CUSIP은 직전 분기 제출을 파싱한 유니버스 스냅샷보다 늦게 매핑된 것이 되어 그 분기에
 * baseline이 없다(변화 열 NULL, `aggregateSql.ts`). 옛 행은 그대로 둔다(옛 제출은 옛 CUSIP으로 들어 있다). 이미 쌓인 포지션을
 * 다시 처리하지 않는다. 프로필을 못 읽거나 CUSIP이 없으면 건드리지 않고 `checked_at`만 갱신한다.
 *
 * 같은 실행이 방금 profile로 만든 매핑(`mappedFromProfile`)은 `checked_at`이 비어 있어 맨 앞에 오지만, 그 profile을 막 읽었으므로
 * 다시 받지 않고 대조한 것으로 기록만 한다(FMP 호출이 두 번 나가던 것을 막는다).
 *
 * 두 심볼이 같은 새 CUSIP으로 바뀌어 하나만 쓴 건을 돌려준다 — 버린 심볼은 옛 매핑을 지니므로 miss를 걸지 않는다.
 */
export async function recheckExistingMappings(
    deps: SyncCusipMapDeps,
    result: SyncCusipMapResult,
    mappedFromProfile: ReadonlySet<string>,
    paceFmp: CallPacer
): Promise<CusipConflict[]> {
    const listed = await deps.repo.listRecheckCandidates(
        INVESTOR_FLOWS_CUSIP_RECHECK_BATCH
    );
    const justMapped = listed.filter(c => mappedFromProfile.has(mappingKey(c)));
    const candidates = listed.filter(
        c => !mappedFromProfile.has(mappingKey(c))
    );
    const checkedIds: number[] = justMapped.map(c => c.id);
    const conflicts: CusipConflict[] = [];
    let outageChunks = 0;
    for (let i = 0; i < candidates.length; i += PROFILE_CONCURRENCY) {
        if (deps.isDeadlineReached()) break;
        const chunk = candidates.slice(i, i + PROFILE_CONCURRENCY);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await paceFmp(chunk.length);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const settled = await Promise.allSettled(
            chunk.map(c => deps.fetchProfile(c.symbol))
        );
        const proposed: CusipMapRow[] = [];
        let stop = false;
        settled.forEach((outcome, index) => {
            const candidate = chunk[index] as RecheckCandidate;
            if (outcome.status === 'rejected') {
                if (deps.isRateLimitError(outcome.reason)) stop = true;
                else result.errors += 1;
                return; // 대조 못 함 — checked_at을 올리지 않아 다음에 다시 본다
            }
            checkedIds.push(candidate.id);
            result.rechecked += 1;
            const current = parseProfileCusip(outcome.value?.cusip);
            if (current === null || current === candidate.cusip) return;
            proposed.push({
                cusip: current,
                symbol: candidate.symbol,
                source: 'fmp',
            });
        });
        const existing = await deps.repo.findExistingCusips(
            proposed.map(p => p.cusip)
        );
        const created = proposed.filter(p => !existing.has(p.cusip));
        if (created.length > 0) {
            // 두 심볼이 같은 새 CUSIP으로 바뀌었으면 하나만 쓴다 — 버린 쪽은 옛 매핑을 그대로 지닌다(miss 대상이 아니다).
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const upserted = await deps.repo.upsertCusipMap(created);
            conflicts.push(...upserted.conflicts);
            result.cusipChanged += upserted.written.length;
            if (upserted.written.length > 0) {
                deps.log(
                    '[cusip-map] CUSIP changed, recorded as new mapping:',
                    upserted.written
                );
            }
        }
        if (stop) break;
        outageChunks = isTransientOutageChunk(settled, deps)
            ? outageChunks + 1
            : 0;
        if (outageChunks >= CUSIP_MAP_TRANSIENT_OUTAGE_CHUNKS) {
            result.status = 'transient_outage';
            logTransientOutage(deps, 'recheck');
            break;
        }
    }
    await deps.repo.markChecked(checkedIds);
    return conflicts;
}
