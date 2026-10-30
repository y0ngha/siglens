import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CRYPTO_SESSION,
    US_EQUITY_SESSION,
    type Bar,
    type GetBarsOptions,
} from '@y0ngha/siglens-core';
import { createMemoryLru } from '@/shared/cache/memoryLru';
import {
    EXTENDED_HISTORY_MEMORY_MAX_ENTRIES,
    readExtendedBars,
    type ExtendedBarsDeps,
} from '../extendedBarsCache';

vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: async (
        _key: string,
        _ttl: unknown,
        fetcher: () => Promise<unknown>
    ): Promise<unknown> => fetcher(),
}));

const OPTIONS: GetBarsOptions = {
    symbol: 'aapl',
    timeframe: '5Min',
    from: '2026-06-20T00:00:00Z',
};

describe('readExtendedBars', () => {
    const fetchExtended = vi.fn(
        async (_o: GetBarsOptions): Promise<Bar[]> => []
    );
    const makeDeps = (
        override: Partial<ExtendedBarsDeps> = {}
    ): ExtendedBarsDeps => ({
        timeZone: 'America/New_York',
        session: US_EQUITY_SESSION,
        fetchExtended,
        memory: createMemoryLru(EXTENDED_HISTORY_MEMORY_MAX_ENTRIES),
        ...override,
    });
    beforeEach(() => fetchExtended.mockClear());

    it.each([
        ['no date-resolution timezone', { timeZone: undefined }],
        ['a non-US-equity session', { session: CRYPTO_SESSION }],
        ['an inner without extended bars', { fetchExtended: undefined }],
    ])(
        'returns empty without an upstream call for %s',
        async (_name, override) => {
            expect(await readExtendedBars(makeDeps(override), OPTIONS)).toEqual(
                []
            );
            expect(fetchExtended).not.toHaveBeenCalled();
        }
    );

    it('returns empty for a daily timeframe', async () => {
        expect(
            await readExtendedBars(makeDeps(), {
                ...OPTIONS,
                timeframe: '1Day',
            })
        ).toEqual([]);
        expect(fetchExtended).not.toHaveBeenCalled();
    });

    it('returns empty without a from', async () => {
        expect(
            await readExtendedBars(makeDeps(), { ...OPTIONS, from: undefined })
        ).toEqual([]);
        expect(fetchExtended).not.toHaveBeenCalled();
    });
});
