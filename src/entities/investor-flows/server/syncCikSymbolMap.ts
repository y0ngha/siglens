import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { addDays } from '../lib/investorFlowsDates';
import {
    INVESTOR_FLOWS_CIK_MAP_MIN_PAIRS,
    INVESTOR_FLOWS_CIK_MAP_REFRESH_DAYS,
    INVESTOR_FLOWS_STATE_CIK_MAP_SYNCED,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../lib/investorFlowsPolicy';
import { parseCompanyTickers, type CikSymbolPair } from '../lib/companyTickers';
import type { CikMapReplaceResult } from '../api/investorFlowsFilingsRepository';

export interface SyncCikSymbolMapDeps {
    /** `www.sec.gov/files/company_tickers.json` 본문(JSON). 없으면 null. */
    fetchCompanyTickers: () => Promise<unknown | null>;
    repo: {
        getState(key: string): Promise<string | null>;
        setState(key: string, value: string): Promise<void>;
        replaceCikSymbolMap(
            pairs: readonly CikSymbolPair[]
        ): Promise<CikMapReplaceResult>;
    };
    loadUniverseSymbols: () => Promise<string[]>;
    isSecBlockedError: (error: unknown) => boolean;
    now: () => Date;
    log: (message: string, detail?: unknown) => void;
}

export interface SyncCikSymbolMapResult {
    status:
        | 'fresh'
        | 'universe_incomplete'
        | 'synced'
        | 'missing'
        | 'too_small'
        | 'sec_blocked'
        | 'failed';
    pairs: number;
    deleted: number;
}

const result = (
    status: SyncCikSymbolMapResult['status'],
    pairs = 0,
    deleted = 0
): SyncCikSymbolMapResult => ({ status, pairs, deleted });

/**
 * SEC CIK → 유니버스 심볼 맵(`sec_cik_symbol_map`)을 **주 1회** 갱신한다 — cusip-map cron(매일) 뒤에 붙어 돌고, 마지막 갱신에서
 * `INVESTOR_FLOWS_CIK_MAP_REFRESH_DAYS`(7일)이 지나지 않았으면 요청 없이 끝난다(`fresh`). Form 144·증자 공시 index 줄의 사전
 * 필터라, 유니버스가 전수 한 바퀴를 끝내기 전(덜 찬 유니버스로 만든 맵이 7일 동안 굳는 것)에는 만들지 않는다.
 *
 * 결과가 `INVESTOR_FLOWS_CIK_MAP_MIN_PAIRS`보다 적으면 맵을 바꾸지 않는다(형식 변경·빈 유니버스로 맵이 비는 것을 막는다).
 * **던지지 않는다** — 같은 실행의 CUSIP 매핑 결과 로그를 가리지 않도록 오류는 로그를 남기고 `failed`로 돌려준다(SA-4).
 */
export async function runCikSymbolMapSync(
    deps: SyncCikSymbolMapDeps
): Promise<SyncCikSymbolMapResult> {
    try {
        const today = toUtcIsoDate(deps.now());
        const syncedOn = await deps.repo.getState(
            INVESTOR_FLOWS_STATE_CIK_MAP_SYNCED
        );
        if (
            syncedOn !== null &&
            today < addDays(syncedOn, INVESTOR_FLOWS_CIK_MAP_REFRESH_DAYS)
        ) {
            return result('fresh');
        }
        if (
            (await deps.repo.getState(
                INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE
            )) === null
        ) {
            return result('universe_incomplete');
        }
        const json = await deps.fetchCompanyTickers();
        if (json === null) {
            deps.log('[cusip-map] company_tickers.json missing (404)');
            return result('missing');
        }
        const pairs = parseCompanyTickers(
            json,
            await deps.loadUniverseSymbols()
        );
        if (pairs.length < INVESTOR_FLOWS_CIK_MAP_MIN_PAIRS) {
            deps.log(
                `[cusip-map] cik map not replaced — only ${pairs.length} universe pairs in company_tickers.json`
            );
            return result('too_small', pairs.length);
        }
        const replaced = await deps.repo.replaceCikSymbolMap(pairs);
        await deps.repo.setState(INVESTOR_FLOWS_STATE_CIK_MAP_SYNCED, today);
        return result('synced', replaced.upserted, replaced.deleted);
    } catch (error) {
        if (deps.isSecBlockedError(error)) {
            deps.log(
                '[cusip-map] cik map sync sec_blocked — SEC refused company_tickers.json'
            );
            return result('sec_blocked');
        }
        deps.log(
            '[cusip-map] cik map sync failed:',
            error instanceof Error ? error.message : error
        );
        return result('failed');
    }
}
