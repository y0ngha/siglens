import { describe, expect, it } from 'vitest';
import { sessionKeyedTtlSeconds } from '../../lib/sessionKeyedTtl';
import type {
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '../../model';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

const TO = '2026-06-29';
const SECONDS_UNTIL_ROLL = 9 * SECONDS_PER_HOUR;

function view(
    asOf: string | null
): MarketFearGreedView<MarketFearGreedViewSnapshot> {
    return {
        snapshot:
            asOf === null
                ? null
                : {
                      score: 50,
                      label: 'NEUTRAL',
                      factors: [],
                      confidence: 'normal',
                      sampleSize: 200,
                      asOf,
                  },
        comparisons: [],
    };
}

describe('sessionKeyedTtlSeconds', () => {
    it('마지막 세션까지 찬 판독값은 키가 넘어갈 때까지(+여유) 둔다', () => {
        expect(sessionKeyedTtlSeconds(view(TO), TO, SECONDS_UNTIL_ROLL)).toBe(
            SECONDS_UNTIL_ROLL + SECONDS_PER_HOUR
        );
    });

    it('어느 시리즈가 마지막 세션을 아직 발행하지 않았으면 1시간 뒤 다시 받는다', () => {
        expect(
            sessionKeyedTtlSeconds(view('2026-06-26'), TO, SECONDS_UNTIL_ROLL)
        ).toBe(SECONDS_PER_HOUR);
    });

    it('키가 넘어가기 직전에도 미완성 판독값은 1시간이다', () => {
        expect(sessionKeyedTtlSeconds(view('2026-06-26'), TO, 0)).toBe(
            SECONDS_PER_HOUR
        );
    });

    it('snapshot이 없으면 미완성으로 본다', () => {
        expect(sessionKeyedTtlSeconds(view(null), TO, SECONDS_UNTIL_ROLL)).toBe(
            SECONDS_PER_HOUR
        );
    });
});
