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
    it('keeps a reading that reaches the last session until the key rolls, plus the margin', () => {
        expect(sessionKeyedTtlSeconds(view(TO), TO, SECONDS_UNTIL_ROLL)).toBe(
            SECONDS_UNTIL_ROLL + SECONDS_PER_HOUR
        );
    });

    it('retries in an hour when a series has not published the last session yet', () => {
        expect(
            sessionKeyedTtlSeconds(view('2026-06-26'), TO, SECONDS_UNTIL_ROLL)
        ).toBe(SECONDS_PER_HOUR);
    });

    it('retries in an hour even right before the key rolls', () => {
        expect(sessionKeyedTtlSeconds(view('2026-06-26'), TO, 0)).toBe(
            SECONDS_PER_HOUR
        );
    });

    it('treats a missing snapshot as incomplete', () => {
        expect(sessionKeyedTtlSeconds(view(null), TO, SECONDS_UNTIL_ROLL)).toBe(
            SECONDS_PER_HOUR
        );
    });
});
