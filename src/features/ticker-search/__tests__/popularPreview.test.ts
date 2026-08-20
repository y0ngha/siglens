import { describe, expect, it } from 'vitest';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { TICKER_CATEGORIES } from '@/shared/config/popular-tickers';
import { POPULAR_PREVIEW_GROUPS } from '@/features/ticker-search/lib/popularPreview';

/**
 * 이 목록의 계약은 두 가지다 — **세 자산군을 대표할 것**, 그리고 **손으로 적은 네 번째
 * 목록이 되지 않을 것**. 아래 테스트가 그 둘을 고정한다.
 */
describe('POPULAR_PREVIEW_GROUPS', () => {
    it('미국·한국·암호화폐를 모두 담는다', () => {
        // 첫 방문자(최근 검색 없음)가 보는 유일한 화면이다. 미국 종목만 있으면
        // 한국 주식·코인 사용자에게는 "입력 전에도 볼 게 있다"가 성립하지 않는다.
        expect(POPULAR_PREVIEW_GROUPS.map(g => g.label)).toEqual([
            '미국',
            '한국',
            '암호화폐',
        ]);
    });

    it('모든 심볼이 기존 config에서 유래한다', () => {
        // 원본에서 종목이 빠지면 여기서 먼저 깨진다 — 드리프트 가드.
        const known = new Set([
            ...TICKER_CATEGORIES.flatMap(c => c.items.map(i => i.symbol)),
            ...CRYPTO_CATEGORIES.flatMap(c => c.items.map(i => i.symbol)),
        ]);
        for (const group of POPULAR_PREVIEW_GROUPS) {
            for (const item of group.items) {
                expect(known.has(item.symbol)).toBe(true);
            }
        }
    });

    it('표시 이름도 원본 config와 일치한다', () => {
        // 심볼만 맞고 이름이 어긋나면 홈 그리드와 검색 오버레이가 같은 종목을 다른
        // 이름으로 부른다 — `assetClassNav.ts`가 막으려던 바로 그 드리프트다.
        const bySymbol = new Map(
            [
                ...TICKER_CATEGORIES.flatMap(c => c.items),
                ...CRYPTO_CATEGORIES.flatMap(c => c.items),
            ].map(i => [i.symbol, i.name])
        );
        for (const group of POPULAR_PREVIEW_GROUPS) {
            for (const item of group.items) {
                expect(item.name).toBe(bySymbol.get(item.symbol));
            }
        }
    });

    it('한국 그룹은 실제 국내 종목을 담는다', () => {
        const kr = POPULAR_PREVIEW_GROUPS.find(g => g.label === '한국');
        expect(kr?.items.every(i => /\.(KS|KQ)$/.test(i.symbol))).toBe(true);
    });
});
