import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssetInfo } from '@/shared/lib/types';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getAssetInfoStatic } from '@/entities/ticker/lib/getAssetInfoStatic';
import { connection } from 'next/server';

// `connection()`은 렌더를 동적화하는 Next 16 dynamic API — 유닛에서는 호출 여부만 검증한다.
vi.mock('next/server', () => ({
    connection: vi.fn().mockResolvedValue(undefined),
}));
// 헬퍼가 감싸는 정적화 함수를 mock해 정상/throw/null 세 경로를 직접 제어한다.
// (Task 5: resilient가 getAssetInfoCached 대신 getAssetInfoStatic을 호출하도록 변경됨.)
vi.mock('@/entities/ticker/lib/getAssetInfoStatic', () => ({
    getAssetInfoStatic: vi.fn(),
}));

const mockGet = vi.mocked(getAssetInfoStatic);
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

    it('rethrows DYNAMIC_SERVER_USAGE errors without fallback (Next.js control-flow signal)', async () => {
        const dynamicErr = Object.assign(new Error('Dynamic server usage'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mockGet.mockRejectedValue(dynamicErr);

        await expect(getAssetInfoResilient('AAPL')).rejects.toBe(dynamicErr);
        expect(mockConnection).not.toHaveBeenCalled();
    });

    it('rethrows when only message matches (no digest field)', async () => {
        const dynamicErr = new Error('Dynamic server usage');
        mockGet.mockRejectedValue(dynamicErr);

        await expect(getAssetInfoResilient('AAPL')).rejects.toBe(dynamicErr);
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
