const { quote, chart, getOrSetCache, isE2E } = vi.hoisted(() => ({
    quote: vi.fn(),
    chart: vi.fn(),
    getOrSetCache: vi.fn(),
    isE2E: vi.fn(),
}));
vi.mock('@/shared/api/yahoo/createYahooClient', () => ({
    getYahooClient: () => ({ quote, chart }),
}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));
vi.mock('@/shared/api/e2eEnv', () => ({
    isE2EFakeMode: () => isE2E() && process.env.AGENT_REAL_PROVIDER !== '1',
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getYahooMacroDailyCloses,
    getYahooMacroQuotes,
    mapDailyCloses,
    mapMacroQuote,
} from '@/shared/api/yahoo/yahooMacroSource';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/shared/config/time';

type Fetcher = () => Promise<unknown>;

/** 2026-11-15 `CL=F` 실측. */
const CL = {
    shortName: 'Crude Oil Dec 26',
    regularMarketPrice: 88.56,
    regularMarketChangePercent: -0.2,
    currency: 'USD',
    exchangeDataDelayedBy: 10,
    regularMarketTime: new Date('2026-11-14T21:59:00Z'),
    quoteType: 'FUTURE',
    expireIsoDate: new Date('2026-11-20T00:00:00.000Z'),
};
/** 2026-11-15 `KRW=X` 실측(만기 없음, 지연 0). */
const KRW = {
    shortName: 'USD/KRW',
    regularMarketPrice: 1336.2,
    regularMarketChangePercent: 0.1,
    currency: 'KRW',
    exchangeDataDelayedBy: 0,
    regularMarketTime: new Date('2026-11-14T22:00:00Z'),
    quoteType: 'CURRENCY',
};

describe('mapMacroQuote', () => {
    it('선물: 이름·지연·만기를 옮기고 Date를 ISO로 바꾼다', () => {
        expect(mapMacroQuote(CL)).toEqual({
            name: 'Crude Oil Dec 26',
            price: 88.56,
            changePct: -0.2,
            currency: 'USD',
            delayMinutes: 10,
            timeIso: '2026-11-14T21:59:00.000Z',
            quoteType: 'FUTURE',
            contractExpiryIso: '2026-11-20T00:00:00.000Z',
        });
    });

    it('환율: 만기 없음은 null', () => {
        expect(mapMacroQuote(KRW)).toMatchObject({
            currency: 'KRW',
            delayMinutes: 0,
            quoteType: 'CURRENCY',
            contractExpiryIso: null,
        });
    });

    it('가격이 유한한 숫자가 아니면 시세 없음(null)', () => {
        expect(
            mapMacroQuote({ ...CL, regularMarketPrice: undefined })
        ).toBeNull();
        expect(mapMacroQuote({ ...CL, regularMarketPrice: NaN })).toBeNull();
        expect(mapMacroQuote(null)).toBeNull();
    });
});

describe('mapDailyCloses', () => {
    it('종가 없는 행을 버리고 오래된 순으로 정렬하며 high/low는 없으면 null이다', () => {
        const { rows, timeZone } = mapDailyCloses({
            meta: { exchangeTimezoneName: 'America/New_York' },
            quotes: [
                {
                    date: new Date('2026-11-13T05:00:00Z'),
                    close: 90,
                    high: 91,
                    low: 89,
                },
                {
                    date: new Date('2026-11-12T05:00:00Z'),
                    close: null,
                    high: 1,
                    low: 1,
                },
                {
                    date: new Date('2026-11-11T05:00:00Z'),
                    close: 88,
                    high: null,
                    low: undefined,
                },
                { date: 'bad', close: 1 },
            ],
        });
        expect(timeZone).toBe('America/New_York');
        expect(rows).toEqual([
            { date: '2026-11-11', close: 88, high: null, low: null },
            { date: '2026-11-13', close: 90, high: 91, low: 89 },
        ]);
    });

    it('FX 일봉(런던 자정, 서머타임엔 전날 23:00 UTC)은 거래소 현지 날짜로 읽는다', () => {
        const { rows } = mapDailyCloses({
            meta: { exchangeTimezoneName: 'Europe/London' },
            quotes: [
                { date: new Date('2025-06-30T23:00:00Z'), close: 1336.2 }, // BST 7/1 00:00
                { date: new Date('2025-12-01T00:00:00Z'), close: 1400 }, // GMT 12/1 00:00
            ],
        });
        expect(rows.map(r => r.date)).toEqual(['2025-07-01', '2025-12-01']);
    });

    it('선물 일봉(뉴욕, 여름 04:00Z)은 UTC 날짜와 같은 날로 남는다', () => {
        const { rows } = mapDailyCloses({
            meta: { exchangeTimezoneName: 'America/New_York' },
            quotes: [{ date: new Date('2025-06-30T04:00:00Z'), close: 88 }],
        });
        expect(rows[0]!.date).toBe('2025-06-30');
    });

    it('시간대가 없거나 알 수 없으면 UTC로 읽는다', () => {
        const quotes = [{ date: new Date('2025-06-30T23:00:00Z'), close: 1 }];
        expect(mapDailyCloses({ quotes }).timeZone).toBe('UTC');
        expect(mapDailyCloses({ quotes }).rows[0]!.date).toBe('2025-06-30');
        expect(
            mapDailyCloses({
                meta: { exchangeTimezoneName: 'Mars/Base' },
                quotes,
            }).timeZone
        ).toBe('UTC');
    });

    it('quotes가 없으면 빈 행', () => {
        expect(mapDailyCloses({}).rows).toEqual([]);
        expect(mapDailyCloses(null).rows).toEqual([]);
    });
});

describe('getYahooMacroQuote / getYahooMacroDailyCloses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isE2E.mockReturnValue(false);
        quote.mockRejectedValue(new Error('unexpected network call'));
        chart.mockRejectedValue(new Error('unexpected network call'));
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: Fetcher) => fetcher()
        );
    });

    it('E2E에서는 네트워크 없이 null', async () => {
        isE2E.mockReturnValue(true);
        expect([...(await getYahooMacroQuotes(['CL=F'])).values()]).toEqual([
            null,
        ]);
        expect(await getYahooMacroDailyCloses('CL=F')).toBeNull();
        expect(quote).not.toHaveBeenCalled();
        expect(chart).not.toHaveBeenCalled();
    });

    const sym = (symbol: string, over: Record<string, unknown> = {}) => ({
        ...(symbol === 'KRW=X' ? KRW : CL),
        symbol,
        ...over,
    });

    it('E2E여도 AGENT_REAL_PROVIDER=1이면 실제로 부른다', async () => {
        isE2E.mockReturnValue(true);
        vi.stubEnv('AGENT_REAL_PROVIDER', '1');
        quote.mockResolvedValue([sym('CL=F')]);
        expect((await getYahooMacroQuotes(['CL=F'])).get('CL=F')?.price).toBe(
            88.56
        );
        vi.unstubAllEnvs();
    });

    it('여러 심볼은 quote 한 번으로 묶어 받고 심볼별 60초 키로 캐시한다', async () => {
        quote.mockResolvedValue([sym('CL=F'), sym('KRW=X')]);
        const r = await getYahooMacroQuotes(['CL=F', 'KRW=X', 'CL=F']);
        expect(quote).toHaveBeenCalledTimes(1);
        // 인덱스가 아니라 인자로 호출을 찾는다(앞 테스트의 늦은 호출이 0번을 차지할 수 있다).
        expect(quote).toHaveBeenCalledWith(
            expect.arrayContaining(['CL=F', 'KRW=X']),
            {},
            { validateResult: false }
        );
        const batch = quote.mock.calls.find(([symbols]) =>
            (symbols as string[]).includes('KRW=X')
        );
        expect([...(batch?.[0] as string[])].sort()).toEqual(['CL=F', 'KRW=X']);
        expect(r.get('CL=F')?.price).toBe(88.56);
        expect(r.get('KRW=X')?.delayMinutes).toBe(0);
        const keys = getOrSetCache.mock.calls.map(c => c[0]).sort();
        expect(keys).toEqual([
            'yahoo:macro-quote:v1:CL=F',
            'yahoo:macro-quote:v1:KRW=X',
        ]);
        expect(
            getOrSetCache.mock.calls.every(c => c[1] === SECONDS_PER_MINUTE)
        ).toBe(true);
    });

    it('캐시 hit인 심볼은 묶음에서 빠지고 miss만 요청한다', async () => {
        getOrSetCache.mockImplementation(
            async (key: string, _t: number, fetcher: Fetcher) =>
                key.endsWith(':CL=F') ? mapMacroQuote(CL) : fetcher()
        );
        quote.mockResolvedValue([sym('KRW=X')]);
        const r = await getYahooMacroQuotes(['CL=F', 'KRW=X']);
        expect(quote).toHaveBeenCalledTimes(1);
        expect(quote).toHaveBeenCalledWith(['KRW=X'], {}, expect.anything());
        expect(r.get('CL=F')?.price).toBe(88.56);
    });

    it('응답에 없는 심볼만 null이고 나머지는 살아 있다(실패는 캐시되지 않는다)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const threw: string[] = [];
        getOrSetCache.mockImplementation(
            async (key: string, _t: number, fetcher: Fetcher) => {
                try {
                    return await fetcher();
                } catch (error) {
                    threw.push(key);
                    throw error;
                }
            }
        );
        quote.mockResolvedValue([sym('CL=F')]);
        const r = await getYahooMacroQuotes(['CL=F', 'KRW=X']);
        expect(r.get('CL=F')?.price).toBe(88.56);
        expect(r.get('KRW=X')).toBeNull();
        expect(threw).toEqual(['yahoo:macro-quote:v1:KRW=X']);
        warn.mockRestore();
    });

    it('가격이 없는 항목도 그 심볼만 null', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        quote.mockResolvedValue([
            sym('CL=F'),
            sym('KRW=X', { regularMarketPrice: undefined }),
        ]);
        const r = await getYahooMacroQuotes(['CL=F', 'KRW=X']);
        expect(r.get('CL=F')).not.toBeNull();
        expect(r.get('KRW=X')).toBeNull();
        warn.mockRestore();
    });

    it('묶음 호출 자체가 실패하면 캐시 miss였던 전부 null', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        quote.mockRejectedValue(new Error('429'));
        const r = await getYahooMacroQuotes(['CL=F', 'KRW=X']);
        expect([...r.values()]).toEqual([null, null]);
        warn.mockRestore();
    });

    it('단일 심볼 응답이 배열이 아니어도 읽는다', async () => {
        quote.mockResolvedValue(sym('CL=F'));
        expect((await getYahooMacroQuotes(['CL=F'])).get('CL=F')?.price).toBe(
            88.56
        );
    });

    it('일봉: 1d 간격·약 400일 창·1시간 캐시, 종가 없는 행은 버린다', async () => {
        chart.mockResolvedValue({
            quotes: [
                {
                    date: new Date('2026-11-12T05:00:00Z'),
                    close: 88,
                    high: 89,
                    low: 87,
                },
                { date: new Date('2026-11-13T05:00:00Z'), close: null },
            ],
        });
        const r = await getYahooMacroDailyCloses('GC=F');
        expect(r).toEqual({
            timeZone: 'UTC',
            rows: [{ date: '2026-11-12', close: 88, high: 89, low: 87 }],
        });
        const [symbol, opts, mod] = chart.mock.calls.find(
            ([s]) => s === 'GC=F'
        )!;
        expect(symbol).toBe('GC=F');
        expect(opts.interval).toBe('1d');
        const spanDays =
            (opts.period2.getTime() - opts.period1.getTime()) / 86_400_000;
        expect(spanDays).toBeGreaterThanOrEqual(395);
        expect(spanDays).toBeLessThanOrEqual(405);
        expect(mod).toEqual({ validateResult: false });
        expect(getOrSetCache).toHaveBeenCalledWith(
            'yahoo:macro-daily:v2:GC=F',
            SECONDS_PER_HOUR,
            expect.any(Function)
        );
    });

    it('일봉이 비었거나 실패하면 캐시 없이 null', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        chart.mockResolvedValueOnce({ quotes: [] });
        expect(await getYahooMacroDailyCloses('GC=F')).toBeNull();
        chart.mockRejectedValueOnce(new Error('timeout'));
        expect(await getYahooMacroDailyCloses('GC=F')).toBeNull();
        warn.mockRestore();
    });
});
