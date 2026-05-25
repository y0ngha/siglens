import { TICKER_RE } from '@/shared/config/ticker';

describe('TICKER_RE', () => {
    it('RegExp 인스턴스이다', () => {
        expect(TICKER_RE).toBeInstanceOf(RegExp);
    });

    describe('유효한 티커를 매칭할 때', () => {
        it.each(['AAPL', 'MSFT', 'A', 'NVDA', 'META', 'GOOGL', 'T'])(
            "'%s'를 매칭한다",
            ticker => {
                expect(TICKER_RE.test(ticker)).toBe(true);
            }
        );

        it("점(.)을 포함하는 'BRK.B'를 매칭한다", () => {
            expect(TICKER_RE.test('BRK.B')).toBe(true);
        });

        it("하이픈(-)을 포함하는 'PBR-A'를 매칭한다", () => {
            expect(TICKER_RE.test('PBR-A')).toBe(true);
        });

        it('8글자 티커를 매칭한다', () => {
            expect(TICKER_RE.test('ABCDEFGH')).toBe(true);
        });
    });

    describe('유효하지 않은 입력을 거부할 때', () => {
        it('빈 문자열을 거부한다', () => {
            expect(TICKER_RE.test('')).toBe(false);
        });

        it('소문자를 거부한다', () => {
            expect(TICKER_RE.test('aapl')).toBe(false);
        });

        it('숫자를 거부한다', () => {
            expect(TICKER_RE.test('A123')).toBe(false);
        });

        it('9글자 이상을 거부한다', () => {
            expect(TICKER_RE.test('ABCDEFGHI')).toBe(false);
        });

        it('점(.)으로 시작하는 문자열을 거부한다', () => {
            expect(TICKER_RE.test('.ABC')).toBe(false);
        });

        it('하이픈(-)으로 시작하는 문자열을 거부한다', () => {
            expect(TICKER_RE.test('-ABC')).toBe(false);
        });

        it('공백을 포함하는 문자열을 거부한다', () => {
            expect(TICKER_RE.test('A BC')).toBe(false);
        });

        it('특수문자를 거부한다', () => {
            expect(TICKER_RE.test('A@BC')).toBe(false);
        });
    });
});
