import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { loader, asset, cache } = vi.hoisted(() => ({
    loader: { load: vi.fn() },
    asset: { info: vi.fn() },
    cache: {
        writes: [] as { key: string; cached: boolean }[],
    },
}));
vi.mock('@/entities/bars/server/loadDailyCloseHistory', () => ({
    loadDailyCloseHistory: loader.load,
}));
vi.mock('@/app/api/ai/chat/tools/resolveAssetInfo', async () => {
    const actual = await vi.importActual<
        typeof import('@/app/api/ai/chat/tools/resolveAssetInfo')
    >('@/app/api/ai/chat/tools/resolveAssetInfo');
    return { ...actual, resolveAssetInfoOrNull: asset.info };
});
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: async (
        key: string,
        _ttl: number,
        fetcher: () => Promise<unknown>,
        shouldCache: (value: unknown) => boolean = () => true
    ) => {
        const value = await fetcher();
        cache.writes = [...cache.writes, { key, cached: shouldCache(value) }];
        return value;
    },
}));

import { isRecord } from '@/shared/lib/isRecord';
import { getSwingHistoryTool } from '@/app/api/ai/chat/tools/getSwingHistory';
import { SWING_HISTORY_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';

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
    getSwingHistoryTool(args, ctx, rt);

/** 마지막 종가 날짜. 고정해 두어 lookbackYears의 창 시작을 정확히 단언한다. */
const LAST_DATE = '2025-08-05';

/**
 * 하루 간격 종가 13,000개(1990-01-02 ~ 2025-08-05): 0.02%씩 오르다가 90일마다 하루 15% 빠지고 다음 날 20% 반등한다 —
 * 스윙이 많은 긴 이력. 각 종가를 인덱스로 바로 계산한다(누적 변수 없이).
 */
function longHistory(): { date: string; close: number }[] {
    return Array.from({ length: 13_000 }, (_, i) => {
        const cycle = i % 90;
        const base = 100 * 1.0002 ** i;
        const close =
            cycle === 88
                ? base * 0.85
                : cycle === 89
                  ? base * 0.85 * 1.2
                  : base;
        return {
            date: new Date(Date.UTC(1990, 0, 2 + i)).toISOString().slice(0, 10),
            close,
        };
    });
}

function okResult(result: unknown): Record<string, unknown> {
    if (!isRecord(result) || result.declines === undefined)
        throw new Error(`expected a result: ${JSON.stringify(result)}`);
    return result;
}

const QQQ = { symbol: 'QQQ', name: 'Invesco QQQ Trust' };

describe('getSwingHistoryTool', () => {
    beforeEach(() => {
        loader.load.mockReset();
        loader.load.mockResolvedValue(longHistory());
        asset.info.mockReset();
        asset.info.mockResolvedValue(QQQ);
        cache.writes = [];
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('기본 기준 10%로 core 결과를 펼치고 asOf(마지막 종가 날짜)·symbol·출처를 붙인다', async () => {
        const result = okResult(await run({ symbol: 'qqq' }));
        expect(result).toMatchObject({
            symbol: 'QQQ',
            source: 'SIGLENS daily closes (price only)',
            minSwingPct: 10,
            asOf: LAST_DATE,
            lastDate: LAST_DATE,
            resolvedName: 'Invesco QQQ Trust',
        });
    });

    it('미국 종목은 FMP 소스와 미국 세션으로 읽고, 시장·심볼·인자·마감 세션이 캐시 키에 든다', async () => {
        await run({ symbol: 'QQQ' });
        expect(loader.load).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'QQQ',
                source: 'fmp',
                session: expect.objectContaining({
                    timeZone: 'America/New_York',
                }),
            })
        );
        expect(cache.writes).toEqual([
            {
                key: expect.stringMatching(
                    /^agent:swing-history:v2:us-equity:QQQ:10:all:\d{4}-\d{2}-\d{2}$/
                ),
                cached: true,
            },
        ]);
    });

    it('키의 날짜는 달력 날짜가 아니라 마지막 마감 세션이다(마감 뒤 게시 여유 안이면 직전 거래일)', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            // 월요일 17:00 ET — 장은 닫혔지만 EOD 게시 여유(4시간) 안이다.
            vi.setSystemTime(new Date('2026-11-16T22:00:00Z'));
            await run({ symbol: 'QQQ' });
            expect(cache.writes[0]?.key).toBe(
                'agent:swing-history:v2:us-equity:QQQ:10:all:2026-11-13'
            );
        } finally {
            vi.useRealTimers();
        }
    });

    it('lookbackYears는 core 창을 정확히 그만큼으로 줄이고 키에 든다', async () => {
        const result = okResult(
            await run({ symbol: 'QQQ', minSwingPct: 20, lookbackYears: 7 })
        );
        expect(result).toMatchObject({
            minSwingPct: 20,
            firstDate: '2018-08-05',
        });
        expect(cache.writes[0]?.key).toContain(':us-equity:QQQ:20:7:');
    });

    it('제공자 심볼이 다르면 그 심볼로 읽고 키에 쓰며 resolvedSymbol로 알린다', async () => {
        asset.info.mockResolvedValue({
            symbol: 'BRK.B',
            name: 'Berkshire Hathaway Inc.',
            fmpSymbol: 'BRK-B',
        });
        const result = okResult(await run({ symbol: 'BRK.B' }));
        expect(loader.load).toHaveBeenCalledWith(
            expect.objectContaining({ symbol: 'BRK-B' })
        );
        expect(cache.writes[0]?.key).toContain(':us-equity:BRK-B:');
        expect(result).toMatchObject({
            symbol: 'BRK.B',
            resolvedSymbol: 'BRK-B',
        });
    });

    it('한국 종목은 Yahoo 소스와 KRX 세션으로 읽는다', async () => {
        asset.info.mockResolvedValue({ symbol: '005930.KS', name: '삼성전자' });
        await run({ symbol: '005930.KS' });
        expect(loader.load).toHaveBeenCalledWith(
            expect.objectContaining({
                source: 'yahoo',
                session: expect.objectContaining({ timeZone: 'Asia/Seoul' }),
            })
        );
    });

    it('자산 조회가 실패해도 한국 종목은 형상으로 Yahoo에서 읽되 결과는 캐시하지 않는다', async () => {
        asset.info.mockResolvedValue(null);
        await run({ symbol: '005930.KS' });
        expect(loader.load).toHaveBeenCalledWith(
            expect.objectContaining({ symbol: '005930.KS', source: 'yahoo' })
        );
        expect(cache.writes).toEqual([
            {
                key: expect.stringContaining(':kr-equity:005930.KS:'),
                cached: false,
            },
        ]);
    });

    it('자산 조회가 실패한 그 밖의 심볼은 요청 심볼로 FMP에서 읽고 캐시하지 않는다', async () => {
        asset.info.mockResolvedValue(null);
        await run({ symbol: 'NEWCO' });
        expect(loader.load).toHaveBeenCalledWith(
            expect.objectContaining({ symbol: 'NEWCO', source: 'fmp' })
        );
        expect(cache.writes[0]?.cached).toBe(false);
    });

    it('긴 이력에서도 결과가 전용 상한 안에 든다', async () => {
        const size = JSON.stringify(await run({ symbol: 'QQQ' })).length;
        expect(size).toBeLessThan(SWING_HISTORY_RESULT_MAX_CHARS);
    });

    it('이력이 없으면 found false', async () => {
        loader.load.mockResolvedValue([]);
        await expect(run({ symbol: 'QQQ' })).resolves.toEqual({
            symbol: 'QQQ',
            found: false,
        });
    });

    it('로드 실패는 provider_failed', async () => {
        loader.load.mockRejectedValue(new Error('fmp down'));
        await expect(run({ symbol: 'QQQ' })).resolves.toEqual({
            symbol: 'QQQ',
            available: false,
            reason: 'provider_failed',
        });
    });

    it.each([
        { minSwingPct: 3 },
        { minSwingPct: 50 },
        { lookbackYears: 1 },
        { lookbackYears: 60 },
    ])('경계 인자 %o는 받아들인다', async args => {
        okResult(await run({ symbol: 'QQQ', ...args }));
    });

    it.each([
        { minSwingPct: 2 },
        { minSwingPct: 51 },
        { minSwingPct: 10.5 },
        { minSwingPct: '10' },
        { lookbackYears: 0 },
        { lookbackYears: 61 },
    ])(
        '범위 밖·정수가 아닌 인자 %o는 invalid_args이고 로드하지 않는다',
        async args => {
            await expect(run({ symbol: 'QQQ', ...args })).resolves.toEqual({
                error: 'invalid_args',
            });
            expect(loader.load).not.toHaveBeenCalled();
        }
    );
});
