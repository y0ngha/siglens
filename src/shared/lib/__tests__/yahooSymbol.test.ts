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

    // fmpSymbol.test.ts의 '소문자 dual-class도 정규화된다'와 짝을 이룬다 — splitDotSuffix가
    // 내부적으로 대문자화한 base/suffix로 재조립하므로, 별칭 맵 매칭 여부와 무관하게
    // 소문자 입력도 정규화된 대문자-하이픈 표기로 나온다.
    //
    // ⚠️ 대칭은 **정규화되는 분기에 한정**된다. 정규화 대상이 아닌 입력은 두 함수가 갈린다
    // (실측: `toYahooSymbol('aapl')` → `'aapl'`, `toFmpSearchSymbol('aapl')` → `'AAPL'`).
    // Yahoo 쪽은 "별칭·허용 접미사 외에는 손대지 않는다"는 원래 계약을 지키는 것이고,
    // 유일한 호출부(`YahooOptionsAdapter`)가 이미 대문자 심볼을 넘기므로 실사용 차이는 없다.
    it('소문자 dual-class도 정규화된다', () => {
        expect(toYahooSymbol('hei.a')).toBe('HEI-A');
        expect(toYahooSymbol('brk.b')).toBe('BRK-B');
    });

    it('정규화 대상이 아닌 입력은 대소문자를 포함해 그대로 통과시킨다', () => {
        expect(toYahooSymbol('aapl')).toBe('aapl');
        expect(toYahooSymbol('vod.l')).toBe('vod.l');
    });
});
