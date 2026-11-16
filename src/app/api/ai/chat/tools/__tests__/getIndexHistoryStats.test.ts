import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { loader } = vi.hoisted(() => ({ loader: { load: vi.fn() } }));
vi.mock('@/entities/index-history/server/loadIndexMonthEnds', () => ({
    loadIndexMonthEnds: loader.load,
}));
const loaded = (monthEnds: unknown[], usCycle: boolean) => ({
    monthEnds,
    currentMonth: '2026-11',
    usCycle,
});

import { getIndexHistoryStatsTool } from '@/app/api/ai/chat/tools/getIndexHistoryStats';
import { INDEX_HISTORY_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};
const run = (args: Record<string, unknown>) =>
    getIndexHistoryStatsTool(args, ctx, rt);

/** 1950-01 ~ 2026-11 월말 종가(매달 0.5% 상승, 12월은 -1%). 실제 S&P 500 표 길이와 같다. */
function longHistory() {
    const rows: { month: string; close: number }[] = [];
    let close = 17;
    for (let y = 1950; y <= 2026; y++)
        for (let m = 1; m <= 12; m++) {
            if (y === 2026 && m > 11) break;
            close *= m === 12 ? 0.99 : 1.005;
            rows.push({ month: `${y}-${String(m).padStart(2, '0')}`, close });
        }
    return rows;
}

beforeEach(() => {
    loader.load.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('getIndexHistoryStatsTool', () => {
    it('미국 지수는 임기 주기·중간선거 표를 싣고, 진행 중인 달(2026-11)은 빠진다', async () => {
        loader.load.mockResolvedValue(loaded(longHistory(), true));
        const result = (await run({ index: 'sp500' })) as Record<string, any>;
        expect(result).toMatchObject({
            source: 'SIGLENS index history (month-end closes)',
            index: 'sp500',
            available: true,
            firstFullYear: 1951,
            lastFullYear: 2025,
            lastMonth: '2026-10',
        });
        expect(result.presidentialCycle).toHaveLength(4);
        expect(result.midtermForward12m.rows.length).toBeGreaterThan(0);
    });

    it('한국 지수는 임기 주기 표가 없다(null)', async () => {
        loader.load.mockResolvedValue(loaded(longHistory(), false));
        const result = (await run({ index: 'kospi' })) as Record<string, any>;
        expect(result.presidentialCycle).toBeNull();
        expect(result.midtermForward12m).toBeNull();
    });

    it('가장 긴 표(1950년~)가 전용 결과 상한 안에 든다', async () => {
        loader.load.mockResolvedValue(loaded(longHistory(), true));
        const size = JSON.stringify(await run({ index: 'sp500' })).length;
        expect(size).toBeLessThan(INDEX_HISTORY_RESULT_MAX_CHARS);
    });

    it('로드 실패·빈 결과는 provider_failed, 목록 밖 지수는 invalid_args', async () => {
        loader.load.mockRejectedValue(new Error('fmp down'));
        expect(await run({ index: 'nasdaq' })).toEqual({
            index: 'nasdaq',
            available: false,
            reason: 'provider_failed',
        });
        loader.load.mockResolvedValue(loaded([], false));
        expect(await run({ index: 'kosdaq' })).toEqual({
            index: 'kosdaq',
            available: false,
            reason: 'provider_failed',
        });
        expect(await run({ index: 'dow' })).toEqual({ error: 'invalid_args' });
    });
});
