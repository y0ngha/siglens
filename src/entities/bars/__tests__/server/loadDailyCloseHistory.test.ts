import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { fmp, yahoo, e2e } = vi.hoisted(() => ({
    fmp: { get: vi.fn() },
    yahoo: { chart: vi.fn() },
    e2e: { fake: false },
}));
vi.mock('@/shared/api/fmp/httpClient', () => ({ fmpGet: fmp.get }));
vi.mock('@/shared/api/yahoo/createYahooClient', () => ({
    getYahooClient: () => ({ chart: yahoo.chart }),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2EFakeMode: () => e2e.fake }));

import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { loadDailyCloseHistory } from '../../server/loadDailyCloseHistory';

/** 월요일 22:00 ET — 마감(16:00) + EOD 게시 여유(4시간)가 지났다. 마지막 마감 세션은 11-16. */
const US_AFTER_BUFFER = new Date('2026-11-17T03:00:00Z');
/** 월요일 17:00 ET — 장은 닫혔지만 게시 여유 안이다. 마지막 마감 세션은 금요일 11-13. */
const US_WITHIN_BUFFER = new Date('2026-11-16T22:00:00Z');
const KR_SESSION = sessionSpecFor('kr-equity');

type Query = { symbol: string; from: string; to: string };

/** 상장 연도부터 구간마다 시작일 근처 행을 주고, 2020년대 구간에는 11-13·11-16 행을 더한다(FMP처럼 최신 행이 앞). */
function listedFrom(firstYear: number) {
    fmp.get.mockImplementation(async (_path: string, query: Query) => {
        const year = Number(query.from.slice(0, 4));
        if (year + 9 < firstYear) return [];
        const start = year < firstYear ? `${firstYear}-03-01` : `${year}-01-03`;
        const tail =
            year === 2020
                ? [
                      { date: '2026-11-16', price: 120 },
                      { date: '2026-11-13', price: 110 },
                  ]
                : [];
        return [...tail, { date: start, price: 100 }];
    });
}

/** 2010년 구간의 첫 행만 `firstDate`로 두고 나머지 구간은 시작일 근처에서 시작한다. */
function chunk2010StartsAt(firstDate: string | null) {
    fmp.get.mockImplementation(async (_path: string, query: Query) => {
        if (query.from === '2010-01-01')
            return firstDate === null ? [] : [{ date: firstDate, price: 100 }];
        return query.from >= '2000-01-01'
            ? [{ date: query.from.replace('-01-01', '-01-03'), price: 100 }]
            : [];
    });
}

const loadUs = (now: Date = US_AFTER_BUFFER) =>
    loadDailyCloseHistory({
        symbol: 'QQQ',
        source: 'fmp',
        session: US_EQUITY_SESSION,
        now,
    });

describe('loadDailyCloseHistory — FMP', () => {
    beforeEach(() => {
        fmp.get.mockReset();
        e2e.fake = false;
    });

    it('1970년부터 10년 구간을 재시도 없이 받고, 마지막 구간은 마지막 마감 세션에서 끝낸다', async () => {
        listedFrom(1999);
        await loadUs();
        const expected = [
            ['1970-01-01', '1979-12-31'],
            ['1980-01-01', '1989-12-31'],
            ['1990-01-01', '1999-12-31'],
            ['2000-01-01', '2009-12-31'],
            ['2010-01-01', '2019-12-31'],
            ['2020-01-01', '2026-11-16'],
        ];
        expect(fmp.get).toHaveBeenCalledTimes(expected.length);
        expected.forEach(([from, to]) =>
            expect(fmp.get).toHaveBeenCalledWith(
                'historical-price-eod/light',
                { symbol: 'QQQ', from, to },
                { retryTransient: false }
            )
        );
    });

    it('구간을 합쳐 오래된 순으로 정렬한다', async () => {
        listedFrom(1999);
        const rows = await loadUs();
        expect(rows.map(row => row.date)).toEqual([
            '1999-03-01',
            '2000-01-03',
            '2010-01-03',
            '2020-01-03',
            '2026-11-13',
            '2026-11-16',
        ]);
    });

    it('마감 뒤 게시 여유 안에서는 그날 행을 아직 확정되지 않은 값으로 보고 뺀다', async () => {
        listedFrom(2020);
        const rows = await loadUs(US_WITHIN_BUFFER);
        expect(rows.at(-1)).toEqual({ date: '2026-11-13', close: 110 });
        expect(fmp.get).toHaveBeenCalledWith(
            'historical-price-eod/light',
            { symbol: 'QQQ', from: '2020-01-01', to: '2026-11-13' },
            { retryTransient: false }
        );
    });

    it('크립토는 어제(UTC)까지가 완결 세션이다', async () => {
        listedFrom(2020);
        const rows = await loadDailyCloseHistory({
            symbol: 'BTCUSD',
            source: 'fmp',
            session: CRYPTO_SESSION,
            now: new Date('2026-11-16T05:00:00Z'),
        });
        expect(rows.at(-1)?.date).toBe('2026-11-13');
        // 미국 세션으로 떨어졌다면 금요일(11-13)에서 끝났을 것이다.
        expect(fmp.get).toHaveBeenCalledWith(
            'historical-price-eod/light',
            { symbol: 'BTCUSD', from: '2020-01-01', to: '2026-11-15' },
            { retryTransient: false }
        );
    });

    it('상장 첫 구간은 늦게 시작해도 된다', async () => {
        listedFrom(2024);
        const rows = await loadUs();
        expect(rows[0]?.date).toBe('2024-03-01');
    });

    it('앞 구간에 이력이 있는데 구간 첫 행이 여유(45일)보다 늦으면 빠진 구간으로 보고 던진다', async () => {
        chunk2010StartsAt('2010-02-16');
        await expect(loadUs()).rejects.toThrow('2010-01-01 has a gap');
    });

    it('구간 첫 행이 여유(45일) 안이면 받아들인다', async () => {
        chunk2010StartsAt('2010-02-15');
        await expect(loadUs()).resolves.toHaveLength(3);
    });

    it('앞 구간에 이력이 있는데 구간이 비어 있으면 빠진 구간으로 보고 던진다', async () => {
        chunk2010StartsAt(null);
        await expect(loadUs()).rejects.toThrow('2010-01-01 has a gap');
    });

    it('원본 행이 상한(5,000)에 닿으면 버려지는 행이 섞여 있어도 잘린 응답으로 보고 던진다', async () => {
        fmp.get.mockResolvedValue([
            ...Array.from({ length: 4990 }, () => ({
                date: '2020-01-03',
                price: 1,
            })),
            ...Array.from({ length: 10 }, () => ({
                date: '2020-01-03',
                price: null,
            })),
        ]);
        await expect(loadUs()).rejects.toThrow('row cap');
    });

    it('구간 하나라도 실패하면 던진다', async () => {
        fmp.get.mockRejectedValue(new Error('fmp down'));
        await expect(loadUs()).rejects.toThrow('fmp down');
    });

    it('배열이 아닌 응답은 던진다', async () => {
        fmp.get.mockResolvedValue({ error: 'x' });
        await expect(loadUs()).rejects.toThrow('malformed');
    });

    it('이력이 없는 종목은 빈 배열이다', async () => {
        fmp.get.mockResolvedValue([]);
        await expect(loadUs()).resolves.toEqual([]);
    });

    it('E2E fake 모드에서는 네트워크에 나가지 않고 던진다', async () => {
        e2e.fake = true;
        await expect(loadUs()).rejects.toThrow('E2E');
        expect(fmp.get).not.toHaveBeenCalled();
    });
});

describe('loadDailyCloseHistory — Yahoo(한국)', () => {
    beforeEach(() => {
        yahoo.chart.mockReset();
        e2e.fake = false;
    });

    /** 날짜는 KST 09:00(= UTC 00:00) 봉이다. */
    const quotes = [
        { date: new Date('2026-11-12T00:00:00Z'), close: 100, adjclose: 90 },
        { date: new Date('2026-11-13T00:00:00Z'), close: null },
        { date: new Date('2026-11-14T00:00:00Z'), close: 0 },
        { date: 'not a date', close: 5 },
        { date: new Date('2026-11-16T00:00:00Z'), close: 110 },
    ];
    const lateUtcQuote = {
        date: new Date('2026-11-10T16:00:00Z'),
        close: 105,
    };
    const loadKr = (now: Date) =>
        loadDailyCloseHistory({
            symbol: '005930.KS',
            source: 'yahoo',
            session: KR_SESSION,
            now,
        });

    it('일봉 전체를 한 번에 요청한다', async () => {
        yahoo.chart.mockResolvedValue({ quotes });
        await loadKr(new Date('2026-11-16T12:00:00Z'));
        expect(yahoo.chart).toHaveBeenCalledWith(
            '005930.KS',
            { period1: '1970-01-01', interval: '1d' },
            { validateResult: false }
        );
    });

    it('KST 날짜와 분할 반영 종가(close)를 쓰고 adjclose·결측·0은 버린다', async () => {
        yahoo.chart.mockResolvedValue({ quotes });
        // 21:00 KST — 마감(15:30) + 게시 여유가 지났다.
        const rows = await loadKr(new Date('2026-11-16T12:00:00Z'));
        expect(rows).toEqual([
            { date: '2026-11-12', close: 100 },
            { date: '2026-11-16', close: 110 },
        ]);
    });

    it('날짜는 UTC가 아니라 거래소 시간대(KST) 날짜다', async () => {
        // 2026-11-10T16:00Z는 UTC로 11-10, KST로 11-11 01:00이다.
        yahoo.chart.mockResolvedValue({ quotes: [lateUtcQuote] });
        const rows = await loadKr(new Date('2026-11-16T12:00:00Z'));
        expect(rows).toEqual([{ date: '2026-11-11', close: 105 }]);
    });

    it('장중(KRX)에는 오늘 행을 뺀다', async () => {
        yahoo.chart.mockResolvedValue({ quotes });
        // 11:00 KST
        const rows = await loadKr(new Date('2026-11-16T02:00:00Z'));
        expect(rows.map(row => row.date)).toEqual(['2026-11-12']);
    });

    it('quotes가 배열이 아니면 던진다', async () => {
        yahoo.chart.mockResolvedValue({});
        await expect(loadKr(US_AFTER_BUFFER)).rejects.toThrow('malformed');
    });
});
