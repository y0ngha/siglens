import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';

// Mock next/navigation notFound before importing the module under test.
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn(),
}));

import { assertTabAllowedForSymbol } from '@/entities/ticker/lib/assertTabAllowedForSymbol';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { notFound } from 'next/navigation';
import type { AssetInfo } from '@/shared/lib/types';

const mockGetAssetInfo = getAssetInfo as MockedFunction<typeof getAssetInfo>;
// notFound is typed as () => never; cast via unknown to get mock API access.
const mockNotFound = notFound as unknown as MockedFunction<() => void>;

/** Equity asset — marketProfile absent → falls back to 'us-equity'. */
const EQUITY_ASSET_INFO: AssetInfo = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
};

/** Crypto asset — marketProfile 'crypto' → no equity tabs. */
const CRYPTO_ASSET_INFO: AssetInfo = {
    symbol: 'BTCUSD',
    name: 'Bitcoin USD',
    marketProfile: 'crypto',
};

describe('assertTabAllowedForSymbol', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock implementation re-throw so tests can catch notFound.
        mockNotFound.mockImplementation(() => {
            throw new Error('NEXT_NOT_FOUND');
        });
    });

    describe('equity symbol', () => {
        it('equity 심볼의 허용된 탭에서는 notFound를 호출하지 않는다', async () => {
            mockGetAssetInfo.mockResolvedValue(EQUITY_ASSET_INFO);

            await expect(
                assertTabAllowedForSymbol('AAPL', 'fundamental')
            ).resolves.toBeUndefined();

            expect(mockNotFound).not.toHaveBeenCalled();
        });

        it('equity 심볼은 "financials" 탭을 허용한다', async () => {
            mockGetAssetInfo.mockResolvedValue(EQUITY_ASSET_INFO);

            await expect(
                assertTabAllowedForSymbol('AAPL', 'financials')
            ).resolves.toBeUndefined();

            expect(mockNotFound).not.toHaveBeenCalled();
        });

        it('equity 심볼은 "congress" 탭을 허용한다', async () => {
            mockGetAssetInfo.mockResolvedValue(EQUITY_ASSET_INFO);

            await expect(
                assertTabAllowedForSymbol('AAPL', 'congress')
            ).resolves.toBeUndefined();

            expect(mockNotFound).not.toHaveBeenCalled();
        });

        it('equity 심볼은 "options" 탭을 허용한다', async () => {
            mockGetAssetInfo.mockResolvedValue(EQUITY_ASSET_INFO);

            await expect(
                assertTabAllowedForSymbol('AAPL', 'options')
            ).resolves.toBeUndefined();

            expect(mockNotFound).not.toHaveBeenCalled();
        });
    });

    describe('crypto symbol', () => {
        it('crypto 심볼의 equity-only 탭(fundamental)에서는 notFound를 호출한다', async () => {
            mockGetAssetInfo.mockResolvedValue(CRYPTO_ASSET_INFO);

            await expect(
                assertTabAllowedForSymbol('BTCUSD', 'fundamental')
            ).rejects.toThrow('NEXT_NOT_FOUND');

            expect(mockNotFound).toHaveBeenCalledTimes(1);
        });

        it('crypto 심볼의 equity-only 탭(financials)에서는 notFound를 호출한다', async () => {
            mockGetAssetInfo.mockResolvedValue(CRYPTO_ASSET_INFO);

            await expect(
                assertTabAllowedForSymbol('BTCUSD', 'financials')
            ).rejects.toThrow('NEXT_NOT_FOUND');

            expect(mockNotFound).toHaveBeenCalledTimes(1);
        });

        it('crypto 심볼의 equity-only 탭(congress)에서는 notFound를 호출한다', async () => {
            mockGetAssetInfo.mockResolvedValue(CRYPTO_ASSET_INFO);

            await expect(
                assertTabAllowedForSymbol('BTCUSD', 'congress')
            ).rejects.toThrow('NEXT_NOT_FOUND');

            expect(mockNotFound).toHaveBeenCalledTimes(1);
        });

        it('crypto 심볼의 equity-only 탭(options)에서는 notFound를 호출한다', async () => {
            mockGetAssetInfo.mockResolvedValue(CRYPTO_ASSET_INFO);

            await expect(
                assertTabAllowedForSymbol('BTCUSD', 'options')
            ).rejects.toThrow('NEXT_NOT_FOUND');

            expect(mockNotFound).toHaveBeenCalledTimes(1);
        });
    });

    describe('unknown symbol (getAssetInfo returns null)', () => {
        it('getAssetInfo가 null이면 us-equity로 폴백해 허용된 탭은 통과한다', async () => {
            mockGetAssetInfo.mockResolvedValue(null);

            await expect(
                assertTabAllowedForSymbol('UNKNOWN', 'fundamental')
            ).resolves.toBeUndefined();

            expect(mockNotFound).not.toHaveBeenCalled();
        });
    });
});
