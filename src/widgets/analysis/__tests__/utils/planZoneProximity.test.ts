import { describe, expect, it } from 'vitest';
import type { PlanState } from '@y0ngha/siglens-core';
import {
    NEAR_ZONE_ATR,
    isJustAboveZone,
} from '@/widgets/analysis/utils/planZoneProximity';

const state = (
    position: 'above_zone' | 'in_zone',
    distanceAtr: number | null
): PlanState =>
    ({
        position,
        distanceAtr,
        atr: 2,
        stopDistanceAtr: 1.1,
        stopBasis: 'model',
    }) as PlanState;

describe('isJustAboveZone', () => {
    it('is true only below the ATR threshold, exclusive', () => {
        expect(isJustAboveZone(state('above_zone', NEAR_ZONE_ATR - 0.01))).toBe(
            true
        );
        expect(isJustAboveZone(state('above_zone', NEAR_ZONE_ATR))).toBe(false);
    });

    it('is false when the distance is unknown or the close is not above', () => {
        expect(isJustAboveZone(state('above_zone', null))).toBe(false);
        expect(isJustAboveZone(state('in_zone', 0.1))).toBe(false);
    });
});
