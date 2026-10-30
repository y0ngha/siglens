vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));
vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    hasOptionsMarket: vi.fn(),
    fetchOptionsSnapshot: vi.fn(),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    loadHasOptionsMarket,
    loadOptionsSnapshot,
} from '@/app/[locale]/[symbol]/options/_lib/optionsData';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/lib/optionsDataCache';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';

describe('loadHasOptionsMarket', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('options:has 키(12h)로 읽는다', async () => {
        vi.mocked(hasOptionsMarket).mockResolvedValue(true);

        await expect(loadHasOptionsMarket('AAPL', '[label]')).resolves.toBe(
            true
        );
        expect(staticSymbolCache).toHaveBeenCalledWith(
            ['options:has', 'AAPL'],
            'AAPL',
            expect.any(Function),
            [],
            SECONDS_PER_HALF_DAY
        );
    });

    it('조회가 실패하면 호출부 로그 접두로 남기고 false다', async () => {
        const error = new Error('Yahoo down');
        vi.mocked(hasOptionsMarket).mockRejectedValue(error);
        const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            loadHasOptionsMarket('AAPL', '[caller] failed:')
        ).resolves.toBe(false);
        expect(logSpy).toHaveBeenCalledWith('[caller] failed:', error);
        logSpy.mockRestore();
    });
});

describe('loadOptionsSnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('options:snapshot-v2 키(12h)로 읽는다', async () => {
        vi.mocked(fetchOptionsSnapshot).mockResolvedValue(null);

        await expect(loadOptionsSnapshot('AAPL')).resolves.toBeNull();
        expect(staticSymbolCache).toHaveBeenCalledWith(
            ['options:snapshot-v2', 'AAPL'],
            'AAPL',
            expect.any(Function),
            [],
            SECONDS_PER_HALF_DAY
        );
    });

    it('조회가 실패하면 로그를 남기고 null이다', async () => {
        const error = new Error('Yahoo snapshot down');
        vi.mocked(fetchOptionsSnapshot).mockRejectedValue(error);
        const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(loadOptionsSnapshot('AAPL')).resolves.toBeNull();
        expect(logSpy).toHaveBeenCalledWith(
            '[OptionsPage] fetchOptionsSnapshot failed, degrading to null:',
            error
        );
        logSpy.mockRestore();
    });
});
