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
    it('TICKER_RE matches up-to-8-char uppercase symbols incl. BTCUSD-shaped ones', () => {
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

    describe('해외 거래소 접미사 차단', () => {
        // 2026-07-25 프로덕션 로그에서 FMP 402를 유발한 접미사 전량 + 주요 거래소.
        it.each([
            'HVO.L', // London
            'AOTI.L',
            'SHOP.TO', // Toronto
            'XYZ.V', // TSX Venture
            'ABC.CN', // Canadian Securities Exchange
            'BHP.AX', // ASX
            '7203.T', // Tokyo
            '0700.HK', // HKEX
            'SAP.DE', // Xetra
            'BAC.PR.K', // 미국 우선주 표기 — FMP가 해석 못 하므로 동일하게 차단
        ])("'%s'를 거부한다", symbol => {
            expect(isAdmissibleSymbolShape(symbol)).toBe(false);
        });

        it('소문자로 들어와도 동일하게 거부한다', () => {
            expect(isAdmissibleSymbolShape('hvo.l')).toBe(false);
        });
    });

    describe('허용 접미사 통과', () => {
        it.each(['BRK.A', 'BRK.B', 'BF.B', 'HEI.A', 'LGF.C'])(
            "미국 클래스 구분자 '%s'는 계속 허용한다",
            symbol => {
                expect(isAdmissibleSymbolShape(symbol)).toBe(true);
            }
        );

        it.each(['ACAB.U', 'ACAB.W', 'ACAB.WS'])(
            "SPAC 유닛·워런트 '%s'는 계속 허용한다",
            symbol => {
                expect(isAdmissibleSymbolShape(symbol)).toBe(true);
            }
        );

        it('점이 없는 심볼은 이 규칙의 영향을 받지 않는다', () => {
            expect(isAdmissibleSymbolShape('AAPL')).toBe(true);
            expect(isAdmissibleSymbolShape('PBR-A')).toBe(true);
            expect(isAdmissibleSymbolShape('BTCUSD')).toBe(true);
        });

        it('점으로 시작하거나 끝나는 입력을 거부한다', () => {
            expect(isAdmissibleSymbolShape('.L')).toBe(false);
            expect(isAdmissibleSymbolShape('AAPL.')).toBe(false);
        });

        it('SYMBOL_EDGE_RE 자체는 넓은 superset으로 유지된다', () => {
            // 정규식은 형상만 본다 — 접미사 판정은 isAdmissibleSymbolShape의 책임이다.
            // proxy.ts가 정규식이 아니라 함수를 쓰도록 바뀐 이유이기도 하다.
            expect(SYMBOL_EDGE_RE.test('HVO.L')).toBe(true);
        });
    });
});
