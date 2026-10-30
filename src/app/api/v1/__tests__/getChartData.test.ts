const { profile, assetInfo, getCachedBars } = vi.hoisted(() => ({
    profile: vi.fn(),
    assetInfo: vi.fn(),
    getCachedBars: vi.fn(),
}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: getCachedBars,
}));
vi.mock('@/entities/ticker/server/getAssetInfo', () => ({
    getAssetInfo: assetInfo,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ provider: true }),
}));

import {
    calculateIndicators,
    getAllowedTimeframes,
} from '@y0ngha/siglens-core';
import { getChartDataTool } from '@/app/api/v1/getChartData';
import { roundIndicators } from '@/entities/bars/lib/roundIndicators';
import { makeDailyBars } from '@/entities/bars/__tests__/lib/chartDataFixtures';
import { CHART_DATA_INDICATOR_NAMES } from '@/entities/bars/lib/chartDataIndicators';
import type { ChartData } from '@/entities/bars/lib/buildChartData';

const bars = makeDailyBars(300);
const indicators = calculateIndicators(bars);

type ChartResponse = ChartData & {
    meta: {
        source: string;
        asOf: string;
        lastBarTime: number;
        currency: string;
        quoteDelayMinutes: number;
        delayed: boolean;
        barsRequested: number;
        barsLimitedBySize: boolean;
    };
};

const run = async (
    args: Record<string, unknown>,
    tier: 'free' | 'member' | 'pro' = 'pro',
    maxChars?: number
): Promise<ChartResponse> =>
    (await getChartDataTool(
        { symbol: 'aapl', timeframe: '1Day', ...args },
        { tier },
        maxChars
    )) as ChartResponse;

beforeEach(() => {
    vi.clearAllMocks();
    profile.mockResolvedValue('us-equity');
    assetInfo.mockResolvedValue({ fmpSymbol: 'AAPL' });
    getCachedBars.mockResolvedValue({ bars, indicators });
});

describe('getChartDataTool — 데이터 경로', () => {
    it('웹·get_bars_indicators와 같은 캐시 경로(getCachedBarsWithIndicators)로 한 번만 읽는다', async () => {
        await run({ indicators: ['rsi'] });
        expect(getCachedBars).toHaveBeenCalledTimes(1);
        const [provider, symbol, timeframe, fmpSymbol] =
            getCachedBars.mock.calls.find(([, s]) => s === 'AAPL')!;
        expect(provider).toEqual({ provider: true });
        expect(symbol).toBe('AAPL');
        expect(timeframe).toBe('1Day');
        expect(fmpSymbol).toBe('AAPL');
    });

    it('asset 조회가 실패해도(fmpSymbol 없이) 봉은 돌려준다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        assetInfo.mockRejectedValue(new Error('db down'));
        const data = await run({ bars: 5 });
        expect(data.bars).toBe(5);
        const [, , , fmpSymbol] = getCachedBars.mock.calls.find(
            ([, s]) => s === 'AAPL'
        )!;
        expect(fmpSymbol).toBeUndefined();
    });
});

describe('getChartDataTool — 인자 기본값과 슬라이스', () => {
    it('bars 기본값은 100이다', async () => {
        const data = await run({});
        expect(data.bars).toBe(100);
        expect(data.time).toHaveLength(100);
    });

    it('indicators 생략·빈 배열·["all"]은 모두 전체 지표다', async () => {
        for (const args of [{}, { indicators: [] }, { indicators: ['all'] }]) {
            const data = await run({ ...args, bars: 10 });
            expect(Object.keys(data.indicators)).toEqual([
                ...CHART_DATA_INDICATOR_NAMES,
            ]);
        }
    });

    it('고른 지표만 나간다', async () => {
        const data = await run({ indicators: ['rsi', 'macd', 'ma'], bars: 10 });
        expect(Object.keys(data.indicators)).toEqual(['rsi', 'macd', 'ma']);
    });

    it('마지막 N개가 웹과 같은 값(전체 계산 → roundIndicators → 자르기)이다', async () => {
        const data = await run({ bars: 50, indicators: ['rsi', 'ma'] });
        const web = roundIndicators(indicators);
        expect(data.indicators.rsi).toEqual(web.rsi.slice(-50));
        expect((data.indicators.ma as Record<string, unknown>)['20']).toEqual(
            web.ma[20]!.slice(-50)
        );
        expect(data.time).toEqual(bars.slice(-50).map(b => b.time));
    });

    it('모든 시리즈가 time과 같은 길이다(전체 지표, 500 요청이 가진 봉보다 클 때도)', async () => {
        const data = await run({ bars: 500 });
        expect(data.bars).toBe(300);
        expect(data.time).toHaveLength(300);
        expect(data.indicators.rsi).toHaveLength(300);
    });

    it('심볼은 대문자로 정규화해 돌려준다', async () => {
        expect((await run({ bars: 1 })).symbol).toBe('AAPL');
    });
});

describe('getChartDataTool — meta', () => {
    it('출처·마지막 봉 시각·통화·시세 지연을 싣는다(미국: 지연 없음)', async () => {
        const { meta } = await run({ bars: 3 });
        const last = bars.at(-1)!.time;
        expect(meta).toMatchObject({
            source: 'SIGLENS bars + indicators',
            lastBarTime: last,
            asOf: new Date(last * 1000).toISOString(),
            currency: 'USD',
            quoteDelayMinutes: 0,
            delayed: false,
            barsRequested: 3,
            barsLimitedBySize: false,
        });
    });

    it('한국 종목은 원화·20분 지연을 알린다', async () => {
        profile.mockResolvedValue('kr-equity');
        const { meta } = await run({ symbol: '005930.KS', bars: 3 });
        expect(meta).toMatchObject({
            currency: 'KRW',
            quoteDelayMinutes: 20,
            delayed: true,
        });
    });

    it('암호화폐는 지연 없음', async () => {
        profile.mockResolvedValue('crypto');
        const { meta } = await run({ symbol: 'BTCUSD', bars: 3 });
        expect(meta).toMatchObject({ quoteDelayMinutes: 0, delayed: false });
    });
});

describe('getChartDataTool — tier별 timeframe 게이트(웹과 같은 규칙)', () => {
    it.each(['free', 'member', 'pro'] as const)(
        '%s: 허용되지 않은 timeframe은 403용 오류이고 데이터를 읽지 않는다',
        async tier => {
            const denied = (
                ['5Min', '15Min', '30Min', '1Hour', '4Hour', '1Day'] as const
            ).filter(tf => !getAllowedTimeframes(tier).includes(tf));
            for (const timeframe of denied) {
                getCachedBars.mockClear();
                await expect(
                    getChartDataTool({ symbol: 'AAPL', timeframe }, { tier })
                ).resolves.toEqual({
                    error: 'timeframe_not_allowed',
                    tier,
                    timeframe,
                    allowedTimeframes: getAllowedTimeframes(tier),
                });
                expect(getCachedBars).not.toHaveBeenCalled();
                expect(profile).not.toHaveBeenCalled();
            }
        }
    );

    it('게이트가 실제로 어떤 tier에선 막는다(공허한 통과 방지)', () => {
        expect(getAllowedTimeframes('free').length).toBeLessThan(6);
    });

    it.each(['free', 'member', 'pro'] as const)(
        '%s: 허용된 timeframe은 통과한다',
        async tier => {
            const [timeframe] = getAllowedTimeframes(tier);
            const data = (await getChartDataTool(
                { symbol: 'AAPL', timeframe },
                { tier }
            )) as ChartResponse;
            expect(data.timeframe).toBe(timeframe);
        }
    );
});

describe('getChartDataTool — 잘못된 timeframe', () => {
    it.each(['2Day', '', undefined, 5, null])(
        '%j는 데이터를 읽기 전에 invalid_args',
        async timeframe => {
            await expect(
                getChartDataTool({ symbol: 'AAPL', timeframe }, { tier: 'pro' })
            ).resolves.toMatchObject({
                error: 'invalid_args',
                issues: [{ path: 'timeframe' }],
            });
            expect(getCachedBars).not.toHaveBeenCalled();
        }
    );
});

describe('getChartDataTool — 데이터 없음', () => {
    it('봉이 없으면 bars_not_found', async () => {
        getCachedBars.mockResolvedValue({ bars: [], indicators });
        await expect(
            getChartDataTool(
                { symbol: 'ZZZZ', timeframe: '1Day' },
                { tier: 'pro' }
            )
        ).resolves.toEqual({
            error: 'bars_not_found',
            symbol: 'ZZZZ',
            timeframe: '1Day',
        });
    });

    it('공급자 오류는 던진다(실행기가 tool_failed로 바꾼다)', async () => {
        getCachedBars.mockRejectedValue(new Error('provider down'));
        await expect(run({})).rejects.toThrow('provider down');
    });
});

describe('getChartDataTool — 응답 크기 안전망', () => {
    it('상한을 넘으면 오래된 봉부터 줄이고 최신 봉을 남기며 사실을 알린다', async () => {
        const full = await run({ bars: 300 });
        const fullLength = JSON.stringify(full).length;
        const limit = Math.floor(fullLength / 3);
        const limited = await run({ bars: 300 }, 'pro', limit);
        // 라우트가 보내는 응답 전체({ data, meta: { tool } } 봉투 포함)가 상한 안이다.
        const sent = JSON.stringify({
            data: limited,
            meta: { tool: 'get_chart_data' },
        });
        expect(sent.length).toBeLessThanOrEqual(limit);
        expect(limited.bars).toBeLessThan(300);
        expect(limited.bars).toBeGreaterThan(0);
        expect(limited.meta.barsLimitedBySize).toBe(true);
        expect(limited.meta.barsRequested).toBe(300);
        expect(limited.time.at(-1)).toBe(bars.at(-1)!.time);
        for (const [, series] of Object.entries(limited.indicators))
            if (Array.isArray(series))
                expect(series).toHaveLength(limited.bars);
    });

    it('상한 안이면 줄이지 않는다', async () => {
        const data = await run({ bars: 100 });
        expect(data.meta.barsLimitedBySize).toBe(false);
        expect(data.bars).toBe(100);
    });

    it('기본 상한에서 전체 지표 × 500봉(여기선 300봉 보유)이 걸리지 않는다', async () => {
        const data = await run({ bars: 500 });
        expect(data.meta.barsLimitedBySize).toBe(false);
    });
});
