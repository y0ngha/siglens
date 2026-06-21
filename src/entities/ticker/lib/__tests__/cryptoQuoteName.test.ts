// vi.mock is hoisted above all imports by vitest — must appear before any import statements.
vi.mock('@/shared/api/fmp/httpClient');

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { fetchCryptoQuoteName } from '../cryptoQuoteName';

const mockFmpGet = vi.mocked(fmpGet);

describe('fetchCryptoQuoteName', () => {
    beforeEach(() => {
        mockFmpGet.mockReset();
    });

    describe('normal response', () => {
        it('returns the name from the first row', async () => {
            mockFmpGet.mockResolvedValue([
                { symbol: 'BTCUSD', name: 'Bitcoin USD' },
            ]);
            const result = await fetchCryptoQuoteName('BTCUSD');
            expect(result).toBe('Bitcoin USD');
        });
    });

    describe('empty array response', () => {
        it('returns the symbol as fallback when rows is empty', async () => {
            mockFmpGet.mockResolvedValue([]);
            const result = await fetchCryptoQuoteName('BTCUSD');
            expect(result).toBe('BTCUSD');
        });
    });

    describe('name is empty string', () => {
        it('returns the symbol via the || fallback when name is empty string', async () => {
            mockFmpGet.mockResolvedValue([{ symbol: 'BTCUSD', name: '' }]);
            const result = await fetchCryptoQuoteName('BTCUSD');
            // rows[0]?.name || symbol — empty string is falsy, so falls back to symbol
            expect(result).toBe('BTCUSD');
        });
    });

    describe('fmpGet throws', () => {
        it('logs a warning and returns the symbol as fallback', async () => {
            const error = new Error('FMP network error');
            mockFmpGet.mockRejectedValue(error);
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = await fetchCryptoQuoteName('BTCUSD');

            expect(result).toBe('BTCUSD');
            expect(warnSpy).toHaveBeenCalledWith(
                '[cryptoQuoteName] fetchCryptoQuoteName failed',
                error
            );
            warnSpy.mockRestore();
        });
    });
});
