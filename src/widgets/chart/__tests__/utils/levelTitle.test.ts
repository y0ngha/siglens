import type { ChartOverlay } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { levelTitleFor, type LevelTitleContext } from '../../utils/levelTitle';

const pattern: ChartOverlay = {
    id: 'pattern:double_top:1',
    kind: 'pattern',
    skill: 'double_top',
    sourceRef: 'double_top_0',
    variant: 'primary',
    segments: [],
    levels: [],
    labels: [],
};
const fib: ChartOverlay = {
    ...pattern,
    id: 'fib:1',
    kind: 'fibonacci',
    sourceRef: 'fib_0',
    segments: [
        {
            from: { time: 1, price: 120 },
            to: { time: 3, price: 185 },
            role: 'pattern',
            style: 'solid',
            pane: 'price',
        },
    ],
};

const ctx: LevelTitleContext = {
    cardName: '이중천장',
    highlightedKey: null,
    crowded: false,
    breakoutTitle: name => (name ? `${name} 돌파` : '돌파 기준'),
    outcomeTexts: {
        invalidation: owner => (owner ? `${owner} 무효화` : '무효화'),
        target: owner => (owner ? `${owner} 목표` : '목표'),
        wave5Cap: owner => (owner ? `${owner} 5파 상한` : '5파 상한'),
        elliottStructure: {
            impulse: '임펄스',
            triangle: '삼각형',
            diagonal: '다이아고날',
            abc: 'A-B-C',
            combination: '복합 조정',
        },
    },
    fibTexts: {
        retracement: {
            down: p => `반등 ${p}`,
            up: p => `눌림 ${p}`,
        },
        extension: {
            down: p => `하락 목표 ${p}`,
            up: p => `상승 목표 ${p}`,
        },
        abcExtension: {
            down: p => `ABC 하락 목표 ${p}`,
            up: p => `ABC 상승 목표 ${p}`,
        },
    },
};

describe('levelTitleFor', () => {
    it('돌파선은 카드 이름을 붙인다', () => {
        expect(levelTitleFor('breakout', pattern, ctx)).toBe('이중천장 돌파');
    });

    it('돌파선인데 카드 이름을 모르면 종류만', () => {
        expect(
            levelTitleFor('breakout', pattern, { ...ctx, cardName: undefined })
        ).toBe('돌파 기준');
    });

    it('혼잡하지 않으면 결과선 문구를 보인다', () => {
        expect(levelTitleFor('invalidation', pattern, ctx)).toBe(
            '이중천장 무효화'
        );
    });

    it('혼잡하고 강조되지 않았으면 숨긴다(빈 문자열)', () => {
        expect(
            levelTitleFor('invalidation', pattern, {
                ...ctx,
                crowded: true,
                highlightedKey: 'other_0',
            })
        ).toBe('');
    });

    it('혼잡해도 강조된 항목이면 보인다', () => {
        expect(
            levelTitleFor('target', pattern, {
                ...ctx,
                crowded: true,
                highlightedKey: 'double_top_0',
            })
        ).toBe('이중천장 목표');
    });

    it('피보나치 라벨은 다리 방향에 맞는 문구', () => {
        expect(levelTitleFor('61.8%', fib, ctx)).toBe('눌림 61.8%');
    });

    it('혼잡 여부는 피보나치 제목에 영향이 없다', () => {
        expect(levelTitleFor('61.8%', fib, { ...ctx, crowded: true })).toBe(
            '눌림 61.8%'
        );
    });

    it('모르는 라벨은 그대로 돌려준다', () => {
        expect(levelTitleFor('neckline', pattern, ctx)).toBe('neckline');
    });
});
