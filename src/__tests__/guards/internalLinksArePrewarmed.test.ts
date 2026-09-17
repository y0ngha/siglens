import { describe, expect, it } from 'vitest';
import { relatedSymbolsFor } from '@/shared/config/relatedSymbols';
import { buildPrewarmUniverse } from '@/entities/seo-snapshot/lib/applicability';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';

/**
 * 내부링크 ⊆ 프리웜 유니버스.
 *
 * `RelatedSymbols`는 심볼 페이지끼리를 잇는 유일한 간선이다(2026-08-24 실측:
 * 그전엔 431종 중 303종이 내부링크 고아였다). 그 칩이 프리웜 유니버스 **밖**
 * 심볼을 가리키면 크롤러가 스냅샷 없는 콜드 페이지로 끌려간다 — 우리가 스스로
 * 링크한 페이지가 정작 얇은 상태로 색인되는, 이 레포가 2026-07에 겪은 강등과
 * 같은 모양이다.
 *
 * 테마 그룹(`CROSS_MARKET_THEME_GROUPS`·`SECTOR_STOCKS`·`TICKER_CATEGORIES` …)은
 * 링과 **다른 소스**라, 거기 새 심볼을 하나 적으면 화이트리스트에 없어도 칩으로
 * 나간다. 이 가드가 그 경로를 막는다.
 */
describe('internal links ⊆ prewarm universe', () => {
    const prewarmed = new Set(buildPrewarmUniverse().map(p => p.symbol));
    const universe = [...POPULAR_TICKERS, ...POPULAR_CRYPTOS];

    it('RelatedSymbols가 내보낼 수 있는 모든 심볼이 프리웜 대상이다', () => {
        const escaped = new Set<string>();
        for (const symbol of universe) {
            for (const related of relatedSymbolsFor(symbol)) {
                if (!prewarmed.has(related.symbol)) {
                    escaped.add(`${symbol} → ${related.symbol}`);
                }
            }
        }
        expect([...escaped]).toEqual([]);
    });
});
