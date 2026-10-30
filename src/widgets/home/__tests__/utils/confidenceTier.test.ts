import { HIGH_CONFIDENCE_WEIGHT as CORE_HIGH_CONFIDENCE_WEIGHT } from '@y0ngha/siglens-core';

import {
    CONFIDENCE_BAR_CLASS,
    CONFIDENCE_THRESHOLD_PERCENTS,
    HIGH_CONFIDENCE_WEIGHT,
    MEDIUM_CONFIDENCE_WEIGHT,
    getConfidenceTier,
} from '../../utils/confidenceTier';

describe('confidenceTier', () => {
    it('로컬 미러가 core의 HIGH_CONFIDENCE_WEIGHT와 같다', () => {
        expect(HIGH_CONFIDENCE_WEIGHT).toBe(CORE_HIGH_CONFIDENCE_WEIGHT);
    });

    it.each([
        [0, 'low'],
        [0.49, 'low'],
        [MEDIUM_CONFIDENCE_WEIGHT, 'medium'],
        [0.79, 'medium'],
        [HIGH_CONFIDENCE_WEIGHT, 'high'],
        [1, 'high'],
    ] as const)('weight %f → %s (경계값은 상위 등급)', (weight, tier) => {
        expect(getConfidenceTier(weight)).toBe(tier);
    });

    it('모든 등급에 막대 클래스가 있다', () => {
        expect(CONFIDENCE_BAR_CLASS).toEqual({
            high: 'bg-chart-bullish',
            medium: 'bg-ui-warning',
            low: 'bg-secondary-500',
        });
    });

    it('툴팁 인자는 색 로직과 같은 상수에서 퍼센트로 파생된다', () => {
        expect(CONFIDENCE_THRESHOLD_PERCENTS).toEqual({
            low: MEDIUM_CONFIDENCE_WEIGHT * 100,
            high: HIGH_CONFIDENCE_WEIGHT * 100,
        });
        expect(Number.isInteger(CONFIDENCE_THRESHOLD_PERCENTS.high)).toBe(true);
    });
});
