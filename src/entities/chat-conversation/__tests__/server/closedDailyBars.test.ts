import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCachedBars } = vi.hoisted(() => ({ getCachedBars: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: getCachedBars,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));

import { loadClosedDailyBars } from '@/entities/chat-conversation/server/closedDailyBars';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const FRIDAY = Date.UTC(2026, 10, 13) / 1000;
const bar = (time: number, close: number) => ({
    time,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
});
const bars = [bar(FRIDAY - SECONDS_PER_DAY, 10), bar(FRIDAY, 11)];

describe('loadClosedDailyBars', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        getCachedBars.mockResolvedValue({ bars, indicators: {} });
    });
    afterEach(() => vi.useRealTimers());

    it('정규장 중이면 마지막 봉이 오늘 봉(형성 중)이라 뗀다', async () => {
        vi.setSystemTime(new Date('2026-11-13T15:00:00.000Z')); // 10:00 ET
        const { bars: out } = await loadClosedDailyBars(
            'AAPL',
            'us-equity',
            'AAPL'
        );
        expect(out.map(b => b.close)).toEqual([10]);
    });

    it('마감 뒤에는 마지막 봉이 완결이라 남기고, 일봉으로 fmpSymbol을 넘겨 읽는다', async () => {
        vi.setSystemTime(new Date('2026-11-13T22:00:00.000Z'));
        const { bars: out, session } = await loadClosedDailyBars(
            'AAPL',
            'us-equity',
            'AAPL'
        );
        expect(out.map(b => b.close)).toEqual([10, 11]);
        expect(session.kind).toBe('scheduled');
        expect(getCachedBars).toHaveBeenCalledWith(
            expect.anything(),
            'AAPL',
            '1Day',
            'AAPL',
            session
        );
    });
});
