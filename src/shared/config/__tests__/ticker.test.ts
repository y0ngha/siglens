import { describe, it, expect } from 'vitest';
import {
    TICKER_RE,
    SYMBOL_EDGE_RE,
    isAdmissibleSymbolShape,
} from '@/shared/config/ticker';

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

describe('symbol shape checks', () => {
    it('TICKER_RE still matches US equities only', () => {
        expect(TICKER_RE.test('AAPL')).toBe(true);
        expect(TICKER_RE.test('BRK.B')).toBe(true);
        expect(TICKER_RE.test('BTCUSD')).toBe(true); // 6 letters ≤ 8, passes
    });

    it('SYMBOL_EDGE_RE is the matcher backing isAdmissibleSymbolShape', () => {
        expect(SYMBOL_EDGE_RE).toBeInstanceOf(RegExp);
        expect(SYMBOL_EDGE_RE.test('BTCUSD')).toBe(true);
        expect(SYMBOL_EDGE_RE.test('a b')).toBe(false);
    });

    it('SYMBOL_EDGE_RE admits crypto shapes US regex would reject', () => {
        expect(isAdmissibleSymbolShape('BTCUSD')).toBe(true);
        expect(isAdmissibleSymbolShape('1000SATSUSD')).toBe(true); // digit-first
        expect(isAdmissibleSymbolShape('1-UPUSD')).toBe(true); // hyphen + digit-first
        expect(isAdmissibleSymbolShape('AAPL')).toBe(true);
    });

    it('SYMBOL_EDGE_RE rejects junk and over-long input', () => {
        expect(isAdmissibleSymbolShape('')).toBe(false);
        expect(isAdmissibleSymbolShape('a b')).toBe(false);
        expect(isAdmissibleSymbolShape('!@#')).toBe(false);
        expect(isAdmissibleSymbolShape('TOOOOOOOOOOOOOOOOONG')).toBe(false); // > 16
    });
});
