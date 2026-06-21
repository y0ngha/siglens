import { describe, it, expect, vi } from 'vitest';
import { mapCryptoListRow, fetchCryptoAssetList } from '../fmpCryptoListClient';

vi.mock('@/shared/api/fmp/httpClient');
import { fmpGet } from '@/shared/api/fmp/httpClient';

describe('fmpCryptoListClient', () => {
    describe('mapCryptoListRow', () => {
        it('maps an FMP cryptocurrency-list row to a CryptoAssetRow', () => {
            const row = mapCryptoListRow({
                symbol: 'BTCUSD',
                name: 'Bitcoin USD',
                exchange: 'CCC',
                icoDate: '2009-01-03',
                circulatingSupply: 19700000,
                totalSupply: 21000000,
            });
            expect(row).toEqual({
                symbol: 'BTCUSD',
                name: 'Bitcoin USD',
                circulatingSupply: 19700000,
            });
        });

        it('tolerates missing circulatingSupply', () => {
            const row = mapCryptoListRow({ symbol: 'XYZUSD', name: 'XYZ USD' });
            expect(row).toEqual({
                symbol: 'XYZUSD',
                name: 'XYZ USD',
                circulatingSupply: null,
            });
        });

        it('skips rows without a symbol', () => {
            expect(mapCryptoListRow({ name: 'no symbol' })).toBeNull();
        });
    });

    describe('fetchCryptoAssetList', () => {
        it('returns mapped rows, filtering out entries without a symbol', async () => {
            vi.mocked(fmpGet).mockResolvedValue([
                {
                    symbol: 'BTCUSD',
                    name: 'Bitcoin USD',
                    circulatingSupply: 19_700_000,
                },
                { name: 'no symbol' },
            ]);
            const result = await fetchCryptoAssetList();
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                symbol: 'BTCUSD',
                name: 'Bitcoin USD',
                circulatingSupply: 19_700_000,
            });
        });
    });
});
