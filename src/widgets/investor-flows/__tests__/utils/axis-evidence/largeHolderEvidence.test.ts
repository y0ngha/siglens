import { describe, expect, it } from 'vitest';
import { largeHolderLines } from '../../../utils/axis-evidence/largeHolderEvidence';
import {
    evaluate,
    makeEmptySnapshot,
    makeKrSnapshot,
    makeSnapshot,
} from '../../fixtures/flowsFixtures';

describe('largeHolderLines', () => {
    it('미국은 13D/13G 포지션·신고 건수와 조회 일수를 한 줄로 낸다', () => {
        expect(largeHolderLines(evaluate(makeSnapshot()), 'en')).toEqual([
            {
                id: 'largeHolderCounts',
                values: { d: '1', df: '1', g: '0', gf: '0', days: '90' },
            },
        ]);
    });

    it('미국 지표가 없으면 빈 배열이다', () => {
        expect(largeHolderLines(evaluate(makeEmptySnapshot()), 'en')).toEqual(
            []
        );
    });

    it('한국 점수표는 DART 대량보유 근거로 갈라진다', () => {
        expect(
            largeHolderLines(evaluate(makeKrSnapshot()), 'en').map(l => l.id)
        ).toEqual(['krMajorHolderReports', 'krMajorHolderDetailed']);
    });
});
