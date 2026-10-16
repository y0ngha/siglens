import 'server-only';
import {
    fetchCnmsShortVolumeText,
    fetchShortInterestText,
} from '@/shared/api/finra/finraClient';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import { warnWithDetail } from '@/shared/lib/warnWithDetail';
import { revalidateFlowsReadiness } from '../revalidateFlowsReadiness';
import { revalidateSymbols } from '../revalidateSymbols';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { DrizzleInvestorFlowsShortRepository } from '@/entities/investor-flows/api/investorFlowsShortRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '@/entities/investor-flows/api/investorFlowsUniverseRepository';
import type { IngestFinraDeps } from '@/entities/investor-flows/server/ingestFinra';

/** I/O 구성은 이 호출자에 둔다(EN-1). DB가 없으면 던진다. */
export function createFinraShortDeps(
    isDeadlineReached: () => boolean
): IngestFinraDeps {
    const client = tryGetDatabaseClient();
    if (client === null) throw new Error('[finra-short] database unavailable');
    const universeRepo = new DrizzleInvestorFlowsUniverseRepository(client.db);
    return {
        isEnabled: isFinraShortDataEnabled,
        loadUniverseSymbols: async () =>
            (await universeRepo.loadUniverse()).symbols,
        finra: { fetchCnmsShortVolumeText, fetchShortInterestText },
        repo: new DrizzleInvestorFlowsShortRepository(client.db),
        now: () => new Date(),
        isDeadlineReached,
        invalidateSymbols: symbols => revalidateSymbols(symbols),
        onFirstDataStored: revalidateFlowsReadiness,
        log: warnWithDetail,
    };
}
