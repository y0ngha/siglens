import { describe, expect, it } from 'vitest';
import { firstSentence } from '../firstSentence';

describe('firstSentence', () => {
    it('약어(Inc., U.S.)와 한 글자 이니셜의 마침표에서는 끊지 않는다', () => {
        expect(
            firstSentence(
                'NVIDIA Corp. and Arm Inc. signed a U.S. deal with J. Smith. Then more.'
            )
        ).toBe('NVIDIA Corp. and Arm Inc. signed a U.S. deal with J. Smith.');
    });

    it('닫는 따옴표·괄호까지 문장에 넣고, 끝나는 곳이 없으면 문단 전체', () => {
        expect(firstSentence('He said “done.” Next one.')).toBe(
            'He said “done.”'
        );
        expect(firstSentence('No sentence end here')).toBe(
            'No sentence end here'
        );
    });
});
