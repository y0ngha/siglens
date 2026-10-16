const { mockClient, mockRevalidate, mockFetchList } = vi.hoisted(() => ({
    mockClient: vi.fn(),
    mockRevalidate: vi.fn(),
    mockFetchList: vi.fn(),
}));
vi.mock('../../revalidateSymbols', () => ({
    revalidateSymbols: mockRevalidate,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));
vi.mock('@/shared/api/exchange/regShoClient', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/exchange/regShoClient')
    >()),
    fetchRegShoThresholdText: mockFetchList,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REG_SHO_MARKETS } from '@/shared/api/exchange/regShoClient';
import { isRegShoThresholdDataEnabled } from '@/shared/api/exchange/regShoThresholdDataEnabled';
import { createRegShoDeps } from '../createDeps';

describe('createRegShoDeps', () => {
    beforeEach(() => {
        mockClient.mockReset();
        mockFetchList.mockReset();
    });

    it('throws when the database is unavailable (the cron logs "run failed")', () => {
        mockClient.mockReturnValue(null);
        expect(() => createRegShoDeps(() => false)).toThrow(
            '[reg-sho-threshold] database unavailable'
        );
    });

    it('wires the licence flag, the five markets and the deadline', () => {
        mockClient.mockReturnValue({ db: {} });
        const isDeadlineReached = () => true;
        const deps = createRegShoDeps(isDeadlineReached);
        expect(deps.isEnabled).toBe(isRegShoThresholdDataEnabled);
        expect(deps.markets).toEqual(REG_SHO_MARKETS);
        expect(deps.isDeadlineReached).toBe(isDeadlineReached);
    });

    it('fetches a known market through the exchange client', async () => {
        mockClient.mockReturnValue({ db: {} });
        mockFetchList.mockResolvedValue('Symbol|CompanyName\n');
        const deps = createRegShoDeps(() => false);
        expect(await deps.fetchList('cboe_bzx', '2026-10-15')).toBe(
            'Symbol|CompanyName\n'
        );
        expect(mockFetchList).toHaveBeenCalledWith('cboe_bzx', '2026-10-15');
    });

    it('rejects an unknown market without a request', () => {
        mockClient.mockReturnValue({ db: {} });
        expect(() =>
            createRegShoDeps(() => false).fetchList('otc', '2026-10-15')
        ).toThrow('unknown Reg SHO market otc');
        expect(mockFetchList).not.toHaveBeenCalled();
    });

    it('wires cache invalidation to the symbol tag revalidation helper', () => {
        mockClient.mockReturnValue({ db: {} });
        createRegShoDeps(() => false).invalidateSymbols(['GME']);
        expect(mockRevalidate).toHaveBeenCalledWith(['GME']);
    });
});
