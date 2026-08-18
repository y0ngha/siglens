import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const chart = vi.fn();
vi.mock('@/shared/api/yahoo/createYahooClient', () => ({
    createYahooClient: () => ({ chart }),
}));

import {
    fetchKrDailyCloses,
    krLookbackStartDate,
} from '@/entities/market-fear-greed/lib/fetchKrDailyCloses';
import { MARKET_FEAR_GREED_KR_LOOKBACK_DAYS } from '@/entities/market-fear-greed/lib/marketFearGreedKrSymbols';
import { MS_PER_DAY } from '@/shared/config/time';

const FROM = new Date('2026-01-01T00:00:00.000Z');
const TO = new Date('2026-08-18T00:00:00.000Z');

describe('krLookbackStartDate', () => {
    it('(Happy) lookback 일수만큼 과거로 물러난다', () => {
        const now = new Date('2026-08-18T09:00:00.000Z');

        expect(krLookbackStartDate(now).getTime()).toBe(
            now.getTime() - MARKET_FEAR_GREED_KR_LOOKBACK_DAYS * MS_PER_DAY
        );
    });
});

describe('fetchKrDailyCloses', () => {
    const originalE2E = process.env.E2E_TEST;

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.E2E_TEST;
    });
    afterEach(() => {
        if (originalE2E === undefined) delete process.env.E2E_TEST;
        else process.env.E2E_TEST = originalE2E;
    });

    it('(Happy) yahoo chart 행을 KST 달력일 종가로 변환한다', async () => {
        chart.mockResolvedValue({
            quotes: [
                { date: new Date('2026-08-17T06:30:00.000Z'), close: 3200.5 },
                { date: new Date('2026-08-18T06:30:00.000Z'), close: 3225 },
            ],
        });

        const closes = await fetchKrDailyCloses('^KS11', FROM, TO);

        expect(closes).toEqual([
            { date: '2026-08-17', close: 3200.5 },
            { date: '2026-08-18', close: 3225 },
        ]);
        expect(chart).toHaveBeenCalledWith('^KS11', {
            period1: FROM,
            period2: TO,
            interval: '1d',
        });
    });

    /**
     * KRX 15:30 마감은 06:30 UTC라 `toISOString()`으로도 같은 날이 나오지만,
     * 원화 24시간물처럼 UTC 자정을 넘는 시리즈는 하루가 밀린다. core가 여섯 시리즈를
     * 날짜로 inner join하므로 하루만 어긋나도 표본이 통째로 빈다.
     */
    it('(Edge) UTC 자정을 넘는 인스턴트도 KST 달력일로 붙는다', async () => {
        chart.mockResolvedValue({
            quotes: [
                { date: new Date('2026-08-17T21:00:00.000Z'), close: 1390 },
            ],
        });

        const [row] = await fetchKrDailyCloses('KRW=X', FROM, TO);

        expect(row?.date).toBe('2026-08-18');
    });

    it.each([
        [
            'close가 null',
            { date: new Date('2026-08-17T06:30:00Z'), close: null },
        ],
        ['close가 0', { date: new Date('2026-08-17T06:30:00Z'), close: 0 }],
        [
            'close가 NaN',
            { date: new Date('2026-08-17T06:30:00Z'), close: Number.NaN },
        ],
        ['date가 없음', { close: 3200 }],
    ])('(Edge) %s인 행은 버린다', async (_label, badRow) => {
        chart.mockResolvedValue({
            quotes: [
                badRow,
                { date: new Date('2026-08-18T06:30:00.000Z'), close: 3225 },
            ],
        });

        const closes = await fetchKrDailyCloses('^KS11', FROM, TO);

        expect(closes).toEqual([{ date: '2026-08-18', close: 3225 }]);
    });

    /**
     * 빈 배열을 조용히 돌려주면 `getOrSetCache`가 그대로 캐싱해 업스트림 장애가
     * "표본이 부족합니다" 화면으로 굳는다.
     */
    it('(Worst) 쓸 수 있는 행이 하나도 없으면 throw한다', async () => {
        chart.mockResolvedValue({ quotes: [] });

        await expect(fetchKrDailyCloses('^KS11', FROM, TO)).rejects.toThrow(
            /no usable closes for \^KS11/
        );
    });

    it('(Worst) quotes 필드 자체가 없어도 throw한다 (조용한 빈 배열 금지)', async () => {
        chart.mockResolvedValue({});

        await expect(fetchKrDailyCloses('^KS11', FROM, TO)).rejects.toThrow(
            /no usable closes/
        );
    });

    it('(Edge) E2E에서는 yahoo를 호출하지 않고 fixture를 쓴다', async () => {
        process.env.E2E_TEST = '1';

        const closes = await fetchKrDailyCloses('^KS11', FROM, TO);

        expect(chart).not.toHaveBeenCalled();
        expect(closes.length).toBeGreaterThan(0);
    });
});
