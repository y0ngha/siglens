vi.mock('@/entities/extended-hours/api', () => ({
    loadExtendedHoursQuote: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getExtendedHoursQuoteAction } from '@/entities/extended-hours/actions/getExtendedHoursQuoteAction';
import { loadExtendedHoursQuote } from '@/entities/extended-hours/api';
import type { ExtendedHoursQuote } from '@/entities/extended-hours/model';

const mockedLoad = vi.mocked(loadExtendedHoursQuote);

const QUOTE: ExtendedHoursQuote = {
    session: 'pre-market',
    price: 346.38,
    referenceClose: 342.96,
    change: 3.42,
    changePercent: 0.9972,
    tradedAtMs: 1792062432000,
};

describe('getExtendedHoursQuoteAction', () => {
    beforeEach(() => {
        mockedLoad.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('로더 결과를 그대로 돌려준다', async () => {
        mockedLoad.mockResolvedValue(QUOTE);

        await expect(getExtendedHoursQuoteAction('AAPL')).resolves.toEqual(
            QUOTE
        );
        expect(mockedLoad).toHaveBeenCalledWith('AAPL');
    });

    it('로더가 던져도 던지지 않고 이름만 로그한 뒤 null이다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockedLoad.mockRejectedValue(new TypeError('secret detail'));

        await expect(getExtendedHoursQuoteAction('AAPL')).resolves.toBeNull();
        expect(error).toHaveBeenCalledWith(
            '[getExtendedHoursQuoteAction] failed:',
            { errorName: 'TypeError' }
        );
    });

    it('던져진 값이 Error가 아니어도 null이다', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockedLoad.mockRejectedValue('boom');

        await expect(getExtendedHoursQuoteAction('AAPL')).resolves.toBeNull();
    });
});
