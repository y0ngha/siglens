import 'server-only';
import { searchTicker } from '@/entities/ticker/lib/searchTicker';
import type { ToolExecutor } from './index';

const MAX_RESULTS = 8;

export const searchTickerTool: ToolExecutor = async args => {
    const results = await searchTicker(String(args.query));
    return {
        asOf: new Date().toISOString(),
        source: 'siglens ticker index',
        results: results.slice(0, MAX_RESULTS).map(r => ({
            symbol: r.symbol,
            name: r.name,
            koreanName: r.koreanName ?? null,
            exchange: r.exchange,
            marketProfile: r.marketProfile ?? null,
        })),
    };
};
