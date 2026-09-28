import { describe, it, expect, vi } from 'vitest';

vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn(),
}));

import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';

describe('resolveMarketProfile', () => {
    it('returns "crypto" for a crypto-profile asset', async () => {
        vi.mocked(getAssetInfo).mockResolvedValue({
            symbol: 'BTCUSD',
            name: 'Bitcoin USD',
            marketProfile: 'crypto',
        });
        expect(await resolveMarketProfile('BTCUSD')).toBe('crypto');
    });

    it('returns "us-equity" for a profile-less (legacy) asset', async () => {
        vi.mocked(getAssetInfo).mockResolvedValue({
            symbol: 'AAPL',
            name: 'Apple',
        });
        expect(await resolveMarketProfile('AAPL')).toBe('us-equity');
    });

    it('returns "us-equity" (default fallback) when the asset is unknown (null)', async () => {
        vi.mocked(getAssetInfo).mockResolvedValue(null);
        expect(await resolveMarketProfile('ZZZZ')).toBe('us-equity');
    });
});
