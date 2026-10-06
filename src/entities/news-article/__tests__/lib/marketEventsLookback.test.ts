import { describe, expect, it } from 'vitest';
import type { Timeframe } from '@y0ngha/siglens-core';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { MS_PER_DAY } from '@/shared/config/time';

const NOW = new Date('2026-09-05T13:45:12.345Z');

/** 창 길이를 일 단위로 환산한다. */
function spanDays(timeframe: Timeframe): number {
    const { from, to } = marketEventsLookback(timeframe, NOW);
    return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

describe('marketEventsLookback', () => {
    it('상한은 넘겨준 `now` 그대로다', () => {
        expect(marketEventsLookback('1Day', NOW).to).toEqual(NOW);
    });

    it('타임프레임별 창 길이는 [N, N+1)일이다 — 하한을 UTC 자정으로 내리므로', () => {
        const expected: Array<[Timeframe, number]> = [
            ['5Min', 2],
            ['15Min', 3],
            ['30Min', 4],
            ['1Hour', 5],
            ['4Hour', 14],
            ['1Day', 60],
        ];
        for (const [timeframe, days] of expected) {
            expect(spanDays(timeframe)).toBeGreaterThanOrEqual(days);
            expect(spanDays(timeframe)).toBeLessThan(days + 1);
        }
    });

    it('`from`은 UTC 자정이다', () => {
        const { from } = marketEventsLookback('15Min', NOW);

        expect(from.getUTCHours()).toBe(0);
        expect(from.getUTCMinutes()).toBe(0);
        expect(from.getUTCSeconds()).toBe(0);
        expect(from.getUTCMilliseconds()).toBe(0);
        expect(from.toISOString()).toBe('2026-09-02T00:00:00.000Z');
    });

    it('같은 UTC 날짜 안의 서로 다른 `now`는 같은 `from`을 낸다 — 캐시 키 안정성', () => {
        const early = new Date('2026-09-05T00:00:00.000Z');
        const late = new Date('2026-09-05T23:59:59.999Z');

        for (const tf of ['5Min', '1Hour', '1Day'] as const) {
            expect(marketEventsLookback(tf, early).from).toEqual(
                marketEventsLookback(tf, late).from
            );
        }
    });

    it('UTC 자정을 넘기면 `from`이 정확히 하루 이동한다', () => {
        const before = new Date('2026-09-05T23:59:59.999Z');
        const after = new Date('2026-09-06T00:00:00.000Z');
        const shift =
            marketEventsLookback('1Day', after).from.getTime() -
            marketEventsLookback('1Day', before).from.getTime();

        expect(shift).toBe(MS_PER_DAY);
    });

    it('짧은 타임프레임일수록 창이 좁다', () => {
        // 5분봉 분석에 두 달치 뉴스가 실리면 안 된다. 봉이 덮는 실제 기간에
        // 비례해야 core 의 봉-범위 절단이 대부분을 버리지 않는다.
        const order: Timeframe[] = [
            '5Min',
            '15Min',
            '30Min',
            '1Hour',
            '4Hour',
            '1Day',
        ];
        const spans = order.map(spanDays);

        expect(spans).toEqual([...spans].toSorted((a, b) => a - b));
    });

    it('봉이 덮는 거래시간보다 넉넉하다 — 야간·주말 갭 때문', () => {
        // core 는 봉 범위로 자르는데 봉은 거래 시간만 센다. 15분봉 40개는
        // 거래시간 10시간이지만 밤과 주말을 건너뛰어 벽시계로는 며칠이다.
        // 창이 그보다 좁으면 core 가 볼 이벤트를 siglens 가 애초에 안 읽는다.
        const TRADING_HOURS_PER_DAY = 6.5;
        const barSpanDays = (bars: number, barMinutes: number) =>
            (bars * barMinutes) / 60 / TRADING_HOURS_PER_DAY;

        // 봉 개수는 예시값(5Min 48, 15Min 40, 1Day 30)이다. 창은 core 봉 범위의
        // 근사가 아니라 프롬프트에 실리는 이벤트의 실질 하한이다.
        expect(spanDays('5Min')).toBeGreaterThan(barSpanDays(48, 5));
        expect(spanDays('15Min')).toBeGreaterThan(barSpanDays(40, 15));
        expect(spanDays('1Day')).toBeGreaterThan(30);
    });

    it('`now` 를 생략하면 현재 시각을 쓴다', () => {
        const before = Date.now();
        const { to } = marketEventsLookback('1Day');
        const after = Date.now();

        expect(to.getTime()).toBeGreaterThanOrEqual(before);
        expect(to.getTime()).toBeLessThanOrEqual(after);
    });

    it('같은 입력이면 같은 창을 낸다 — 스트림과 pre-warm 이 캐시를 공유하는 근거', () => {
        // 두 경로가 다른 창을 쓰면 서로 다른 이벤트 집합을 core 에 넘기고,
        // core 가 그것을 캐시 키에 접으므로 pre-warm 이 채운 캐시를 방문자가
        // 맞히지 못한다.
        expect(marketEventsLookback('15Min', NOW)).toEqual(
            marketEventsLookback('15Min', NOW)
        );
    });
});
