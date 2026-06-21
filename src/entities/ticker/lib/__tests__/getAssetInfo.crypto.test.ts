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
import { fetchCryptoQuoteName } from '../cryptoQuoteName';

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

    it('falls back to fetchCryptoQuoteName when crypto_assets record has empty name', async () => {
        vi.mocked(getCryptoAsset).mockResolvedValue({
            symbol: 'EMPTYNAME',
            name: '', // empty string — should trigger quote name lookup
            koreanName: null,
            circulatingSupply: null,
        });
        vi.mocked(fetchCryptoQuoteName).mockResolvedValue('Empty Name Coin');

        const info = await getAssetInfo('emptyname');

        expect(fetchCryptoQuoteName).toHaveBeenCalledWith('EMPTYNAME');
        expect(info).toMatchObject({
            symbol: 'EMPTYNAME',
            name: 'Empty Name Coin',
            marketProfile: 'crypto',
        });
    });
});
