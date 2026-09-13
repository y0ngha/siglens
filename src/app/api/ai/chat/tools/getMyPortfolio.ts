import 'server-only';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';
import { getDatabaseClient } from '@/shared/db/client';
import type { ToolExecutor } from './index';

/** The signed-in user's own holdings only (R9). Quantities/prices are decimal strings in the DB. */
export const getMyPortfolioTool: ToolExecutor = async (_args, ctx) => {
    const rows = await new DrizzlePortfolioRepository(
        getDatabaseClient().db
    ).findByUser(ctx.userId);
    const holdings = await Promise.all(
        rows.map(async r => ({
            symbol: r.symbol,
            companyName: r.companyName,
            quantity: Number(r.quantity),
            averagePrice: Number(r.averagePrice),
            currency: getDescriptor(await resolveMarketProfile(r.symbol))
                .priceFormat.currency,
        }))
    );
    return {
        asOf: new Date().toISOString(),
        source: 'SIGLENS portfolio',
        count: holdings.length,
        holdings,
    };
};
