import { splitDotSuffix, SUPPORTED_DOT_SUFFIXES } from '@/shared/config/ticker';

const YAHOO_SYMBOL_ALIASES: Readonly<Record<string, string>> = {
    'BRK.B': 'BRK-B',
};

/**
 * Converts a SigLens ticker to Yahoo's provider-specific notation.
 *
 * Yahoo도 FMP와 마찬가지로 미국 dual-class를 하이픈으로 쓴다(`BRK.B` → `BRK-B`).
 * 검증된 별칭이 먼저이고, 없으면 {@link SUPPORTED_DOT_SUFFIXES}에 속하는 접미사에만
 * dot→hyphen을 적용한다 — {@link toFmpSearchSymbol}과 같은 규칙이다.
 *
 * 별칭 맵만 두면 안 되는 이유: 2026-07-26에 `isAdmissibleSymbolShape`이 넓어지며
 * `HEI.A`/`LEN.B`/`CWEN.A` 같은 dual-class가 실제로 해결되기 시작했는데, 옵션 탭은
 * 앱 표기를 그대로 Yahoo에 넘긴다(`YahooOptionsAdapter`). 별칭에 없으면 Yahoo가
 * `HEI.A`를 못 찾아 옵션 체인이 조용히 빈 값으로 degrade된다.
 *
 * ⚠️ 안전성은 이 함수 내부의 allowlist 검사가 담당한다 — Yahoo 거래소 접미사
 * (`VOD.L`, `7203.T`)는 점이 필요하고, 그 접미사들은 집합 밖이라 그대로 통과한다.
 * 상위 게이트에 의존하지 않으므로 내부 검사를 "중복"으로 보고 제거하지 말 것.
 */
export function toYahooSymbol(symbol: string): string {
    const aliased = YAHOO_SYMBOL_ALIASES[symbol];
    if (aliased !== undefined) return aliased;

    const parts = splitDotSuffix(symbol.toUpperCase());
    if (parts === null) return symbol;
    return SUPPORTED_DOT_SUFFIXES.has(parts.suffix)
        ? `${parts.base}-${parts.suffix}`
        : symbol;
}
