import type { PortfolioHoldingRecord } from '@/shared/db/types';
import type { PortfolioHoldingView } from '../model';

export function toView(r: PortfolioHoldingRecord): PortfolioHoldingView {
    return {
        symbol: r.symbol,
        companyName: r.companyName,
        fmpSymbol: r.fmpSymbol,
        quantity: r.quantity,
        averagePrice: r.averagePrice,
        updatedAt: r.updatedAt.toISOString(),
    };
}
