/** 외부 파일의 심볼 표기 → 우리 심볼. 유니버스 밖이면 null. */
export type SymbolResolver = (externalSymbol: string) => string | null;

/** 클래스 주식 구분자로 쓰이는 표기들 — `.`·`-`·`/`·공백, 그리고 구분자 없이 붙여 쓴 형태. */
const CLASS_SEPARATOR_VARIANTS: readonly string[] = ['.', '-', '/', ' ', ''];
const CLASS_SEPARATOR = /[.\-/ ]/;
const CLASS_SEPARATORS = /[.\-/ ]/g;

/**
 * 유니버스 심볼에서 외부 표기 → 우리 표기 조회를 만든다(FINRA 공매도 파일, Reg SHO 과열 목록, SEC FTD 보조 매칭).
 *
 * 클래스 주식은 출처마다 다르게 쓴다(2026-10 실측): FINRA 일별 거래량(CNMS)은 `BF/A`·`BF/B`, 공매도 잔고·SEC FTD는
 * 구분자 없이 `BFA`·`BRKB`, 거래소 목록은 `BRK.B`·`BRK B`가 섞인다. 우리 표기는 `BF.A`·`BRK-B`다. 그래서 정확 일치를
 * 먼저 등록하고, 구분자를 `.`·`-`·`/`·공백으로 바꾼 것과 지운 것을 별칭으로 **정확 일치가 없을 때만** 추가한다 —
 * 별칭이 다른 유니버스 심볼의 정확 일치를 가로채면 안 된다. 입력은 앞뒤 공백을 지우고 대문자로 비교한다(가운데 공백은
 * `BRK B`의 구분자라 남긴다).
 */
export function buildSymbolAliasResolver(
    universeSymbols: Iterable<string>
): SymbolResolver {
    const symbols = [...universeSymbols].map(symbol => symbol.toUpperCase());
    const lookup = new Map<string, string>(
        symbols.map(symbol => [symbol, symbol])
    );
    for (const symbol of symbols) {
        if (!CLASS_SEPARATOR.test(symbol)) continue;
        for (const separator of CLASS_SEPARATOR_VARIANTS) {
            const alias = symbol.replace(CLASS_SEPARATORS, separator);
            if (!lookup.has(alias)) lookup.set(alias, symbol);
        }
    }
    return externalSymbol =>
        lookup.get(externalSymbol.trim().toUpperCase()) ?? null;
}
