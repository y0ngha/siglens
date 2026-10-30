import { MISS_TTL_SECONDS } from '../api/cusipMissStore';
import { isBlanketOutage } from '../lib/cusipMapPlan';
import { INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD } from '../lib/investorFlowsPolicy';
import type { SyncRun } from './syncCusipMapTypes';

/**
 * 이번 실행의 miss 표식과 연속 실패를 Redis에 정산한다. 전면 장애(시도 대부분이 실패)는 심볼 고유의 문제가 아니므로 세지
 * 않는다 — 실행 단위로 FMP·OpenFIGI를 따로 본다. 일시 오류로 조기 종료한 실행은 시도가 적어도(묶음 2개) 전면 장애다.
 * 임계(`INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD`)일 연속 실패한 심볼은 miss로 걸려 후보에서 빠진다.
 */
export async function settleMissesAndFailures(run: SyncRun): Promise<void> {
    const {
        deps,
        result,
        figiCandidates,
        failedProfiles,
        failedFigi,
        profileAttempts,
    } = run;
    result.misses = run.newMisses.length;
    await deps.misses.recordMisses(run.newMisses);
    const profileBlanket =
        result.status === 'transient_outage' ||
        isBlanketOutage(profileAttempts, failedProfiles.length);
    const figiBlanket = isBlanketOutage(
        figiCandidates.length,
        failedFigi.length
    );
    result.blanketOutage = profileBlanket || figiBlanket;
    if (profileBlanket) {
        deps.log(
            `[cusip-map] blanket FMP outage: ${failedProfiles.length} of ${profileAttempts} profile fetches failed — failures not counted this run`
        );
    }
    if (figiBlanket) {
        deps.log(
            `[cusip-map] blanket OpenFIGI outage: ${failedFigi.length} of ${figiCandidates.length} candidates failed — failures not counted this run`
        );
    }
    const persistent = await deps.misses.recordFailures(
        [
            ...(profileBlanket ? [] : failedProfiles),
            ...(figiBlanket ? [] : failedFigi),
        ],
        INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD,
        MISS_TTL_SECONDS.persistentError,
        deps.now().toISOString().slice(0, 10)
    );
    result.failuresMarked = persistent.length;
    if (persistent.length > 0) {
        deps.log(
            `[cusip-map] ${persistent.length} symbol(s) failed on ${INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD} separate (UTC) days — skipped for a week:`,
            persistent
        );
    }
}
