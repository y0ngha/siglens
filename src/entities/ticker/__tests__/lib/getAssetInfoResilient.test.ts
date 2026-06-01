import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssetInfo } from '@/shared/lib/types';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getAssetInfoCached } from '@/entities/ticker/lib/getAssetInfoCached';
import { connection } from 'next/server';

// `connection()`은 렌더를 동적화하는 Next 16 dynamic API — 유닛에서는 호출 여부만 검증한다.
vi.mock('next/server', () => ({
    connection: vi.fn().mockResolvedValue(undefined),
}));
// 헬퍼가 감싸는 캐시 함수를 mock해 정상/throw/null 세 경로를 직접 제어한다.
vi.mock('@/entities/ticker/lib/getAssetInfoCached', () => ({
    getAssetInfoCached: vi.fn(),
}));

const mockGet = vi.mocked(getAssetInfoCached);
const mockConnection = vi.mocked(connection);

describe('getAssetInfoResilient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('passes a successful AssetInfo through (degraded: false) and does not opt out of caching', async () => {
        const info: AssetInfo = {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        };
        mockGet.mockResolvedValue(info);

        const result = await getAssetInfoResilient('AAPL');

        expect(result).toEqual({ assetInfo: info, degraded: false });
        expect(mockConnection).not.toHaveBeenCalled();
    });

    it('passes null (non-existent ticker) through (degraded: false) so the caller can notFound()', async () => {
        mockGet.mockResolvedValue(null);

        const result = await getAssetInfoResilient('ZZZZ');

        expect(result).toEqual({ assetInfo: null, degraded: false });
        expect(mockConnection).not.toHaveBeenCalled();
    });

    it('on infra failure (throw) returns a ticker fallback with degraded: true and opts the render out of the ISR cache', async () => {
        mockGet.mockRejectedValue(
            new Error('[fmpTickerApi] search-symbol fetch failed')
        );

        const result = await getAssetInfoResilient('IONQ');

        expect(result).toEqual({
            assetInfo: { symbol: 'IONQ', name: 'IONQ' },
            degraded: true,
        });
        expect(mockConnection).toHaveBeenCalledOnce();
    });
});
