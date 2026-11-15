import { describe, expect, it } from 'vitest';
import { TARGET_DISAGREE_THRESHOLD_PCT } from '../../model';
import { targetGapPct, targetsDisagree } from '../targetGap';

describe('targetGapPct', () => {
    it('FMP가 Yahoo보다 높으면 양수, 낮으면 음수', () => {
        expect(targetGapPct(130, 100)).toBeCloseTo(30, 6);
        expect(targetGapPct(90, 100)).toBeCloseTo(-10, 6);
    });

    it('한쪽이 없거나 Yahoo 평균이 0 이하면 null', () => {
        expect(targetGapPct(null, 100)).toBeNull();
        expect(targetGapPct(undefined, 100)).toBeNull();
        expect(targetGapPct(100, null)).toBeNull();
        expect(targetGapPct(100, 0)).toBeNull();
        expect(targetGapPct(100, -5)).toBeNull();
    });
});

describe('targetsDisagree', () => {
    it('임계값을 넘을 때만 true — 정확히 임계값은 아니다', () => {
        expect(targetsDisagree(null)).toBe(false);
        expect(targetsDisagree(TARGET_DISAGREE_THRESHOLD_PCT)).toBe(false);
        expect(targetsDisagree(-TARGET_DISAGREE_THRESHOLD_PCT)).toBe(false);
        expect(targetsDisagree(TARGET_DISAGREE_THRESHOLD_PCT + 0.01)).toBe(
            true
        );
        expect(targetsDisagree(-TARGET_DISAGREE_THRESHOLD_PCT - 0.01)).toBe(
            true
        );
    });
});
