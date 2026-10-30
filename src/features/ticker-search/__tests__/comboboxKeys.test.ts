import {
    isCaretKey,
    isOptionStepKey,
    stepOptionIndex,
} from '@/features/ticker-search/lib/comboboxKeys';

describe('stepOptionIndex', () => {
    it('ArrowDown은 다음 옵션으로 간다', () => {
        expect(stepOptionIndex('ArrowDown', 0, 3)).toBe(1);
    });

    it('ArrowDown은 마지막 옵션에서 멈춘다', () => {
        expect(stepOptionIndex('ArrowDown', 2, 3)).toBe(2);
    });

    it('옵션이 없으면 ArrowDown도 -1이다', () => {
        expect(stepOptionIndex('ArrowDown', -1, 0)).toBe(-1);
    });

    it('ArrowUp은 이전 옵션으로 간다', () => {
        expect(stepOptionIndex('ArrowUp', 2, 3)).toBe(1);
    });

    it('ArrowUp은 첫 옵션에서 -1(입력)로 돌아간다', () => {
        expect(stepOptionIndex('ArrowUp', 0, 3)).toBe(-1);
    });

    it('ArrowUp은 -1 아래로 내려가지 않는다', () => {
        expect(stepOptionIndex('ArrowUp', -1, 3)).toBe(-1);
    });
});

describe('isOptionStepKey', () => {
    it.each(['ArrowDown', 'ArrowUp'])('%s는 옵션 이동 키다', key => {
        expect(isOptionStepKey(key)).toBe(true);
    });

    it.each(['Enter', 'Home', 'toString'])(
        '%s는 옵션 이동 키가 아니다',
        key => {
            expect(isOptionStepKey(key)).toBe(false);
        }
    );
});

describe('isCaretKey', () => {
    it.each(['Home', 'End'])('%s는 캐럿 키다', key => {
        expect(isCaretKey(key)).toBe(true);
    });

    it('ArrowDown은 캐럿 키가 아니다', () => {
        expect(isCaretKey('ArrowDown')).toBe(false);
    });
});
