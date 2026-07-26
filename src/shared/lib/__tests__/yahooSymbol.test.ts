import { toYahooSymbol } from '@/shared/lib/yahooSymbol';

describe('toYahooSymbol', () => {
    it('maps verified US class-share aliases to Yahoo notation', () => {
        expect(toYahooSymbol('BRK.B')).toBe('BRK-B');
    });

    it('preserves exchange suffix dots and ordinary symbols', () => {
        expect(toYahooSymbol('VOD.L')).toBe('VOD.L');
        expect(toYahooSymbol('7203.T')).toBe('7203.T');
        expect(toYahooSymbol('AAPL')).toBe('AAPL');
    });
});

describe('toYahooSymbol — 허용 접미사 dot→hyphen', () => {
    // 2026-07-26: isAdmissibleSymbolShape이 넓어지며 별칭 맵에 없던 dual-class가 실제로
    // 해결되기 시작했다. 옵션 탭은 앱 표기를 그대로 Yahoo에 넘기므로(YahooOptionsAdapter)
    // 여기서 정규화되지 않으면 옵션 체인이 조용히 빈 값으로 degrade된다.
    it.each([
        ['HEI.A', 'HEI-A'],
        ['LEN.B', 'LEN-B'],
        ['CWEN.A', 'CWEN-A'],
        ['MOG.A', 'MOG-A'],
        ['BF.B', 'BF-B'],
    ])('별칭에 없는 dual-class %s → %s', (input, expected) => {
        expect(toYahooSymbol(input)).toBe(expected);
    });

    it('거래소 접미사는 점을 유지한다 (Yahoo가 점을 요구)', () => {
        expect(toYahooSymbol('VOD.L')).toBe('VOD.L');
        expect(toYahooSymbol('SHOP.TO')).toBe('SHOP.TO');
        expect(toYahooSymbol('7203.T')).toBe('7203.T');
    });

    it('점이 없으면 입력을 그대로 반환한다', () => {
        expect(toYahooSymbol('AAPL')).toBe('AAPL');
        expect(toYahooSymbol('PBR-A')).toBe('PBR-A');
    });
});
