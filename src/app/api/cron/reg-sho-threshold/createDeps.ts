import 'server-only';
import {
    fetchRegShoThresholdText,
    REG_SHO_MARKETS,
    type RegShoMarket,
} from '@/shared/api/exchange/regShoClient';
import { isRegShoThresholdDataEnabled } from '@/shared/api/exchange/regShoThresholdDataEnabled';
import { revalidateSymbols } from '../revalidateSymbols';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { DrizzleInvestorFlowsRegShoRepository } from '@/entities/investor-flows/api/investorFlowsRegShoRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '@/entities/investor-flows/api/investorFlowsUniverseRepository';
import type { IngestRegShoDeps } from '@/entities/investor-flows/server/ingestRegSho';

const isRegShoMarket = (market: string): market is RegShoMarket =>
    (REG_SHO_MARKETS as readonly string[]).includes(market);

/** I/O 구성은 이 호출자에 둔다(EN-1). DB가 없으면 던진다. */
export function createRegShoDeps(
    isDeadlineReached: () => boolean
): IngestRegShoDeps {
    const client = tryGetDatabaseClient();
    if (client === null)
        throw new Error('[reg-sho-threshold] database unavailable');
    const universeRepo = new DrizzleInvestorFlowsUniverseRepository(client.db);
    return {
        isEnabled: isRegShoThresholdDataEnabled,
        markets: REG_SHO_MARKETS,
        fetchList: (market, date) => {
            if (!isRegShoMarket(market)) {
                throw new Error(`unknown Reg SHO market ${market}`);
            }
            return fetchRegShoThresholdText(market, date);
        },
        repo: new DrizzleInvestorFlowsRegShoRepository(client.db),
        loadUniverseSymbols: async () =>
            (await universeRepo.loadUniverse()).symbols,
        now: () => new Date(),
        isDeadlineReached,
        invalidateSymbols: symbols => revalidateSymbols(symbols),
        log: (message, detail) => console.warn(message, detail),
    };
}
