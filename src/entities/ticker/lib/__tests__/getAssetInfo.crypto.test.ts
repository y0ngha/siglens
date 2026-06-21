import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../cryptoAssetStore', () => ({
    getCryptoAsset: vi.fn(),
}));
vi.mock('../cryptoQuoteName', () => ({
    fetchCryptoQuoteName: vi.fn(),
}));
vi.mock('@y0ngha/siglens-core', () => ({
    createCacheProvider: () => null,
}));

import { getAssetInfo } from '../getAssetInfo';
import { getCryptoAsset } from '../cryptoAssetStore';

describe('getAssetInfo — crypto branch', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns a crypto AssetInfo from crypto_assets membership', async () => {
        vi.mocked(getCryptoAsset).mockResolvedValue({
            symbol: 'BTCUSD',
            name: 'Bitcoin USD',
            koreanName: '비트코인',
            circulatingSupply: 19_700_000,
        });
        const info = await getAssetInfo('btcusd');
        expect(info).toMatchObject({
            symbol: 'BTCUSD',
            name: 'Bitcoin USD',
            koreanName: '비트코인',
            marketProfile: 'crypto',
        });
    });
});
