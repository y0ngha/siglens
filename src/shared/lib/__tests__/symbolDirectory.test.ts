/**
 * 종목 디렉터리의 **커버리지**를 고정한다.
 *
 * 이 페이지의 존재 이유가 "sitemap에만 있는 심볼을 없앤다"이므로, 목록이 sitemap
 * 소스와 어긋나는 순간 페이지는 의미를 잃는다(링크 없는 심볼이 다시 생긴다).
 * 그래서 화면 렌더가 아니라 **집합 동등성**을 단언한다.
 */
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { buildPrewarmUniverse } from '@/entities/seo-snapshot/lib/applicability';
import {
    buildSymbolDirectory,
    symbolDirectoryCount,
} from '@/shared/lib/symbolDirectory';

const allItems = () => buildSymbolDirectory().flatMap(s => s.items);

describe('buildSymbolDirectory', () => {
    it('sitemap 소스(POPULAR_TICKERS + POPULAR_CRYPTOS)의 모든 심볼을 정확히 한 번 담는다', () => {
        const listed = allItems().map(i => i.symbol);
        const expected = [...POPULAR_TICKERS, ...POPULAR_CRYPTOS];

        expect([...new Set(listed)]).toHaveLength(listed.length);
        expect(new Set(listed)).toEqual(new Set(expected));
        expect(symbolDirectoryCount(buildSymbolDirectory())).toBe(
            expected.length
        );
    });

    /**
     * 우리가 링크하는 페이지는 프리웜 대상이어야 한다 — 스냅샷 없는 콜드 페이지로
     * 크롤러를 끌고 가면 얇은 상태로 색인된다(`internalLinksArePrewarmed` 가드와
     * 같은 이유. 그 가드는 `RelatedSymbols`만 덮으므로 이 표면은 여기서 본다).
     */
    it('링크하는 모든 심볼이 프리웜 유니버스 안에 있다', () => {
        const prewarmed = new Set(buildPrewarmUniverse().map(p => p.symbol));
        const escaped = allItems()
            .map(i => i.symbol)
            .filter(symbol => !prewarmed.has(symbol));

        expect(escaped).toEqual([]);
    });

    it('한국 종목과 암호화폐를 미국 섹션과 섞지 않는다', () => {
        const [us, kr, crypto] = buildSymbolDirectory();

        expect(us.id).toBe('us');
        expect(kr.items.every(i => /\.K[SQ]$/.test(i.symbol))).toBe(true);
        expect(us.items.every(i => !/\.K[SQ]$/.test(i.symbol))).toBe(true);
        expect(new Set(crypto.items.map(i => i.symbol))).toEqual(
            new Set(POPULAR_CRYPTOS)
        );
    });

    it('섹션마다 심볼이 알파벳 순이다 — 416개를 눈으로 찾으려면 순서가 필요하다', () => {
        for (const section of buildSymbolDirectory()) {
            const symbols = section.items.map(i => i.symbol);
            expect(symbols).toEqual(
                [...symbols].sort((a, b) => a.localeCompare(b))
            );
        }
    });

    it('withKoreanNames=false면 한글명을 싣지 않는다 — 비-ko 화면에 한국어가 새지 않게', () => {
        const withNames = buildSymbolDirectory({ withKoreanNames: true });
        const withoutNames = buildSymbolDirectory({ withKoreanNames: false });

        // 큐레이션 목록에 있는 종목은 ko에서 한글명을 받는다(표본이 비면 이 단언이
        // 공허해지므로 개수부터 확인한다).
        const named = withNames
            .flatMap(s => s.items)
            .filter(i => i.koreanName !== null);
        expect(named.length).toBeGreaterThan(50);
        expect(
            withoutNames.flatMap(s => s.items).every(i => i.koreanName === null)
        ).toBe(true);
    });
});
