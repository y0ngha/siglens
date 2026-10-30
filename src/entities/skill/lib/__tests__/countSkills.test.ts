import type { Skill } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { countSkills } from '../countSkills';

const skill = (overrides: Partial<Skill>): Skill => ({
    name: 'n',
    description: 'd',
    indicators: [],
    confidenceWeight: 0,
    content: '',
    smcFullGuide: false,
    ...overrides,
});

describe('countSkills', () => {
    describe('빈 목록', () => {
        it('모두 0', () => {
            expect(countSkills([])).toEqual({
                indicators: 0,
                candlesticks: 0,
                patterns: 0,
                strategies: 0,
                supportResistance: 0,
                fundamental: 0,
                news: 0,
            });
        });
    });

    describe('집계 기준', () => {
        it('type 기준으로 센다', () => {
            expect(
                countSkills([
                    skill({ type: 'indicator_guide' }),
                    skill({ type: 'indicator_guide' }),
                    skill({ type: 'candlestick' }),
                    skill({ type: 'pattern' }),
                    skill({ type: 'strategy' }),
                    skill({ type: 'support_resistance' }),
                ])
            ).toMatchObject({
                indicators: 2,
                candlesticks: 1,
                patterns: 1,
                strategies: 1,
                supportResistance: 1,
            });
        });

        it('category 기준으로 fundamental·news를 센다', () => {
            expect(
                countSkills([
                    skill({ category: 'fundamental' }),
                    skill({ category: 'news' }),
                    skill({ category: 'news' }),
                    skill({ category: 'neutral' }),
                ])
            ).toMatchObject({ fundamental: 1, news: 2 });
        });
    });
});
