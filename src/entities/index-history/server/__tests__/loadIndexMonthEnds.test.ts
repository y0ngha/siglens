vi.mock('server-only', () => ({}));

const { fmp, yahoo, cache, e2e } = vi.hoisted(() => ({
    fmp: { get: vi.fn() },
    yahoo: { chart: vi.fn() },
    cache: { writes: [] as { key: string; ttl: number }[] },
    e2e: { fake: false },
}));
vi.mock('@/shared/api/fmp/httpClient', () => ({ fmpGet: fmp.get }));
vi.mock('@/shared/api/yahoo/createYahooClient', () => ({
    getYahooClient: () => ({ chart: yahoo.chart }),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2EFakeMode: () => e2e.fake }));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: async (
        key: string,
        ttl: number,
        fetcher: () => Promise<unknown>
    ) => {
        const value = await fetcher();
        cache.writes = [...cache.writes, { key, ttl }];
        return value;
    },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadIndexMonthEnds } from '../loadIndexMonthEnds';

const NOW = new Date('2026-11-16T03:00:00Z'); // ET 11-15, KST 11-16
/** 구간 요청마다 그 구간 첫날·마지막 해 1월 말 두 행을 돌려준다(잘리지 않은 응답). */
function fullChunks(firstDay: (from: string) => string = from => from) {
    fmp.get.mockImplementation(
        async (_path: string, query: { from: string; to: string }) => [
            {
                symbol: '^GSPC',
                date: firstDay(query.from),
                price: 100,
                volume: 1,
            },
            {
                symbol: '^GSPC',
                date: `${query.to.slice(0, 4)}-01-31`,
                price: 110,
                volume: 1,
            },
        ]
    );
}

beforeEach(() => {
    fmp.get.mockReset();
    yahoo.chart.mockReset();
    cache.writes = [];
    e2e.fake = false;
});

describe('loadIndexMonthEnds', () => {
    it('S&P 500: 1950년부터 15년 구간으로 받아 월말로 접고, 지수별 진행 중인 달·임기 주기를 함께 돌려준다', async () => {
        fullChunks(from => from.replace('-01-01', '-01-03'));
        const result = await loadIndexMonthEnds('sp500', NOW);
        expect(fmp.get.mock.calls.map(call => call[1].from)).toEqual([
            '1950-01-01',
            '1965-01-01',
            '1980-01-01',
            '1995-01-01',
            '2010-01-01',
            '2025-01-01',
        ]);
        const lastCall = fmp.get.mock.calls.at(-1);
        if (lastCall === undefined) throw new Error('fmpGet not called');
        expect(lastCall[1].to).toBe('2026-12-31');
        // 구간 요청은 재시도하지 않는다(동시에 나가므로 최악 시간이 요청 한 번이다).
        for (const call of fmp.get.mock.calls)
            expect(call[2]).toEqual({ retryTransient: false });
        // 1950-01에는 구간 첫 행(1950-01-03, 100) 하나뿐이다. 110은 1964-01 행이다.
        expect(result.monthEnds[0]).toEqual({ month: '1950-01', close: 100 });
        expect(result.currentMonth).toBe('2026-11');
        expect(result.usCycle).toBe(true);
        expect(cache.writes).toEqual([
            {
                key: 'index-history:month-ends:v1:sp500:2026-11',
                ttl: 32 * 86_400,
            },
        ]);
    });

    it('구간 하나라도 앞쪽이 잘렸으면(첫 행이 시작일보다 45일 넘게 늦음) 던져 캐시에 남기지 않는다', async () => {
        fullChunks(from => (from === '1950-01-01' ? '1952-06-02' : from));
        await expect(loadIndexMonthEnds('sp500', NOW)).rejects.toThrow(
            'truncated'
        );
        expect(cache.writes).toEqual([]);
    });

    it('나스닥은 지수가 시작한 1971-02를 첫 구간의 기준으로 본다', async () => {
        fullChunks(from => (from === '1971-01-01' ? '1971-02-05' : from));
        const result = await loadIndexMonthEnds('nasdaq', NOW);
        expect(result.monthEnds[0]?.month).toBe('1971-02');
    });

    it('KOSPI: Yahoo 월봉을 서울 달력으로 바꾸고, 같은 달이 두 번 오면 늦은 행 하나로 접는다', async () => {
        yahoo.chart.mockResolvedValue({
            quotes: [
                { date: new Date('1996-11-30T15:00:00Z'), close: 651.22 },
                { date: new Date('2026-09-30T15:00:00Z'), close: 3400 },
                { date: new Date('2026-10-30T06:30:00Z'), close: 3500 },
                { date: new Date('2026-10-31T15:00:00Z'), close: 3600 },
            ],
        });
        const result = await loadIndexMonthEnds('kospi', NOW);
        expect(result.monthEnds).toEqual([
            { month: '1996-12', close: 651.22 },
            { month: '2026-10', close: 3500 },
            { month: '2026-11', close: 3600 },
        ]);
        expect(result.usCycle).toBe(false);
        expect(yahoo.chart).toHaveBeenCalledWith(
            '^KS11',
            { period1: '1996-12-01', interval: '1mo' },
            { validateResult: false }
        );
    });

    it('이력이 알려진 첫 달에서 시작하지 않으면(짧은 응답) 던진다', async () => {
        yahoo.chart.mockResolvedValue({
            quotes: [{ date: new Date('2026-10-31T15:00:00Z'), close: 900 }],
        });
        await expect(loadIndexMonthEnds('kosdaq', NOW)).rejects.toThrow(
            'expected 2000-10'
        );
        yahoo.chart.mockResolvedValue({});
        await expect(loadIndexMonthEnds('kosdaq', NOW)).rejects.toThrow(
            'malformed'
        );
        fmp.get.mockResolvedValue({ error: 'x' });
        await expect(loadIndexMonthEnds('nasdaq', NOW)).rejects.toThrow(
            'malformed'
        );
    });

    it('달이 바뀐 뒤 5일 안에 채운 값은 6시간만 둔다(직전 달 마지막 종가가 아직 잠정일 수 있다)', async () => {
        fullChunks(from => from.replace('-01-01', '-01-03'));
        await loadIndexMonthEnds('sp500', new Date('2026-12-02T15:00:00Z'));
        expect(cache.writes).toEqual([
            {
                key: 'index-history:month-ends:v1:sp500:2026-12',
                ttl: 6 * 3_600,
            },
        ]);
    });

    it('E2E fake 모드는 네트워크에 나가지 않고 던진다', async () => {
        e2e.fake = true;
        await expect(loadIndexMonthEnds('sp500', NOW)).rejects.toThrow('E2E');
        expect(fmp.get).not.toHaveBeenCalled();
    });
});
