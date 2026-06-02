import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssetInfo } from '@/shared/lib/types';

vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, // identity로 통과 검증
}));
// `'use server'` action을 mock한다 — getAssetInfoStatic은 client-bundle firewall을 위해
// clean lib(getAssetInfo)가 아니라 getAssetInfoAction을 감싼다(JSDoc 참조).
vi.mock('@/entities/ticker/actions/getAssetInfoAction', () => ({
    getAssetInfoAction: vi.fn(),
}));

import { getAssetInfoStatic } from '@/entities/ticker/lib/getAssetInfoStatic';
import { getAssetInfoAction } from '@/entities/ticker/actions/getAssetInfoAction';

const mockGetAssetInfo = vi.mocked(getAssetInfoAction);

describe('getAssetInfoStatic', () => {
    beforeEach(() => vi.clearAllMocks());

    it('delegates to getAssetInfo with the same ticker and returns its data', async () => {
        const info: AssetInfo = {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        };
        mockGetAssetInfo.mockResolvedValue(info);

        const result = await getAssetInfoStatic('AAPL');

        expect(result).toBe(info);
        expect(mockGetAssetInfo).toHaveBeenCalledWith('AAPL');
    });

    it('passes null (non-existent ticker) straight through', async () => {
        mockGetAssetInfo.mockResolvedValue(null);

        const result = await getAssetInfoStatic('ZZZZ');

        expect(result).toBeNull();
        expect(mockGetAssetInfo).toHaveBeenCalledWith('ZZZZ');
    });
});
