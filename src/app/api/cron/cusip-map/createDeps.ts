import 'server-only';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';
import { fetchFmpProfileIdentifiers } from '@/shared/api/fmp/profileIdentifiersClient';
import {
    mapCusipsToTickers,
    OpenFigiRateLimitedError,
} from '@/shared/api/openfigi/openFigiClient';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { createRedisCusipMissStore } from '@/entities/investor-flows/api/cusipMissStore';
import { DrizzleInvestorFlowsUniverseRepository } from '@/entities/investor-flows/api/investorFlowsUniverseRepository';
import type { SyncCusipMapDeps } from '@/entities/investor-flows/server/syncCusipMap';

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
        fetchProfile: fetchFmpProfileIdentifiers,
        mapCusipsToTickers,
        isRateLimitError: error =>
            (error instanceof FmpHttpError &&
                error.status === HTTP_TOO_MANY_REQUESTS) ||
            error instanceof OpenFigiRateLimitedError,
        isDeadlineReached,
        now: () => new Date(),
        log: (message, detail) => console.warn(message, detail),
    };
}
