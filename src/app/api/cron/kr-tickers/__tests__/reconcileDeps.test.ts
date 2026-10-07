const { mockTryGetClient, mockRevalidateTag, mockFmpGet } = vi.hoisted(() => ({
    mockTryGetClient: vi.fn(),
    mockRevalidateTag: vi.fn(),
    mockFmpGet: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));
vi.mock('@/shared/api/fmp/httpClient', () => ({ fmpGet: mockFmpGet }));
vi.mock('@/shared/db/client', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/db/client')>()),
    tryGetDatabaseClient: mockTryGetClient,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReconcileDeps } from '../reconcileDeps';

describe('createReconcileDeps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTryGetClient.mockReturnValue({ db: {} });
    });

    it('DB 클라이언트가 없으면 던진다', () => {
        mockTryGetClient.mockReturnValue(null);
        expect(() => createReconcileDeps()).toThrow('database unavailable');
    });

    it('revalidateSymbol은 대문자 symbol 태그를 max로 무효화한다', () => {
        createReconcileDeps().revalidateSymbol('brk.b');

        expect(mockRevalidateTag).toHaveBeenCalledWith('symbol:BRK.B', 'max');
    });

    it('stock-list를 FMP에서 받아 온다', async () => {
        mockFmpGet.mockResolvedValue([
            { symbol: 'AAPL', companyName: 'Apple' },
        ]);

        await expect(createReconcileDeps().fetchStockList()).resolves.toEqual([
            { symbol: 'AAPL', companyName: 'Apple' },
        ]);
        expect(mockFmpGet.mock.calls.map(call => call[0])).toContain(
            'stock-list'
        );
    });
});
