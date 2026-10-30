import type { Skill } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { dedupeByName } from '../dedupeByName';

describe('dedupeByName', () => {
    const skill = (name: string, description = 'd'): Skill => ({
        name,
        description,
        indicators: [],
        confidenceWeight: 0,
        content: '',
        smcFullGuide: false,
    });

    describe('이름이 중복된 입력', () => {
        it('이름 중복 시 첫 번째만 남기고 이후 중복을 제거한다', () => {
            const out = dedupeByName([
                skill('A', 'first'),
                skill('B'),
                skill('A', 'dup'),
                skill('C'),
            ]);
            expect(out.map(s => s.name)).toEqual(['A', 'B', 'C']);
            expect(out[0].description).toBe('first');
        });
    });

    describe('중복이 없는 입력', () => {
        it('빈 입력은 빈 배열을 반환한다', () => {
            expect(dedupeByName([])).toEqual([]);
        });

        it('이름이 모두 고유하면 순서를 유지한 채 그대로 반환한다', () => {
            const out = dedupeByName([skill('A'), skill('B'), skill('C')]);
            expect(out.map(s => s.name)).toEqual(['A', 'B', 'C']);
        });
    });
});
