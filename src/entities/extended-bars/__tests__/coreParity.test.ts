import { describe, it, expect } from 'vitest';
import {
    fetchBarsWithIndicators,
    type Bar,
    type GetBarsOptions,
} from '@y0ngha/siglens-core';
import { extendedBarsFrom } from '@/entities/extended-bars/lib/extendedBarsRequest';
import {
    EXTENDED_BAR_INTERVAL_SECONDS,
    EXTENDED_BAR_TIMEFRAMES,
} from '@/shared/api/market/extendedBarsSession';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/shared/config/time';
import regular5Min from '../../../shared/api/fmp/__tests__/fixtures/regularBars.aapl.5min.json';
import regular1Hour from '../../../shared/api/fmp/__tests__/fixtures/regularBars.aapl.1hour.json';
import regular4Hour from '../../../shared/api/fmp/__tests__/fixtures/regularBars.aapl.4hour.json';

/**
 * core는 `TIMEFRAME_LOOKBACK_DAYS`·`TIMEFRAME_MINUTES`를 공개 export하지 않아(2.17.0 확인) 확장 봉 쪽에 같은
 * 값을 따로 둔다. 어긋나면 확장 봉 창이 정규장 봉 창과 달라지므로, **정규장 봉이 실제로 쓰는 값**과 대조해
 * 갈라지면 실패하게 한다.
 */
describe('정규장 봉 조회와의 일치(core 상수 미공개 대체)', () => {
    const NOW = new Date('2026-10-15T12:00:00Z');

    async function regularFrom(
        timeframe: (typeof EXTENDED_BAR_TIMEFRAMES)[number]
    ): Promise<string> {
        let captured: GetBarsOptions | null = null;
        await fetchBarsWithIndicators(
            {
                getBars: async (options: GetBarsOptions): Promise<Bar[]> => {
                    captured = options;
                    return [];
                },
                getQuote: async () => null,
            },
            'AAPL',
            timeframe,
            undefined,
            NOW
        );
        return (captured as GetBarsOptions | null)!.from!;
    }

    it.each(EXTENDED_BAR_TIMEFRAMES)(
        '%s: 확장 봉 조회 창(from)이 정규장 봉이 core에서 쓰는 from과 같다',
        async timeframe => {
            expect(extendedBarsFrom(timeframe, NOW)).toBe(
                await regularFrom(timeframe)
            );
        }
    );

    it.each(EXTENDED_BAR_TIMEFRAMES)(
        '%s: 봉 길이(초)가 타임프레임 이름이 말하는 길이와 같다',
        timeframe => {
            const amount = Number.parseInt(timeframe, 10);
            const unit = timeframe.endsWith('Hour')
                ? SECONDS_PER_HOUR
                : SECONDS_PER_MINUTE;
            expect(EXTENDED_BAR_INTERVAL_SECONDS[timeframe]).toBe(
                amount * unit
            );
        }
    );

    it.each([
        ['5Min', regular5Min],
        ['1Hour', regular1Hour],
    ] as const)(
        '%s: 실제 정규장 봉 간격이 봉 길이 상수와 같다',
        (timeframe, rows) => {
            // FMP 응답은 최신순 — 인접한 두 봉의 시각 차
            const [newer, older] = rows as readonly { date: string }[];
            const gap =
                (Date.parse(`${newer!.date.replace(' ', 'T')}Z`) -
                    Date.parse(`${older!.date.replace(' ', 'T')}Z`)) /
                1000;
            expect(gap).toBe(EXTENDED_BAR_INTERVAL_SECONDS[timeframe]);
        }
    );

    it('4Hour: 실제 정규장 첫 봉(09:30)과 둘째 봉(13:30)의 간격이 봉 길이 상수와 같다', () => {
        const [second, first] = regular4Hour as readonly { date: string }[];
        const gap =
            (Date.parse(`${second!.date.replace(' ', 'T')}Z`) -
                Date.parse(`${first!.date.replace(' ', 'T')}Z`)) /
            1000;
        expect(gap).toBe(EXTENDED_BAR_INTERVAL_SECONDS['4Hour']);
    });
});
