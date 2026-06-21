// vi.mock is hoisted by vitest above all imports — must appear before any import statements.
vi.mock('@/shared/api/fmp/httpClient');

import { describe, it, expect } from 'vitest';
import { mapCryptoListRow } from '../fmpCryptoListClient';

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

        it('falls back to symbol when name is absent', () => {
            const row = mapCryptoListRow({ symbol: 'BTCUSD' });
            expect(row).toEqual({
                symbol: 'BTCUSD',
                name: 'BTCUSD',
                circulatingSupply: null,
            });
        });
    });
});
