/**
 * 인기 목록 스크립트의 **방문 기반 추가 후보** 선정 — 순수 함수만.
 *
 * `symbol_views_daily`의 최근 합계를 받아 자산군별로 "기존 목록에 없는 상위 N개"를
 * 고른다. 시장 필터(가격·시총 등)는 각 스크립트가 이 뒤에서 건다.
 */
import type { SymbolViewTally } from '@/entities/symbol-view/types';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';

export type AssetClass = 'us' | 'kr' | 'crypto';

/** 스크립트가 읽는 구간. 거래량 후보의 주간 기준과 맞춘다. */
export const VISIT_LOOKBACK_DAYS = 7;

/**
 * 후보가 되는 최소 조회수(구간 합계, 종목당 하루 1회 중복 제거된 값).
 * 2026-09 실측 실사용자 DAU가 20~38명이라 작게 잡는다. 1~2는 크롤러 순회·우연 방문이
 * 대부분이다.
 */
export const MIN_WEEKLY_VIEWS = 3;

/** 실행 1회·자산군당 상한. 기존 거래량·시총 후보와 별도 할당이다. */
export const MAX_VISIT_CANDIDATES_PER_CLASS = 5;

const POPULAR_TICKERS_DECLARATION = 'export const POPULAR_TICKERS = [';

export function classifyVisitSymbol(
    symbol: string,
    cryptoSymbols: ReadonlySet<string>
): AssetClass {
    if (KR_EXCHANGE_SUFFIX_RE.test(symbol)) return 'kr';
    if (cryptoSymbols.has(symbol)) return 'crypto';
    return 'us';
}

export function selectVisitCandidates(
    tallies: readonly SymbolViewTally[],
    assetClass: AssetClass,
    existing: ReadonlySet<string>,
    classify: (symbol: string) => AssetClass
): SymbolViewTally[] {
    return tallies
        .filter(t => classify(t.symbol) === assetClass)
        .filter(t => !existing.has(t.symbol))
        .slice()
        .sort((a, b) => b.views - a.views)
        .slice(0, MAX_VISIT_CANDIDATES_PER_CLASS);
}

/**
 * `POPULAR_TICKERS` 안의 KR 심볼.
 *
 * `update-popular-tickers.ts`의 `extractExistingTickers`는 정규식이 `[A-Z]`로 시작해
 * `005930.KS`를 못 본다. 그걸 그대로 쓰면 이미 있는 KR 종목을 신규로 판정한다.
 */
export function extractExistingKrTickers(fileContent: string): Set<string> {
    const start = fileContent.indexOf(POPULAR_TICKERS_DECLARATION);
    if (start === -1) return new Set();
    const section = fileContent.slice(start);
    return new Set(
        [...section.matchAll(/['"](\d{6}\.K[SQ])['"]/g)].map(m => m[1]!)
    );
}
