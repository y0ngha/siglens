import { describe, it, expect, vi } from 'vitest';

vi.mock('@/entities/ticker/lib/getAssetInfoStatic', () => ({
    getAssetInfoStatic: vi.fn(),
}));
// 캐시 없는 경로를 부르면 안 된다 — 부르면 테스트가 실패하도록 던지게 둔다.
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn(() => {
        throw new Error('uncached getAssetInfo must not be called');
    }),
}));

import { getAssetInfoStatic } from '@/entities/ticker/lib/getAssetInfoStatic';
import { resolveMarketProfileStatic } from '@/entities/ticker/lib/resolveMarketProfileStatic';

describe('resolveMarketProfileStatic', () => {
    it('캐시된 getAssetInfoStatic의 프로필을 쓴다', async () => {
        vi.mocked(getAssetInfoStatic).mockResolvedValue({
            symbol: 'BTCUSD',
            name: 'Bitcoin USD',
            marketProfile: 'crypto',
        });
        expect(await resolveMarketProfileStatic('BTCUSD')).toBe('crypto');
        expect(getAssetInfoStatic).toHaveBeenCalledWith('BTCUSD');
    });

    it('미지 종목(null)은 기본 프로필로 떨어진다', async () => {
        vi.mocked(getAssetInfoStatic).mockResolvedValue(null);
        expect(await resolveMarketProfileStatic('ZZZZ')).toBe('us-equity');
    });

    /**
     * 알려진 실패 모드를 고정한다(JSDoc): 자산 추가 경로는 `symbol:` 태그를 무효화하지 않으므로,
     * 추가 전 `null`로 캐시된 새 크립토는 TTL(최대 24h) 동안 기본 us-equity 세션 스펙을 받는다.
     * 이 테스트는 그 동작이 "캐시된 값을 그대로 쓴다"는 설계의 결과임을 명시한다.
     */
    it('알려진 실패 모드: 캐시가 null을 들고 있으면 새로 추가된 크립토도 us-equity로 해석된다', async () => {
        vi.mocked(getAssetInfoStatic).mockResolvedValue(null);
        expect(await resolveMarketProfileStatic('NEWCOINUSD')).toBe(
            'us-equity'
        );
    });

    it('인프라 실패는 그대로 던진다', async () => {
        vi.mocked(getAssetInfoStatic).mockRejectedValue(new Error('db down'));
        await expect(resolveMarketProfileStatic('AAPL')).rejects.toThrow(
            'db down'
        );
    });
});
