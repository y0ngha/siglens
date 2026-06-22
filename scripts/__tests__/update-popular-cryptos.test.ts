import { describe, expect, it } from 'vitest';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import {
    CRYPTO_CANDIDATE_POOL,
    FILE_HEADER,
    MAX_POPULAR_CRYPTOS,
    STABLECOINS,
    filterValidCandidates,
    formatMarketCap,
    rankByMarketCap,
    renderPopularCryptosFile,
} from '../update-popular-cryptos';

describe('filterValidCandidates', () => {
    it('keeps symbols present in the crypto list, drops absent ones', () => {
        const pool = ['BTCUSD', 'ETHUSD', 'MATICUSD', 'POLUSD'];
        const cryptoList = [
            { symbol: 'BTCUSD', name: 'Bitcoin', circulatingSupply: null },
            { symbol: 'ETHUSD', name: 'Ethereum', circulatingSupply: null },
            { symbol: 'POLUSD', name: 'Polygon', circulatingSupply: null },
            // MATICUSD is absent — simulates delisted/renamed symbol
        ];

        const result = filterValidCandidates(pool, cryptoList);

        expect(result.valid).toEqual(['BTCUSD', 'ETHUSD', 'POLUSD']);
        expect(result.dropped).toEqual(['MATICUSD']);
    });

    it('returns empty valid list when pool is empty', () => {
        const result = filterValidCandidates(
            [],
            [{ symbol: 'BTCUSD', name: 'Bitcoin', circulatingSupply: null }]
        );

        expect(result.valid).toEqual([]);
        expect(result.dropped).toEqual([]);
    });

    it('drops every pool entry when crypto list is empty', () => {
        const pool = ['BTCUSD', 'ETHUSD'];
        const result = filterValidCandidates(pool, []);

        expect(result.valid).toEqual([]);
        expect(result.dropped).toEqual(['BTCUSD', 'ETHUSD']);
    });

    it('is case-insensitive on the crypto list symbols', () => {
        const pool = ['BTCUSD'];
        // FMP occasionally returns mixed-case symbols
        const cryptoList = [
            { symbol: 'btcusd', name: 'Bitcoin', circulatingSupply: null },
        ];

        const result = filterValidCandidates(pool, cryptoList);

        expect(result.valid).toEqual(['BTCUSD']);
        expect(result.dropped).toEqual([]);
    });

    it('preserves the original pool order in the valid list', () => {
        const pool = ['SOLUSD', 'BTCUSD', 'ETHUSD'];
        const cryptoList = pool.map(symbol => ({
            symbol,
            name: symbol,
            circulatingSupply: null,
        }));

        const result = filterValidCandidates(pool, cryptoList);

        expect(result.valid).toEqual(['SOLUSD', 'BTCUSD', 'ETHUSD']);
    });
});

describe('rankByMarketCap', () => {
    it('sorts entries by marketCap descending and slices to topN', () => {
        const entries = [
            { symbol: 'ADAUSD', marketCap: 100_000_000 },
            { symbol: 'BTCUSD', marketCap: 1_000_000_000_000 },
            { symbol: 'ETHUSD', marketCap: 400_000_000_000 },
            { symbol: 'SOLUSD', marketCap: 80_000_000_000 },
        ];

        const result = rankByMarketCap(entries, 3);

        expect(result).toHaveLength(3);
        expect(result.map(e => e.symbol)).toEqual([
            'BTCUSD',
            'ETHUSD',
            'SOLUSD',
        ]);
    });

    it('excludes entries with zero or negative marketCap', () => {
        const entries = [
            { symbol: 'BTCUSD', marketCap: 1_000_000_000_000 },
            { symbol: 'ZEROUSD', marketCap: 0 },
            { symbol: 'NEGATIVEUSD', marketCap: -1 },
        ];

        const result = rankByMarketCap(entries, 10);

        expect(result).toHaveLength(1);
        expect(result[0]!.symbol).toBe('BTCUSD');
    });

    it('returns fewer than topN when not enough valid entries exist', () => {
        const entries = [{ symbol: 'BTCUSD', marketCap: 1_000_000_000_000 }];

        const result = rankByMarketCap(entries, 15);

        expect(result).toHaveLength(1);
    });

    it('returns empty array when all entries have zero marketCap', () => {
        const entries = [
            { symbol: 'DEADUSD', marketCap: 0 },
            { symbol: 'NULLUSD', marketCap: 0 },
        ];

        expect(rankByMarketCap(entries, 5)).toEqual([]);
    });

    it('does not mutate the original entries array', () => {
        const entries = [
            { symbol: 'ETHUSD', marketCap: 400_000_000_000 },
            { symbol: 'BTCUSD', marketCap: 1_000_000_000_000 },
        ];
        const originalOrder = entries.map(e => e.symbol);

        rankByMarketCap(entries, 10);

        expect(entries.map(e => e.symbol)).toEqual(originalOrder);
    });
});

describe('renderPopularCryptosFile', () => {
    it('renders the exact file content with header and as const', () => {
        const result = renderPopularCryptosFile(['BTCUSD', 'ETHUSD', 'SOLUSD']);

        expect(result).toBe(
            `${FILE_HEADER}\nexport const POPULAR_CRYPTOS = [\n    'BTCUSD',\n    'ETHUSD',\n    'SOLUSD',\n] as const;\n`
        );
    });

    it('renders an empty array when no symbols are provided', () => {
        const result = renderPopularCryptosFile([]);

        expect(result).toContain(
            'export const POPULAR_CRYPTOS = [\n] as const;'
        );
    });

    it('produces a valid TypeScript const assertion', () => {
        const result = renderPopularCryptosFile(['XRPUSD']);

        expect(result).toContain('] as const;');
    });

    it('renders exactly the passed symbols in the exact order', () => {
        // Order matters — this is market-cap rank order
        const symbols = ['BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD', 'XRPUSD'];
        const result = renderPopularCryptosFile(symbols);

        const lines = result.split('\n').filter(l => l.trim().startsWith("'"));

        expect(lines).toEqual([
            "    'BTCUSD',",
            "    'ETHUSD',",
            "    'BNBUSD',",
            "    'SOLUSD',",
            "    'XRPUSD',",
        ]);
    });
});

describe('CRYPTO_CANDIDATE_POOL', () => {
    it('contains all current POPULAR_CRYPTOS symbols', () => {
        expect(CRYPTO_CANDIDATE_POOL).toEqual(
            expect.arrayContaining([...POPULAR_CRYPTOS])
        );
    });

    it('has no duplicate symbols', () => {
        const unique = new Set(CRYPTO_CANDIDATE_POOL);

        expect(unique.size).toBe(CRYPTO_CANDIDATE_POOL.length);
    });

    it('contains more symbols than MAX_POPULAR_CRYPTOS (to allow ranking)', () => {
        expect(CRYPTO_CANDIDATE_POOL.length).toBeGreaterThan(
            MAX_POPULAR_CRYPTOS
        );
    });

    it('all symbols end with USD', () => {
        expect(CRYPTO_CANDIDATE_POOL.every(s => s.endsWith('USD'))).toBe(true);
    });
});

describe('MAX_POPULAR_CRYPTOS', () => {
    it('matches the current popular-cryptos.ts list size', () => {
        expect(MAX_POPULAR_CRYPTOS).toBe(POPULAR_CRYPTOS.length);
    });
});

describe('formatMarketCap', () => {
    it('formats values >= 1T with T suffix and two decimals', () => {
        expect(formatMarketCap(1_300_000_000_000)).toBe('$1.30T');
        expect(formatMarketCap(1_000_000_000_000)).toBe('$1.00T');
    });

    it('formats values >= 1B (but < 1T) with B suffix and two decimals', () => {
        expect(formatMarketCap(500_000_000_000)).toBe('$500.00B');
        expect(formatMarketCap(1_000_000_000)).toBe('$1.00B');
    });

    it('formats values >= 1M (but < 1B) with M suffix and two decimals', () => {
        expect(formatMarketCap(42_000_000)).toBe('$42.00M');
        expect(formatMarketCap(1_000_000)).toBe('$1.00M');
    });

    it('formats sub-million values as integer dollars', () => {
        expect(formatMarketCap(999_999)).toBe('$999999');
        expect(formatMarketCap(1.5)).toBe('$2');
    });
});

describe('stablecoin exclusion', () => {
    it('filterValidCandidates drops stablecoins even when present in the crypto list', () => {
        const pool = ['BTCUSD', 'USDTUSD', 'USDCUSD', 'ETHUSD', 'DAIUSD'];
        const cryptoList = pool.map(symbol => ({
            symbol,
            name: symbol,
            circulatingSupply: null,
        }));

        const { valid, dropped } = filterValidCandidates(pool, cryptoList);

        expect(valid).toEqual(['BTCUSD', 'ETHUSD']);
        expect(dropped).toEqual(['USDTUSD', 'USDCUSD', 'DAIUSD']);
    });

    it('STABLECOINS set contains USDT, USDC, DAI and other known pegged coins', () => {
        expect(STABLECOINS.has('USDT')).toBe(true);
        expect(STABLECOINS.has('USDC')).toBe(true);
        expect(STABLECOINS.has('DAI')).toBe(true);
    });

    it('CRYPTO_CANDIDATE_POOL does not contain USDTUSD or USDCUSD', () => {
        expect(CRYPTO_CANDIDATE_POOL).not.toContain('USDTUSD');
        expect(CRYPTO_CANDIDATE_POOL).not.toContain('USDCUSD');
    });
});
