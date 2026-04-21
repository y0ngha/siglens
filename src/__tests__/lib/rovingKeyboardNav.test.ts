import { getRovingNextIndex } from '@/lib/rovingKeyboardNav';

describe('getRovingNextIndex', () => {
    describe('ArrowRight', () => {
        it('다음 인덱스를 반환한다', () => {
            expect(getRovingNextIndex('ArrowRight', 0, 3)).toBe(1);
        });

        it('마지막 항목에서 첫 항목으로 순환한다', () => {
            expect(getRovingNextIndex('ArrowRight', 2, 3)).toBe(0);
        });
    });

    describe('ArrowLeft', () => {
        it('이전 인덱스를 반환한다', () => {
            expect(getRovingNextIndex('ArrowLeft', 2, 3)).toBe(1);
        });

        it('첫 항목에서 마지막 항목으로 순환한다', () => {
            expect(getRovingNextIndex('ArrowLeft', 0, 3)).toBe(2);
        });
    });

    describe('Home', () => {
        it('withHomeEnd 기본값(true)일 때 0을 반환한다', () => {
            expect(getRovingNextIndex('Home', 2, 3)).toBe(0);
        });

        it('withHomeEnd=false일 때 null을 반환한다', () => {
            expect(
                getRovingNextIndex('Home', 2, 3, { withHomeEnd: false })
            ).toBeNull();
        });
    });

    describe('End', () => {
        it('withHomeEnd 기본값(true)일 때 마지막 인덱스를 반환한다', () => {
            expect(getRovingNextIndex('End', 0, 3)).toBe(2);
        });

        it('withHomeEnd=false일 때 null을 반환한다', () => {
            expect(
                getRovingNextIndex('End', 0, 3, { withHomeEnd: false })
            ).toBeNull();
        });
    });

    describe('처리 대상이 아닌 키', () => {
        it('null을 반환한다', () => {
            expect(getRovingNextIndex('Enter', 0, 3)).toBeNull();
            expect(getRovingNextIndex('Tab', 1, 3)).toBeNull();
            expect(getRovingNextIndex('Escape', 0, 3)).toBeNull();
        });
    });
});
