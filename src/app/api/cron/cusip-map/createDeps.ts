import 'server-only';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';
import { isFmpTransientError } from '@/shared/api/fmp/fmpRetry';
import { fetchFmpProfileIdentifiers } from '@/shared/api/fmp/profileIdentifiersClient';
import {
    mapCusipsToTickers,
    OpenFigiRateLimitedError,
} from '@/shared/api/openfigi/openFigiClient';
import { fetchSecFile, isSecBlockedError } from '@/shared/api/sec/secClient';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { sleep } from '@/shared/lib/sleep';
import { warnWithDetail } from '@/shared/lib/warnWithDetail';
import { createRedisCusipMissStore } from '@/entities/investor-flows/api/cusipMissStore';
import { DrizzleSecFilingsRepository } from '@/entities/investor-flows/api/investorFlowsFilingsRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '@/entities/investor-flows/api/investorFlowsUniverseRepository';
import type { SyncCikSymbolMapDeps } from '@/entities/investor-flows/server/syncCikSymbolMap';
import type { SyncCusipMapDeps } from '@/entities/investor-flows/server/syncCusipMapTypes';

/** SEC CIK ↔ 티커 목록(`www.sec.gov/files/company_tickers.json`, ≈0.8MB). */
export const COMPANY_TICKERS_PATH = '/files/company_tickers.json';

const HTTP_TOO_MANY_REQUESTS = 429;

/** I/O 구성은 이 호출자에 둔다(EN-1). DB가 없으면 던진다. */
export function createCusipMapDeps(
    isDeadlineReached: () => boolean
): SyncCusipMapDeps {
    const client = tryGetDatabaseClient();
    if (client === null) throw new Error('[cusip-map] database unavailable');
    return {
        repo: new DrizzleInvestorFlowsUniverseRepository(client.db),
        misses: createRedisCusipMissStore(),
        // 내부 일시 오류 재시도를 끈다 — 호출 하나 = HTTP 시도 하나라야 페이서(분당 120건)가 실제 요청 수를 묶는다
        // (`CUSIP_MAP_FMP_CALLS_PER_MINUTE`). 실패는 실행 단위로 다룬다(다음 실행 재시도·장애 조기 종료).
        fetchProfile: symbol =>
            fetchFmpProfileIdentifiers(symbol, { retryTransient: false }),
        mapCusipsToTickers,
        isRateLimitError: error =>
            (error instanceof FmpHttpError &&
                error.status === HTTP_TOO_MANY_REQUESTS) ||
            error instanceof OpenFigiRateLimitedError,
        isTransientError: isFmpTransientError,
        isDeadlineReached,
        now: () => new Date(),
        sleep,
        log: warnWithDetail,
    };
}

/** `company_tickers.json`을 받아 JSON으로 읽는다. 없으면 null(깨진 JSON은 던진다 — `runCikSymbolMapSync`가 `failed`로 받는다). */
async function fetchCompanyTickers(): Promise<unknown | null> {
    const bytes = await fetchSecFile(COMPANY_TICKERS_PATH);
    if (bytes === null) return null;
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    return parsed;
}

/** `sec_cik_symbol_map` 주간 갱신의 의존(EN-1). DB가 없으면 던진다. */
export function createCikSymbolMapDeps(): SyncCikSymbolMapDeps {
    const client = tryGetDatabaseClient();
    if (client === null) throw new Error('[cusip-map] database unavailable');
    const universeRepo = new DrizzleInvestorFlowsUniverseRepository(client.db);
    const log = warnWithDetail;
    return {
        fetchCompanyTickers,
        repo: new DrizzleSecFilingsRepository(client.db, log),
        loadUniverseSymbols: async () =>
            (await universeRepo.loadUniverse()).symbols,
        isSecBlockedError,
        now: () => new Date(),
        log,
    };
}
