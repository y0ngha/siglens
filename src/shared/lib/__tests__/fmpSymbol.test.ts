import { toFmpSearchSymbol, toFmpSymbol } from '@/shared/lib/fmpSymbol';
import {
    isAdmissibleSymbolShape,
    SUPPORTED_DOT_SUFFIXES,
} from '@/shared/config/ticker';

describe('toFmpSymbol', () => {
    it('maps verified US dual-class aliases to FMP notation', () => {
        expect(toFmpSymbol('BRK.B')).toBe('BRK-B');
        expect(toFmpSymbol('BRK.A')).toBe('BRK-A');
        expect(toFmpSymbol('BF.B')).toBe('BF-B');
        expect(toFmpSymbol('BF.A')).toBe('BF-A');
    });

    it('preserves exchange-suffix dots, index, and ordinary symbols', () => {
        expect(toFmpSymbol('VOD.L')).toBe('VOD.L');
        expect(toFmpSymbol('7203.T')).toBe('7203.T');
        expect(toFmpSymbol('^SPX')).toBe('^SPX');
        expect(toFmpSymbol('AAPL')).toBe('AAPL');
    });
});

describe('toFmpSearchSymbol', () => {
    it('별칭 맵에 있는 dual-class는 검증된 표기를 그대로 쓴다', () => {
        expect(toFmpSearchSymbol('BRK.B')).toBe('BRK-B');
        expect(toFmpSearchSymbol('BF.A')).toBe('BF-A');
    });

    // 라이브 FMP 실측(2026-07-26): 아래 전부 하이픈 표기로 NYSE 매칭, 점 표기는 [].
    // 별칭 맵에는 없으므로 접미사 규칙으로 해결되어야 한다.
    it.each([
        ['HEI.A', 'HEI-A'],
        ['LEN.B', 'LEN-B'],
        ['MOG.A', 'MOG-A'],
        ['CRD.B', 'CRD-B'],
        ['LGF.B', 'LGF-B'],
        ['CWEN.A', 'CWEN-A'],
        ['GEF.B', 'GEF-B'],
        ['JW.A', 'JW-A'],
    ])('별칭에 없는 dual-class %s → %s', (input, expected) => {
        expect(toFmpSearchSymbol(input)).toBe(expected);
    });

    it('점이 없는 심볼은 대문자화만 한다', () => {
        expect(toFmpSearchSymbol('aapl')).toBe('AAPL');
        expect(toFmpSearchSymbol('BTCUSD')).toBe('BTCUSD');
        expect(toFmpSearchSymbol('PBR-A')).toBe('PBR-A');
    });

    it('소문자 dual-class도 정규화된다', () => {
        expect(toFmpSearchSymbol('brk.b')).toBe('BRK-B');
        expect(toFmpSearchSymbol('hei.a')).toBe('HEI-A');
    });

    // 이 심볼들은 isAdmissibleSymbolShape 단계에서 이미 404로 끊기므로 여기 도달하지
    // 않는다. 그래도 방어적으로 접미사가 허용 집합 밖이면 손대지 않는다 — 두 규칙이
    // 어긋나도 조용히 심볼을 망가뜨리지 않게.
    it('허용 접미사가 아니면 점을 그대로 둔다', () => {
        expect(toFmpSearchSymbol('VOD.L')).toBe('VOD.L');
        expect(toFmpSearchSymbol('7203.T')).toBe('7203.T');
        expect(toFmpSearchSymbol('SHOP.TO')).toBe('SHOP.TO');
    });

    it('점으로 시작하는 입력은 손대지 않는다', () => {
        expect(toFmpSearchSymbol('.B')).toBe('.B');
    });
});

/**
 * 짝 관계 회귀 가드 — 허용 집합과 정규화가 어긋나면 즉시 실패한다.
 *
 * `isAdmissibleSymbolShape`이 통과시킨 접미사는 반드시 `toFmpSearchSymbol`이 하이픈으로
 * 정규화해야 한다. 한쪽만 바꾸면 "통과했는데 FMP에서 영영 못 찾는" 하드 404가 조용히
 * 생긴다 — 이 테스트가 없으면 접미사를 추가해도 아무것도 실패하지 않는다.
 */
describe('SUPPORTED_DOT_SUFFIXES ↔ toFmpSearchSymbol 짝 관계', () => {
    it.each([...SUPPORTED_DOT_SUFFIXES])(
        "'.%s' 접미사는 허용되고 하이픈으로 정규화된다",
        suffix => {
            const symbol = `XYZ.${suffix}`;
            expect(isAdmissibleSymbolShape(symbol)).toBe(true);
            expect(toFmpSearchSymbol(symbol)).toBe(`XYZ-${suffix}`);
        }
    );

    it('허용 집합 밖 접미사는 거부되고 정규화도 되지 않는다', () => {
        for (const suffix of ['L', 'TO', 'V', 'CN', 'AX', 'T', 'HK']) {
            const symbol = `XYZ.${suffix}`;
            expect(isAdmissibleSymbolShape(symbol)).toBe(false);
            expect(toFmpSearchSymbol(symbol)).toBe(symbol);
        }
    });
});
