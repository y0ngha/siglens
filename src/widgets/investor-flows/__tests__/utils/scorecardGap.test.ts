import { describe, expect, it } from 'vitest';
import { resolveAxisGap } from '../../utils/scorecardGap';
import {
    evaluate,
    makeEmptySnapshot,
    makeSnapshot,
} from '../fixtures/flowsFixtures';

describe('resolveAxisGap', () => {
    const empty = evaluate(makeEmptySnapshot());

    it('점수가 있는 축은 목록에 있어도 사유가 없다', () => {
        const scored = evaluate(makeSnapshot());
        expect(
            resolveAxisGap(
                scored,
                'institutional',
                new Set(['institutional']),
                new Set(['institutional'])
            )
        ).toBeNull();
    });

    it('수집 중이 일시 조회 불가보다 먼저다', () => {
        expect(
            resolveAxisGap(
                empty,
                'institutional',
                new Set(['institutional']),
                new Set(['institutional'])
            )
        ).toBe('collecting');
    });

    it('수집 중이 아니고 일시 조회 불가 축이면 unavailable이다', () => {
        expect(
            resolveAxisGap(empty, 'short', new Set(), new Set(['short']))
        ).toBe('unavailable');
    });

    it('둘 다 아니면 null이다(그냥 데이터 부족)', () => {
        expect(resolveAxisGap(empty, 'short', new Set(), new Set())).toBeNull();
    });
});
