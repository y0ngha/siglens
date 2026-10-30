import { MISS_TTL_SECONDS } from '../api/cusipMissStore';
import type { CusipMapRow } from '../api/investorFlowsUniverseRepository';
import {
    CUSIP_MAP_TRANSIENT_OUTAGE_CHUNKS,
    PROFILE_CONCURRENCY,
    classifyProfile,
    isTransientOutageChunk,
    mappingKey,
} from '../lib/cusipMapPlan';
import { logTransientOutage } from './cusipMapLog';
import type { SyncRun } from './syncCusipMapTypes';

/**
 * 후보(맵에 없는 심볼) 쓰기의 공통 처리: 버린 심볼은 miss로 후보에서 뺀다 — 남겨 두면 매 실행 다시 조회되고(맵에는 끝내
 * 못 들어간다) 후보가 0이 되지 않아 전수 한 바퀴 표식이 서지 않는다. 실제로 쓴 행을 돌려준다.
 */
export async function upsertCandidates(
    run: SyncRun,
    rows: readonly CusipMapRow[]
): Promise<CusipMapRow[]> {
    const upserted = await run.deps.repo.upsertCusipMap(rows);
    run.conflicts.push(...upserted.conflicts);
    run.newMisses.push(
        ...upserted.conflicts.flatMap(conflict =>
            conflict.dropped.map(symbol => ({
                symbol,
                ttlSeconds: MISS_TTL_SECONDS.duplicateCusip,
            }))
        )
    );
    return upserted.written;
}

/**
 * FMP profile 조회 — `PROFILE_CONCURRENCY`씩 청크로 보내고(시작 간격은 페이서가 벌린다) 청크마다 DB에 쓴다. 속도 제한(429)이면
 * `rate_limited`, 마감이면 `deadline`, 묶음이 연달아 일시 오류로 전부 실패하면 `transient_outage`로 접는다.
 */
export async function syncProfiles(
    run: SyncRun,
    candidates: readonly string[]
): Promise<void> {
    const { deps, result } = run;
    let outageChunks = 0;
    for (let i = 0; i < candidates.length; i += PROFILE_CONCURRENCY) {
        if (deps.isDeadlineReached()) {
            result.status = 'deadline';
            break;
        }
        const chunk = candidates.slice(i, i + PROFILE_CONCURRENCY);
        // 묶음 시작 간격은 앞 묶음에 의존해 직렬이다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await run.paceFmp(chunk.length);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const settled = await Promise.allSettled(
            chunk.map(symbol => deps.fetchProfile(symbol))
        );
        const rows: CusipMapRow[] = [];
        let stop = false;
        settled.forEach((outcome, index) => {
            const symbol = chunk[index] as string;
            if (outcome.status === 'rejected') {
                if (deps.isRateLimitError(outcome.reason)) stop = true;
                else {
                    run.profileAttempts += 1;
                    result.errors += 1;
                    run.failedProfiles.push(symbol);
                    deps.log(
                        `[cusip-map] profile failed ${symbol}:`,
                        outcome.reason
                    );
                }
                return;
            }
            run.profileAttempts += 1;
            const classified = classifyProfile(outcome.value);
            if (classified.kind === 'miss') {
                run.newMisses.push({
                    symbol,
                    ttlSeconds: MISS_TTL_SECONDS[classified.reason],
                });
            } else if (classified.kind === 'fmp') {
                rows.push({ cusip: classified.cusip, symbol, source: 'fmp' });
            } else {
                run.figiCandidates.push({ symbol, cusip: classified.cusip });
            }
        });
        if (rows.length > 0) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const written = await upsertCandidates(run, rows);
            result.fromProfile += written.length;
            for (const row of written)
                run.mappedFromProfile.add(mappingKey(row));
        }
        if (stop) {
            result.status = 'rate_limited';
            break;
        }
        outageChunks = isTransientOutageChunk(settled, deps)
            ? outageChunks + 1
            : 0;
        if (outageChunks >= CUSIP_MAP_TRANSIENT_OUTAGE_CHUNKS) {
            result.status = 'transient_outage';
            logTransientOutage(deps, 'profile');
            break;
        }
    }
}
