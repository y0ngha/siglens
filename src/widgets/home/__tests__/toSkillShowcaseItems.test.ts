import { describe, it, expect } from 'vitest';
import type { Skill } from '@y0ngha/siglens-core';
import { toSkillShowcaseItems } from '@/widgets/home/toSkillShowcaseItems';

/** 실제 `FileSkillsLoader` 출력과 같은 모양 — 특히 `content`가 있어야 의미가 있다. */
function skill(overrides: Partial<Skill> = {}): Skill {
    return {
        name: 'RSI Divergence',
        description: '가격과 RSI의 방향이 갈리는 구간을 찾는다.',
        type: 'indicator',
        confidenceWeight: 0.8,
        content: '## Overview\n'.repeat(500),
        category: 'indicators',
        ...overrides,
    } as Skill;
}

describe('toSkillShowcaseItems', () => {
    it('선언된 4개 필드만 남긴다 — content는 반드시 빠진다', () => {
        const [item] = toSkillShowcaseItems([skill()]);

        expect(Object.keys(item!).toSorted()).toEqual([
            'confidenceWeight',
            'description',
            'name',
            'type',
        ]);
        // 이 단언이 이 파일의 존재 이유다. 586KB짜리 LLM 프롬프트 본문이
        // 클라이언트 번들 경계를 넘던 회귀를 직접 고정한다.
        expect(item).not.toHaveProperty('content');
        expect(item).not.toHaveProperty('category');
    });

    it('네 필드의 값은 그대로 옮긴다', () => {
        const src = skill({ name: 'MACD', confidenceWeight: 0.55 });
        const [item] = toSkillShowcaseItems([src]);

        expect(item).toEqual({
            name: 'MACD',
            description: src.description,
            type: src.type,
            confidenceWeight: 0.55,
        });
    });

    it('빈 배열은 빈 배열', () => {
        expect(toSkillShowcaseItems([])).toEqual([]);
    });
});
