import type {
    IndicatorGuideResult,
    PatternResult,
    StrategyResult,
} from '@y0ngha/siglens-core';
import { selectPanelSkillResults } from '@/widgets/analysis/utils/panelSkillResults';

const pattern = (skillName: string, detected: boolean): PatternResult =>
    ({
        id: `p-${skillName}`,
        patternName: skillName,
        skillName,
        detected,
        trend: 'bullish',
        summary: '',
        confidenceWeight: 0.5,
    }) as PatternResult;

const strategy = (strategyName: string): StrategyResult => ({
    id: `s-${strategyName}`,
    strategyName,
    trend: 'neutral',
    summary: '',
    confidenceWeight: 0.1,
});

const indicator = (indicatorName: string): IndicatorGuideResult => ({
    indicatorName,
    signals: [],
});

describe('selectPanelSkillResults', () => {
    it('감지된 패턴만 남긴다', () => {
        const result = selectPanelSkillResults({
            patternSummaries: [pattern('A', true), pattern('B', false)],
            strategyResults: [],
            indicatorResults: [],
        });
        expect(result.detectedPatterns.map(p => p.skillName)).toEqual(['A']);
    });

    it('패턴과 이름이 같은 전략·지표는 감지 여부와 무관하게 중복 제거한다', () => {
        const result = selectPanelSkillResults({
            patternSummaries: [pattern('A', true), pattern('B', false)],
            strategyResults: [strategy('A'), strategy('B'), strategy('C')],
            indicatorResults: [indicator('B'), indicator('RSI')],
        });
        expect(result.strategies.map(s => s.strategyName)).toEqual(['C']);
        expect(result.indicatorResults.map(r => r.indicatorName)).toEqual([
            'RSI',
        ]);
    });

    it('confidence가 낮아도 전략을 거르지 않고, 이름 없는 지표는 뺀다', () => {
        const result = selectPanelSkillResults({
            patternSummaries: [],
            strategyResults: [strategy('Low')],
            indicatorResults: [indicator(''), indicator('MACD')],
        });
        expect(result.strategies).toHaveLength(1);
        expect(result.indicatorResults.map(r => r.indicatorName)).toEqual([
            'MACD',
        ]);
    });

    it('누락된 배열 필드는 빈 배열로 다룬다', () => {
        const partial = {} as Parameters<typeof selectPanelSkillResults>[0];
        expect(selectPanelSkillResults(partial)).toEqual({
            detectedPatterns: [],
            strategies: [],
            indicatorResults: [],
        });
    });
});
