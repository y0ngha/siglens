import { initialFinraRebackfillValue } from '../lib/finraRebackfill';
import {
    INVESTOR_FLOWS_STATE_FINRA_REBACKFILL,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
    INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED,
} from '../lib/investorFlowsPolicy';
import type { SyncCusipMapDeps } from './syncCusipMapTypes';

/** 표식이 아직 없고 맵이 충분히 찼으면 세운다. 새로 세웠으면 true. */
export async function markUniverseComplete(
    deps: SyncCusipMapDeps
): Promise<boolean> {
    const key = INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE;
    if ((await deps.repo.getState(key)) !== null) return false;
    const mapped = await deps.repo.countMapped();
    if (mapped < INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED) {
        deps.log(
            `[cusip-map] no candidates left but only ${mapped} CUSIPs mapped (< ${INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED}) — universe not marked complete`
        );
        return false;
    }
    // FINRA 재수집 요청을 **먼저** 남긴다 — finra-short는 수집 시점의 유니버스 심볼만 저장해, 유니버스가 차기 전에 읽은 파일은
    // 나중에 매핑된 심볼의 행을 영영 갖지 못한다. 완료 표식보다 먼저 써야 둘 사이에서 실행이 죽어도 다음 실행이 다시 남긴다
    // (그때 두 번 남겨도 재수집이 한 번 더 돌 뿐이다 — upsert는 멱등).
    await deps.repo.setStateIfAbsent(
        INVESTOR_FLOWS_STATE_FINRA_REBACKFILL,
        initialFinraRebackfillValue(deps.now())
    );
    await deps.repo.setStateIfAbsent(key, deps.now().toISOString());
    deps.log(
        `[cusip-map] full pass complete (${mapped} CUSIPs mapped) — sec-13f ingestion unlocked, FINRA re-ingest requested`
    );
    return true;
}
