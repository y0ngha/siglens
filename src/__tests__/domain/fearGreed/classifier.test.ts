import {
    classifyScore,
    FEAR_GREED_SCORE_BOUNDARIES,
} from '@/domain/fearGreed/classifier';

describe('classifyScore', () => {
    it.each<[number, ReturnType<typeof classifyScore>]>([
        [0, 'EXTREME_FEAR'],
        [10, 'EXTREME_FEAR'],
        [FEAR_GREED_SCORE_BOUNDARIES.EXTREME_FEAR_MAX - 1, 'EXTREME_FEAR'],
        [FEAR_GREED_SCORE_BOUNDARIES.EXTREME_FEAR_MAX, 'FEAR'],
        [35, 'FEAR'],
        [FEAR_GREED_SCORE_BOUNDARIES.FEAR_MAX - 1, 'FEAR'],
        [FEAR_GREED_SCORE_BOUNDARIES.FEAR_MAX, 'NEUTRAL'],
        [50, 'NEUTRAL'],
        [FEAR_GREED_SCORE_BOUNDARIES.NEUTRAL_MAX - 1, 'NEUTRAL'],
        [FEAR_GREED_SCORE_BOUNDARIES.NEUTRAL_MAX, 'GREED'],
        [65, 'GREED'],
        [FEAR_GREED_SCORE_BOUNDARIES.GREED_MAX - 1, 'GREED'],
        [FEAR_GREED_SCORE_BOUNDARIES.GREED_MAX, 'EXTREME_GREED'],
        [85, 'EXTREME_GREED'],
        [100, 'EXTREME_GREED'],
    ])('classifyScore(%i)는 %s를 반환한다', (score, label) => {
        expect(classifyScore(score)).toBe(label);
    });
});

describe('FEAR_GREED_SCORE_BOUNDARIES', () => {
    it('5단계 분류를 위한 4개 경계값이 오름차순으로 정의되어 있다', () => {
        expect(FEAR_GREED_SCORE_BOUNDARIES.EXTREME_FEAR_MAX).toBeLessThan(
            FEAR_GREED_SCORE_BOUNDARIES.FEAR_MAX
        );
        expect(FEAR_GREED_SCORE_BOUNDARIES.FEAR_MAX).toBeLessThan(
            FEAR_GREED_SCORE_BOUNDARIES.NEUTRAL_MAX
        );
        expect(FEAR_GREED_SCORE_BOUNDARIES.NEUTRAL_MAX).toBeLessThan(
            FEAR_GREED_SCORE_BOUNDARIES.GREED_MAX
        );
    });
});
