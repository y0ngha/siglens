import { describe, expect, it } from 'vitest';
import {
    CRYPTO_SESSION,
    US_EQUITY_SESSION,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { MS_PER_DAY, MS_PER_MINUTE } from '@/shared/config/time';

// 2026-09-05는 토요일이다(NYSE·KRX 모두 휴장). 2026-09-07(월)은 NYSE 노동절 휴장.
const NOW = new Date('2026-09-05T13:45:12.345Z');

/** 창 길이를 일 단위로 환산한다. */
function spanDays(timeframe: Timeframe): number {
    const { from, to } = marketEventsLookback(
        timeframe,
        US_EQUITY_SESSION,
        NOW
    );
    return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

function toIso(
    timeframe: Timeframe,
    session: Parameters<typeof marketEventsLookback>[1],
    now: string
): string {
    return marketEventsLookback(
        timeframe,
        session,
        new Date(now)
    ).to.toISOString();
}

describe('marketEventsLookback', () => {
    it('장중 타임프레임의 상한은 core TTL 버킷(UTC 20:00 = KST 05:00 정렬)의 시작이다', () => {
        // core prior-analysis 창(`priorAnalysisWindowStartMs`)과 같은 버킷 — 세션과 무관하다.
        const expected: Array<[Timeframe, string]> = [
            ['5Min', '2026-09-05T13:45:00.000Z'],
            ['15Min', '2026-09-05T13:45:00.000Z'],
            ['30Min', '2026-09-05T13:30:00.000Z'],
            ['1Hour', '2026-09-05T13:00:00.000Z'],
            ['4Hour', '2026-09-05T12:00:00.000Z'],
        ];
        for (const [timeframe, to] of expected) {
            for (const session of [
                US_EQUITY_SESSION,
                KR_EQUITY_SESSION,
                CRYPTO_SESSION,
            ]) {
                expect(toIso(timeframe, session, NOW.toISOString())).toBe(to);
            }
        }
    });

    /**
     * 1Day는 core 분석 캐시 만료(`computeEffectiveTtl` — scheduled는 다음 정규장 마감 +
     * 30분, always-open은 다음 UTC 자정)와 같은 경계를 쓴다. 상한 = **직전** 경계.
     */
    describe('1Day — 세션 정렬', () => {
        it('미국: 장중에는 직전 거래일 마감(16:00 EDT) + 30분이다', () => {
            // 2026-09-09(수) 11:00 EDT
            expect(
                toIso('1Day', US_EQUITY_SESSION, '2026-09-09T15:00:00Z')
            ).toBe('2026-09-08T20:30:00.000Z');
        });

        it('미국: 마감 + 30분 정각에 그날 경계로 넘어간다(core의 `atMs > now`와 짝)', () => {
            expect(
                toIso('1Day', US_EQUITY_SESSION, '2026-09-09T20:29:59.999Z')
            ).toBe('2026-09-08T20:30:00.000Z');
            expect(
                toIso('1Day', US_EQUITY_SESSION, '2026-09-09T20:30:00.000Z')
            ).toBe('2026-09-09T20:30:00.000Z');
        });

        it('미국: 주말·NYSE 휴장일(노동절)을 건너뛴다', () => {
            // 토요일 → 금요일 마감. 화요일 장중 → 월요일(노동절)을 건너뛴 금요일 마감.
            expect(toIso('1Day', US_EQUITY_SESSION, NOW.toISOString())).toBe(
                '2026-09-04T20:30:00.000Z'
            );
            expect(
                toIso('1Day', US_EQUITY_SESSION, '2026-09-08T15:00:00Z')
            ).toBe('2026-09-04T20:30:00.000Z');
        });

        it('한국: 장중에는 직전 KRX 마감(15:30 KST = 06:30Z) + 30분이다', () => {
            // 2026-09-09(수) 12:00 KST
            expect(
                toIso('1Day', KR_EQUITY_SESSION, '2026-09-09T03:00:00Z')
            ).toBe('2026-09-08T07:00:00.000Z');
            expect(
                toIso('1Day', KR_EQUITY_SESSION, '2026-09-09T07:00:00Z')
            ).toBe('2026-09-09T07:00:00.000Z');
        });

        /**
         * 회귀(2026-10 리뷰): 고정 UTC 20:00 버킷을 쓰던 초안은 KR 캐시 창(07:00Z→07:00Z)
         * 안에서 20:00Z에 키를 한 번 더 뒤집었다.
         */
        it('한국: 한 캐시 창(마감+30분 → 다음 마감+30분) 안에서는 구간이 고정이다', () => {
            const early = marketEventsLookback(
                '1Day',
                KR_EQUITY_SESSION,
                new Date('2026-09-08T07:00:00.000Z')
            );
            for (const t of [
                '2026-09-08T20:00:00.000Z',
                '2026-09-09T00:00:00.000Z',
                '2026-09-09T06:59:59.999Z',
            ]) {
                expect(
                    marketEventsLookback('1Day', KR_EQUITY_SESSION, new Date(t))
                ).toEqual(early);
            }
        });

        it('크립토: 오늘 UTC 자정이다(core 만료 = 다음 UTC 자정)', () => {
            expect(toIso('1Day', CRYPTO_SESSION, NOW.toISOString())).toBe(
                '2026-09-05T00:00:00.000Z'
            );
            expect(
                toIso('1Day', CRYPTO_SESSION, '2026-09-05T23:59:59.999Z')
            ).toBe('2026-09-05T00:00:00.000Z');
        });

        it('하한은 창 시작이 속한 UTC 날짜의 자정 − 60일이다', () => {
            const { from } = marketEventsLookback(
                '1Day',
                KR_EQUITY_SESSION,
                new Date('2026-09-09T03:00:00Z')
            );
            expect(from.toISOString()).toBe('2026-07-10T00:00:00.000Z');
        });
    });

    /**
     * 회귀(2026-10 비용 감사): 상한이 `now`이던 때는 창 안에서 새 고영향 기사가
     * 들어올 때마다 이벤트 집합(= core 캐시 키)이 바뀌어 같은 창 안에서 분석을
     * 다시 생성했다.
     */
    it('같은 캐시 창 안의 서로 다른 `now`는 같은 구간을 낸다', () => {
        const pairs: Array<[Timeframe, string, string]> = [
            ['5Min', '2026-09-05T13:45:00.000Z', '2026-09-05T13:49:59.999Z'],
            ['1Hour', '2026-09-05T13:00:00.000Z', '2026-09-05T13:59:59.999Z'],
            ['4Hour', '2026-09-05T12:00:00.000Z', '2026-09-05T15:59:59.999Z'],
            ['1Day', '2026-09-08T20:30:00.000Z', '2026-09-09T20:29:59.999Z'],
        ];
        for (const [timeframe, early, late] of pairs) {
            expect(
                marketEventsLookback(
                    timeframe,
                    US_EQUITY_SESSION,
                    new Date(early)
                )
            ).toEqual(
                marketEventsLookback(
                    timeframe,
                    US_EQUITY_SESSION,
                    new Date(late)
                )
            );
        }
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
        const { from } = marketEventsLookback('15Min', US_EQUITY_SESSION, NOW);

        expect(from.toISOString()).toBe('2026-09-02T00:00:00.000Z');
    });

    it('UTC 자정을 넘기면 장중 타임프레임의 `from`이 정확히 하루 이동한다', () => {
        const before = new Date('2026-09-05T23:59:59.999Z');
        const after = new Date('2026-09-06T00:00:00.000Z');
        const shift =
            marketEventsLookback(
                '1Hour',
                US_EQUITY_SESSION,
                after
            ).from.getTime() -
            marketEventsLookback(
                '1Hour',
                US_EQUITY_SESSION,
                before
            ).from.getTime();

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

    it('`now` 를 생략하면 현재 시각이 속한 창을 쓴다', () => {
        const before = Date.now();
        const { to } = marketEventsLookback('5Min', US_EQUITY_SESSION);
        const after = Date.now();

        expect(to.getTime()).toBeLessThanOrEqual(after);
        expect(to.getTime()).toBeGreaterThan(before - 5 * MS_PER_MINUTE);
    });

    it('같은 입력이면 같은 창을 낸다 — 스트림과 pre-warm 이 캐시를 공유하는 근거', () => {
        // 두 경로가 다른 창을 쓰면 서로 다른 이벤트 집합을 core 에 넘기고,
        // core 가 그것을 캐시 키에 접으므로 pre-warm 이 채운 캐시를 방문자가
        // 맞히지 못한다.
        expect(marketEventsLookback('1Day', KR_EQUITY_SESSION, NOW)).toEqual(
            marketEventsLookback('1Day', KR_EQUITY_SESSION, NOW)
        );
    });
});
