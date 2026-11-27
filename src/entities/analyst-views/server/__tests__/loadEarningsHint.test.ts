const { mockGetAnalystViews, mockE2E } = vi.hoisted(() => ({
    mockGetAnalystViews: vi.fn(),
    mockE2E: vi.fn(() => false),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/entities/analyst-views/server/getAnalystViews', () => ({
    getAnalystViews: mockGetAnalystViews,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2EFakeMode: mockE2E }));
// 캐시 래퍼는 통과시킨다 — 키·TTL은 넘겨받은 값을 단언한다.
const { mockCache } = vi.hoisted(() => ({
    mockCache: vi.fn(
        (_keys: readonly string[], _symbol: string, fetcher: () => unknown) =>
            fetcher()
    ),
}));
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockCache,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalystEarningsHint } from '@/entities/analyst-views/model';

import {
    EARNINGS_HINT_BUDGET_MS,
    loadEarningsHintBounded,
} from '@/entities/analyst-views/server/loadEarningsHint';

const HINT: AnalystEarningsHint = {
    date: '2026-11-19',
    isEstimate: false,
    session: 'after_market',
    callAt: null,
};

describe('loadEarningsHintBounded', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockE2E.mockReturnValue(false);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('가벼운 애널리스트 뷰의 실적 힌트를 사실 블록과 같은 12시간 키로 읽는다', async () => {
        mockGetAnalystViews.mockResolvedValue({ earnings: HINT, degraded: [] });
        await expect(loadEarningsHintBounded('NVDA')).resolves.toEqual(HINT);
        expect(mockGetAnalystViews).toHaveBeenCalledWith('NVDA', {
            detail: 'lite',
        });
        const [keys, symbol, , tags, ttl] = mockCache.mock.calls.find(
            call => call[1] === 'NVDA'
        ) as unknown as [string[], string, unknown, string[], number];
        expect(keys).toEqual(['fundamental-facts:earnings-hint', 'NVDA']);
        expect(symbol).toBe('NVDA');
        expect(tags).toEqual([]);
        expect(ttl).toBe(12 * 60 * 60);
    });

    it('한국 종목과 E2E에서는 부르지 않는다', async () => {
        await expect(loadEarningsHintBounded('005930.KS')).resolves.toBeNull();
        mockE2E.mockReturnValue(true);
        await expect(loadEarningsHintBounded('NVDA')).resolves.toBeNull();
        expect(mockGetAnalystViews).not.toHaveBeenCalled();
    });

    it('Yahoo가 실패하면(degraded) 던져서 캐시에 굳지 않게 하고, 호출자에게는 null이다', async () => {
        mockGetAnalystViews.mockResolvedValue({
            earnings: null,
            degraded: ['yahoo'],
        });
        await expect(loadEarningsHintBounded('NVDA')).resolves.toBeNull();
        expect(console.warn).toHaveBeenCalledWith(
            '[loadEarningsHint] failed for NVDA:',
            expect.any(Error)
        );
    });

    it('예산(2.5초)을 넘기면 null로 끝낸다', async () => {
        vi.useFakeTimers();
        try {
            mockGetAnalystViews.mockReturnValue(new Promise(() => undefined));
            const pending = loadEarningsHintBounded('NVDA');
            await vi.advanceTimersByTimeAsync(EARNINGS_HINT_BUDGET_MS);
            await expect(pending).resolves.toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
