import { describe, expect, it } from 'vitest';
import { dropSupersededPaths } from '../lib/supersededPaths';

const entry = (path: string) => ({ path, text: 'x' });

describe('dropSupersededPaths', () => {
    /**
     * 회귀: 두 벌을 다 넘기면 모델이 서로 다른 두 분석으로 착각해
     * "다른 분석에서는 목표가를 334.01달러…"처럼 모순된 매매 가격을 낸다(실측).
     */
    it('reconciledLevels가 있으면 대체된 형제 경로를 제거한다', () => {
        const got = dropSupersededPaths([
            entry('summary'),
            entry('actionRecommendation.entry'),
            entry('actionRecommendation.exit'),
            entry('actionRecommendation.riskReward'),
            entry('actionRecommendation.reconciledLevels.exit'),
            entry('actionRecommendation.reconciledLevels.riskReward'),
            entry('actionRecommendation.reconciledLevels.reason'),
        ]).map(e => e.path);

        expect(got).toEqual([
            'summary',
            'actionRecommendation.entry',
            'actionRecommendation.reconciledLevels.exit',
            'actionRecommendation.reconciledLevels.riskReward',
        ]);
    });

    it('reconciledLevels가 없으면 아무것도 제거하지 않는다', () => {
        const input = [
            entry('summary'),
            entry('actionRecommendation.entry'),
            entry('actionRecommendation.exit'),
            entry('actionRecommendation.riskReward'),
        ];
        expect(dropSupersededPaths(input).map(e => e.path)).toEqual(
            input.map(e => e.path)
        );
    });

    it('원본 배열을 변형하지 않는다', () => {
        const input = [entry('summary')];
        dropSupersededPaths(input);
        expect(input).toHaveLength(1);
    });
});
