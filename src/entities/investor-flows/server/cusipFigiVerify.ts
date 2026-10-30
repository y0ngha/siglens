import { MISS_TTL_SECONDS } from '../api/cusipMissStore';
import type { CusipMapRow } from '../api/investorFlowsUniverseRepository';
import { figiTickersMatchSymbol } from '../lib/cusip';
import { upsertCandidates } from './cusipProfileSync';
import type { SyncRun } from './syncCusipMapTypes';

/**
 * OpenFIGI 검증 — ISIN에서 낸 CUSIP이 **같은 티커**로 해석될 때만 `openfigi` 출처로 받아들인다(OpenFIGI는 CUSIP→티커만 풀 수
 * 있어 "발견"이 아니라 "검증" 역할이다). 다른 티커로 해석되면 miss, 이번 실행에서 확인 못 한 것은 표식 없이 다음 실행에 남긴다.
 * 속도 제한은 다음 실행으로 미루고, 그 밖의 장애는 후보별 연속 실패로 센다 — 일시 장애는 임계 전에 풀려 다시 시도되고, 영구
 * 장애는 임계 뒤 miss로 빠져 전수 한 바퀴를 막지 않는다.
 */
export async function verifyWithFigi(run: SyncRun): Promise<void> {
    const { deps, result, figiCandidates } = run;
    if (figiCandidates.length === 0 || result.status === 'rate_limited') return;
    try {
        const resolved = await deps.mapCusipsToTickers(
            figiCandidates.map(candidate => candidate.cusip),
            deps.isDeadlineReached
        );
        const verified: CusipMapRow[] = [];
        for (const { symbol, cusip } of figiCandidates) {
            const tickers = resolved.get(cusip);
            if (tickers === undefined) continue; // 이번 실행에선 확인 못 함 — 다음에 재시도
            if (figiTickersMatchSymbol(tickers, symbol)) {
                verified.push({ cusip, symbol, source: 'openfigi' });
            } else {
                run.newMisses.push({
                    symbol,
                    ttlSeconds: MISS_TTL_SECONDS.figiMismatch,
                });
            }
        }
        if (verified.length > 0) {
            result.fromFigi += (await upsertCandidates(run, verified)).length;
        }
    } catch (error) {
        deps.log('[cusip-map] OpenFIGI verification stopped:', error);
        if (!deps.isRateLimitError(error)) {
            result.errors += 1;
            run.failedFigi.push(...figiCandidates.map(c => c.symbol));
        }
    }
}
