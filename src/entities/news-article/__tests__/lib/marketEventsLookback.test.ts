import { describe, expect, it } from 'vitest';
import type { Timeframe } from '@y0ngha/siglens-core';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { MS_PER_DAY } from '@/shared/config/time';

const NOW = new Date('2026-09-05T00:00:00Z');

/** 창 길이를 일 단위로 환산한다. */
function spanDays(timeframe: Timeframe): number {
    const { from, to } = marketEventsLookback(timeframe, NOW);
    return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

describe('marketEventsLookback', () => {
    it('상한은 넘겨준 `now` 그대로다', () => {
        expect(marketEventsLookback('1Day', NOW).to).toEqual(NOW);
    });

    it('타임프레임별 창 길이', () => {
        expect(spanDays('5Min')).toBe(2);
        expect(spanDays('15Min')).toBe(3);
        expect(spanDays('30Min')).toBe(4);
        expect(spanDays('1Hour')).toBe(5);
        expect(spanDays('4Hour')).toBe(14);
        expect(spanDays('1Day')).toBe(60);
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

        // recentBarsCount: 5Min 48, 15Min 40, 1Day 30
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
