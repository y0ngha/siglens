import { toFmpSearchSymbol, toFmpSymbol } from '../../src/shared/lib/fmpSymbol';

/**
 * `asset_translations`의 `symbol ↔ fmp_symbol` 매핑을 분류한다 — 정리 스크립트
 * (`scripts/cleanup-asset-translation-mismatches.ts`)의 순수 판정부.
 *
 * 왜 필요한가: `findExactUsMatch`가 예전에는 정확 일치가 없을 때 첫 US 검색 행으로
 * 폴백했고, 그 매핑이 영구 저장됐다(2026-10 실측: `VIX→VIXM`, `APPL→APPLX`,
 * `AST→ASTI` 등 `symbol <> fmp_symbol` 약 184행). 폴백은 고쳤지만 저장된 행은 읽기
 * 경로가 DB를 먼저 보므로 스스로 고쳐지지 않는다. 잘못된 행을 지우면 다음 방문 때
 * 새 규칙(정확 일치만)으로 다시 해석된다.
 *
 * 정당한 차이로 남기는 것:
 *   - `class-share`: 클래스 주식 정규화(`BRK.B→BRK-B`, `BF.B→BF-B`) — 검색 경로와 같은
 *     `toFmpSearchSymbol`, 데이터 경로의 `toFmpSymbol` 중 하나와 같으면 정당하다.
 *   - `index`: `^`로 시작하는 공급자 심볼(`SPX→^SPX`). 지수 행은 `filterUsExchanges`가
 *     거르므로 옛 폴백이 만들 수 없는 모양이다 — 사람이 넣었거나 별칭 경로가 만든 행이다.
 * 나머지 차이는 전부 `mismatch`(삭제 대상)다.
 */
export type FmpSymbolMappingKind =
    | 'same'
    | 'class-share'
    | 'index'
    | 'mismatch';

export function classifyFmpSymbolMapping(
    symbol: string,
    fmpSymbol: string
): FmpSymbolMappingKind {
    if (fmpSymbol === symbol) return 'same';
    if (fmpSymbol.startsWith('^')) return 'index';
    if (
        fmpSymbol === toFmpSearchSymbol(symbol) ||
        fmpSymbol === toFmpSymbol(symbol)
    ) {
        return 'class-share';
    }
    return 'mismatch';
}

export interface AssetTranslationMappingRow {
    symbol: string;
    fmpSymbol: string;
}

export interface AssetTranslationCleanupPlan {
    /** 입력 행 수(보통 `symbol <> fmp_symbol` 행만 넘긴다). */
    scanned: number;
    classShare: number;
    index: number;
    /** 삭제할 canonical 심볼(정렬). */
    mismatched: string[];
}

export function planAssetTranslationCleanup(
    rows: readonly AssetTranslationMappingRow[]
): AssetTranslationCleanupPlan {
    let classShare = 0;
    let index = 0;
    const mismatched: string[] = [];
    for (const row of rows) {
        const kind = classifyFmpSymbolMapping(row.symbol, row.fmpSymbol);
        if (kind === 'class-share') classShare += 1;
        else if (kind === 'index') index += 1;
        else if (kind === 'mismatch') mismatched.push(row.symbol);
    }
    return {
        scanned: rows.length,
        classShare,
        index,
        mismatched: mismatched.sort(),
    };
}

export interface NamedSymbolRow {
    symbol: string;
    name: string;
}

export interface OrphanedKoreanTickersPlan {
    /** 지울 `korean_tickers` 심볼(정렬) — 잘못된 매핑이 쓴 행. */
    orphaned: string[];
    /** 잘못된 매핑 심볼이지만 영문명이 달라 남기는 행 수(다른 경로가 다시 쓴 행). */
    keptDifferentName: number;
}

/**
 * 잘못된 매핑(`mismatch`)이 `korean_tickers`에 남긴 행을 고른다.
 *
 * 옛 폴백 경로는 `asset_translations`에 쓰기 직전 `translateAndPersist`로 `korean_tickers`에도
 * **같은 영문명**(다른 종목의 이름, 예: `APPL` → "Apple Hospitality …")과 그 번역을 썼다. 이 행은
 * 한글 검색 자동완성에 그대로 노출된다. 같은 판정(`asset_translations` 쪽이 `mismatch`)인 심볼 중
 * `korean_tickers.name`이 그 잘못된 영문명과 **정확히 같은** 행만 지운다 — 이름이 다르면 그 뒤에
 * 다른 경로(검색 시드·이름 재조정)가 다시 쓴 행이라 남긴다.
 */
export function planOrphanedKoreanTickers(
    mismatchedTranslations: readonly NamedSymbolRow[],
    koreanTickerRows: readonly NamedSymbolRow[]
): OrphanedKoreanTickersPlan {
    const badNameBySymbol = new Map(
        mismatchedTranslations.map(row => [row.symbol, row.name])
    );
    const orphaned: string[] = [];
    let keptDifferentName = 0;
    for (const row of koreanTickerRows) {
        const badName = badNameBySymbol.get(row.symbol);
        if (badName === undefined) continue;
        if (row.name === badName) orphaned.push(row.symbol);
        else keptDifferentName += 1;
    }
    return { orphaned: orphaned.sort(), keptDifferentName };
}
