import 'server-only';
import {
    fetchFailsToDeliverListing,
    fetchSecFile,
    isSecBlockedError,
} from '@/shared/api/sec/secClient';
import { revalidateSymbols } from '../revalidateSymbols';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { DrizzleInvestorFlowsFtdRepository } from '@/entities/investor-flows/api/investorFlowsFtdRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '@/entities/investor-flows/api/investorFlowsUniverseRepository';
import type { IngestFtdDeps } from '@/entities/investor-flows/server/ingestFtd';

/** I/O 구성은 이 호출자에 둔다(EN-1). DB가 없으면 던진다. */
export function createSecFtdDeps(
    isDeadlineReached: () => boolean
): IngestFtdDeps {
    const client = tryGetDatabaseClient();
    if (client === null) throw new Error('[sec-ftd] database unavailable');
    const universeRepo = new DrizzleInvestorFlowsUniverseRepository(client.db);
    return {
        sec: { fetchFailsToDeliverListing, fetchSecFile },
        repo: new DrizzleInvestorFlowsFtdRepository(client.db),
        loadUniverse: () => universeRepo.loadUniverse(),
        isSecBlockedError,
        now: () => new Date(),
        isDeadlineReached,
        invalidateSymbols: symbols => revalidateSymbols(symbols),
        log: (message, detail) => console.warn(message, detail),
    };
}
