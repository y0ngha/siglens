import { MAX_SYMBOLS_PER_RUN } from '../lib/cusipMapPlan';
import type { SyncCusipMapDeps, SyncCusipMapResult } from './syncCusipMapTypes';

const CANDIDATE_PAGE_SIZE = 500;

/**
 * 후보 수집 — 티커 DB의 CUSIP 매핑이 없는 미국 심볼 중 최근 실패 표식이 없는 것만, 상한(`MAX_SYMBOLS_PER_RUN`)까지.
 * 상한에 닿으면 `result.status`를 `capped`로 둔다.
 */
export async function collectCandidates(
    deps: Pick<SyncCusipMapDeps, 'repo' | 'misses'>,
    result: SyncCusipMapResult
): Promise<string[]> {
    const candidates: string[] = [];
    let after = '';
    for (;;) {
        // 페이지는 앞 페이지의 마지막 심볼에 의존해 직렬이다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const page = await deps.repo.listUnmappedUsSymbols(
            after,
            CANDIDATE_PAGE_SIZE
        );
        if (page.length === 0) break;
        after = page[page.length - 1] as string;
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const missed = await deps.misses.findRecentMisses(page);
        for (const symbol of page) {
            if (!missed.has(symbol)) candidates.push(symbol);
        }
        if (candidates.length >= MAX_SYMBOLS_PER_RUN) {
            candidates.length = MAX_SYMBOLS_PER_RUN;
            result.status = 'capped';
            break;
        }
    }
    result.candidates = candidates.length;
    return candidates;
}
