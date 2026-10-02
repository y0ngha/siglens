import { describe, expect, it } from 'vitest';
import {
    elliottStructureOf,
    formatOutcomeLevelLabel,
    type OutcomeLevelTexts,
} from '../../utils/outcomeLevelLabel';

const texts: OutcomeLevelTexts = {
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
};
const pattern = { kind: 'pattern' as const, id: 'pattern:double_top:1' };
const ew = (id: string) => ({ kind: 'elliott' as const, id });

describe('elliottStructureOf', () => {
    it.each([
        ['ew:up:1:6', 'impulse'],
        ['ew:up:1:5', 'impulse'],
        ['ew:up:1:6:abc', 'impulse'],
        ['ew:down:1:tri', 'triangle'],
        ['ew:up:1:diag', 'diagonal'],
        ['ew:down:1:abc', 'abc'],
        ['ew:up:1:combo3', 'combination'],
    ])('%s → %s', (id, structure) => {
        expect(elliottStructureOf(ew(id))).toBe(structure);
    });

    it('엘리어트가 아니거나 모르는 꼴이면 null', () => {
        expect(elliottStructureOf(pattern)).toBeNull();
        expect(elliottStructureOf(ew('ew:up:1:zz'))).toBeNull();
    });
});

describe('formatOutcomeLevelLabel', () => {
    it('패턴 선엔 카드 이름을 붙인다', () => {
        expect(
            formatOutcomeLevelLabel('invalidation', pattern, '이중천장', texts)
        ).toBe('이중천장 무효화');
        expect(
            formatOutcomeLevelLabel('target', pattern, '이중천장', texts)
        ).toBe('이중천장 목표');
    });

    it('카드 이름을 모르면 종류만', () => {
        expect(
            formatOutcomeLevelLabel('invalidation', pattern, undefined, texts)
        ).toBe('무효화');
    });

    it('엘리어트 선엔 카드가 아니라 구조 이름을, 비율 목표엔 A-B-C와 비율을 붙인다', () => {
        expect(
            formatOutcomeLevelLabel(
                'target',
                ew('ew:down:1:tri'),
                '엘리어트 파동',
                texts
            )
        ).toBe('삼각형 목표');
        expect(
            formatOutcomeLevelLabel(
                'target 161.8%',
                ew('ew:up:1:6:abc'),
                '엘리어트 파동',
                texts
            )
        ).toBe('A-B-C 목표 161.8%');
        expect(
            formatOutcomeLevelLabel(
                'wave5_cap',
                ew('ew:up:1:diag'),
                undefined,
                texts
            )
        ).toBe('다이아고날 5파 상한');
    });

    it.each(['breakout', '61.8%', 'ext 127.2%', 'ABC 161.8%', 'targets'])(
        '결과선 라벨이 아니면 null: %j',
        label => {
            expect(
                formatOutcomeLevelLabel(label, pattern, '이중천장', texts)
            ).toBeNull();
        }
    );
});
