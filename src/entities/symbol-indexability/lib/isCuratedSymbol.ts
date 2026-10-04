import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { APPROVED_LONGTAIL_TICKERS } from '../config/approved-longtail-tickers';

const CURATED_SYMBOLS = new Set<string>([
    ...POPULAR_TICKERS,
    ...POPULAR_CRYPTOS,
    ...APPROVED_LONGTAIL_TICKERS,
]);

/**
 * 편집 결정으로 고른 종목인지 — 인기 종목, 인기 크립토, 승인된 롱테일.
 *
 * 이 집합이 곧 색인 가능한 종목 집합이고(`evaluateSymbolIndexability`), SEO 프리웜
 * 유니버스와도 같다. 그래서 두 곳에서 쓴다:
 *
 * - 색인 판정: 이 집합 밖은 `longtail-default-blocked`(noindex).
 * - AI 분석 자동 실행 게이트(`useAiAutoRunAllowed`): 이 집합 밖은 첫 신뢰 입력 전까지
 *   캐시만 읽는다. 색인되지 않는 페이지라 렌더된 DOM이 검색에 쓰이지 않는데,
 *   2026-09-27 이후 입력 없이 렌더만 하는 크롤러가 그 페이지에서 차트 분석 비용의
 *   1/3을 만들고 있었다(spec `2026-10-04-longtail-ai-interaction-gate-design.md`).
 *
 * 두 판정이 같은 함수를 써야 "색인되는데 게이트가 걸린 페이지"(크롤러가 빈 분석을
 * 색인) 같은 어긋남이 생기지 않는다.
 */
export function isCuratedSymbol(symbol: string): boolean {
    return CURATED_SYMBOLS.has(symbol.toUpperCase());
}
