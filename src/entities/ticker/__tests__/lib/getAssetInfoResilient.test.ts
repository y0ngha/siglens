import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssetInfo } from '@/shared/lib/types';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getAssetInfoStatic } from '@/entities/ticker/lib/getAssetInfoStatic';

// 헬퍼가 감싸는 정적화 함수를 mock해 정상/throw/null 세 경로를 직접 제어한다.
vi.mock('@/entities/ticker/lib/getAssetInfoStatic', () => ({
    getAssetInfoStatic: vi.fn(),
}));

const mockGet = vi.mocked(getAssetInfoStatic);

describe('getAssetInfoResilient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
    });

    it('passes a successful AssetInfo through (degraded: false)', async () => {
        const info: AssetInfo = {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        };
        mockGet.mockResolvedValue(info);

        const result = await getAssetInfoResilient('AAPL');

        expect(result).toEqual({ assetInfo: info, degraded: false });
    });

    it('passes null (non-existent ticker) through (degraded: false) so the caller can notFound()', async () => {
        mockGet.mockResolvedValue(null);

        const result = await getAssetInfoResilient('ZZZZ');

        expect(result).toEqual({ assetInfo: null, degraded: false });
    });

    it('rethrows DYNAMIC_SERVER_USAGE errors without fallback (Next.js control-flow signal)', async () => {
        const dynamicErr = Object.assign(new Error('Dynamic server usage'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mockGet.mockRejectedValue(dynamicErr);

        await expect(getAssetInfoResilient('AAPL')).rejects.toBe(dynamicErr);
    });

    it('rethrows when only message matches (no digest field)', async () => {
        const dynamicErr = new Error('Dynamic server usage');
        mockGet.mockRejectedValue(dynamicErr);

        await expect(getAssetInfoResilient('AAPL')).rejects.toBe(dynamicErr);
    });

    it('on infra failure (throw) returns a ticker fallback with degraded: true — does not throw, so ISR cold-gen renders the degrade page (noindex) instead of crashing with 500', async () => {
        // 과거 catch의 connection()이 ISR cold-gen에서 DYNAMIC_SERVER_USAGE를 throw해
        // 500을 냈다(F2). 이제 throw 없이 degrade를 반환하므로 cold-gen이 200(noindex)으로
        // 완료된다. degraded: true → 호출부 generateMetadata가 noindex 처리.
        mockGet.mockRejectedValue(
            new Error('[fmpTickerApi] search-symbol fetch failed')
        );

        const result = await getAssetInfoResilient('IONQ');

        expect(result).toEqual({
            assetInfo: { symbol: 'IONQ', name: 'IONQ' },
            degraded: true,
        });
    });

    it('logs the degrade in non-E2E mode (production observability is preserved)', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockGet.mockRejectedValue(
            new Error('[fmpTickerApi] search-symbol fetch failed')
        );

        await getAssetInfoResilient('IONQ');

        expect(errorSpy).toHaveBeenCalledWith(
            '[getAssetInfoResilient] infra failure, ticker fallback:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    it('in E2E mode (no FMP key) the same infra failure degrades SILENTLY — no console.error noise', async () => {
        vi.stubEnv('E2E_TEST', '1');
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockGet.mockRejectedValue(
            new Error('[fmpTickerApi] search-symbol fetch failed')
        );

        const result = await getAssetInfoResilient('IONQ');

        expect(result).toEqual({
            assetInfo: { symbol: 'IONQ', name: 'IONQ' },
            degraded: true,
        });
        expect(errorSpy).not.toHaveBeenCalled();

        errorSpy.mockRestore();
    });
});
