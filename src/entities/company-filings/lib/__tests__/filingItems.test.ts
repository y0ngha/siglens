import { describe, expect, it } from 'vitest';
import { filingItems } from '../filingItems';

describe('filingItems', () => {
    it('코드를 영어 라벨로 바꾸고 9.01은 뺀다', () => {
        expect(filingItems('2.01,2.02,3.02,7.01,9.01')).toEqual([
            {
                code: '2.01',
                label: 'Completion of an acquisition or disposition of assets',
            },
            {
                code: '2.02',
                label: 'Results of operations and financial condition',
            },
            { code: '3.02', label: 'Unregistered sales of equity securities' },
            { code: '7.01', label: 'Regulation FD disclosure' },
        ]);
    });

    it('표에 없는 코드는 코드 그대로를 라벨로 둔다', () => {
        expect(filingItems('5.08,8.01')).toEqual([
            { code: '5.08', label: '5.08' },
            { code: '8.01', label: 'Other events' },
        ]);
    });

    it('빈 문자열(6-K)과 공백·빈 조각은 빈 목록이다', () => {
        expect(filingItems('')).toEqual([]);
        expect(filingItems(' , ,')).toEqual([]);
        expect(filingItems('9.01')).toEqual([]);
    });

    it('공백이 섞인 코드를 다듬는다', () => {
        expect(filingItems('5.02, 8.01').map(i => i.code)).toEqual([
            '5.02',
            '8.01',
        ]);
    });
});
