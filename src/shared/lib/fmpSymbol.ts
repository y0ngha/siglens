import { splitDotSuffix, SUPPORTED_DOT_SUFFIXES } from '@/shared/config/ticker';

const FMP_SYMBOL_ALIASES: Readonly<Record<string, string>> = {
    'BRK.A': 'BRK-A',
    'BRK.B': 'BRK-B',
    'BF.A': 'BF-A',
    'BF.B': 'BF-B',
};

/**
 * Converts a SigLens ticker to FMP's provider-specific notation.
 *
 * US dual-class shares use a hyphen on FMP (`BRK.B` → `BRK-B`), but a raw
 * dot→hyphen replacement would corrupt FMP's international/exchange-suffixed
 * symbols (e.g. `VOD.L`, `7203.T`) and index symbols (`^SPX`). So, like
 * {@link toYahooSymbol}, this maps only verified aliases and passes everything
 * else through unchanged.
 *
 * Extending `FMP_SYMBOL_ALIASES`: add an entry ONLY after confirming the exact
 * FMP notation against the live FMP API (e.g. a profile/quote call returns data
 * for the hyphenated form but not the dotted one). Do not infer aliases by
 * pattern — a blanket dot→hyphen rule is exactly what this map avoids. Each
 * entry should be a SigLens-ticker → verified-FMP-ticker pair.
 */
export function toFmpSymbol(symbol: string): string {
    return FMP_SYMBOL_ALIASES[symbol] ?? symbol;
}

/**
 * `search-symbol` 조회 전용 정규화 — 대문자화 + 미국 클래스 구분자 dot→hyphen.
 *
 * {@link toFmpSymbol}과 분리한 이유: 저쪽은 데이터 엔드포인트 전반에 쓰이며 "검증된
 * 별칭만" 정책을 지킨다. 반면 심볼 **검색**은 자산 정체를 처음 확인하는 단계이므로,
 * 별칭 맵에 없는 dual-class(`HEI.A`, `LEN.B`, `MOG.A`, `CRD.B`, `LGF.B`, `CWEN.A`,
 * `GEF.B`, `JW.A` …)까지 해결되어야 한다. 해결되지 않으면 `asset_translations`에
 * 점 포함 심볼이 0건이라 폴백도 없어 **하드 404**가 된다.
 *
 * 라이브 FMP 실측(2026-07-26): 위 8종 전부 하이픈 표기로 `NYSE` 매칭, 점 표기는 `[]`.
 *
 * ⚠️ 안전성은 **이 함수 내부의 `SUPPORTED_DOT_SUFFIXES` 검사**가 담당한다 — 상위 게이트가
 * 아니다. `[symbol]` 라우트는 `isAdmissibleSymbolShape`가 `VOD.L`을 먼저 404로 끊지만,
 * 검색 UI 경로(`searchTicker.ts`)는 사용자 입력을 **아무 게이트 없이** `searchBySymbol`로
 * 넘긴다. 즉 `VOD.L`이 이 함수에 그대로 도달한다. 내부 검사가 없으면 그 질의가 `VOD-L`로
 * 변조돼 검색이 조용히 깨진다 — **내부 allowlist 검사를 "중복"으로 보고 제거하지 말 것.**
 *
 * 회사명 질의(`search-name`)에는 적용하지 않는다 — 이름에 든 점을 하이픈으로 바꾸면
 * 검색이 망가진다.
 */
export function toFmpSearchSymbol(symbol: string): string {
    const upper = symbol.toUpperCase();
    // 별칭 맵이 먼저다. 지금 등록된 4건은 전부 A/B 접미사라 아래 일반 규칙과 **결과가
    // 동일**하지만(즉 이 분기를 지워도 현재 동작은 안 바뀐다), 우선순위를 남겨두는 이유는
    // 앞으로 추가될 별칭이 기계적 dot→hyphen이 아닐 수 있기 때문이다(과거 `RDS.A`→`RDSA`
    // 처럼 점이 사라지는 표기도 있었다). 검증된 매핑이 규칙보다 항상 우선해야 한다.
    const aliased = FMP_SYMBOL_ALIASES[upper];
    if (aliased !== undefined) return aliased;

    const parts = splitDotSuffix(upper);
    if (parts === null) return upper;
    return SUPPORTED_DOT_SUFFIXES.has(parts.suffix)
        ? `${parts.base}-${parts.suffix}`
        : upper;
}
