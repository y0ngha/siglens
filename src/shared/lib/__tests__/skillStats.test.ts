import { buildSkillStats, chartSkillTotal } from '@/shared/lib/skillStats';
import type { SkillCounts } from '@y0ngha/siglens-core';

const COUNTS: SkillCounts = {
    indicators: 37,
    candlesticks: 19,
    patterns: 22,
    strategies: 10,
    supportResistance: 1,
    fundamental: 3,
    news: 3,
};

describe('chartSkillTotal', () => {
    it('지표·캔들·패턴·전략·지지/저항만 더한다', () => {
        expect(chartSkillTotal(COUNTS)).toBe(37 + 19 + 22 + 10 + 1);
    });

    it('펀더멘털·뉴스 스킬은 차트 분석 스킬이 아니라서 뺀다', () => {
        expect(
            chartSkillTotal({ ...COUNTS, fundamental: 100, news: 100 })
        ).toBe(chartSkillTotal(COUNTS));
    });

    it('모두 0이면 0이다', () => {
        expect(
            chartSkillTotal({
                indicators: 0,
                candlesticks: 0,
                patterns: 0,
                strategies: 0,
                supportResistance: 0,
                fundamental: 0,
                news: 0,
            })
        ).toBe(0);
    });
});

describe('buildSkillStats', () => {
    it('total은 chartSkillTotal과 같고 타입별 개수는 카운트에서 그대로 온다', () => {
        const result = buildSkillStats(COUNTS);

        expect(result[0]).toEqual({
            key: 'total',
            value: chartSkillTotal(COUNTS),
        });
        expect(result.find(s => s.key === 'indicator_guide')?.value).toBe(37);
        expect(result.find(s => s.key === 'pattern')?.value).toBe(22);
        expect(result.find(s => s.key === 'strategy')?.value).toBe(10);
        expect(result.find(s => s.key === 'candlestick')?.value).toBe(19);
        expect(result.find(s => s.key === 'support_resistance')?.value).toBe(1);
    });

    it('타입별 개수의 합이 total과 같다(홈 StatsBar가 자기모순을 말하지 않는다)', () => {
        const [total, ...rest] = buildSkillStats(COUNTS);

        expect(rest.reduce((sum, s) => sum + s.value, 0)).toBe(total.value);
    });

    it('key는 shared.lib.skillStats.count의 서브키와 일치한다', () => {
        expect(buildSkillStats(COUNTS).map(s => s.key)).toEqual([
            'total',
            'indicator_guide',
            'pattern',
            'strategy',
            'candlestick',
            'support_resistance',
        ]);
    });

    it('카운트가 전부 0이면 모든 value가 0이다', () => {
        const zero: SkillCounts = {
            indicators: 0,
            candlesticks: 0,
            patterns: 0,
            strategies: 0,
            supportResistance: 0,
            fundamental: 0,
            news: 0,
        };

        buildSkillStats(zero).forEach(s => expect(s.value).toBe(0));
    });
});
