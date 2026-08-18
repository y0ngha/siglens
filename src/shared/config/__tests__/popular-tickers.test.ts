import {
    CURATED_KOREAN_NAMES,
    KR_CATEGORY_IDS,
    POPULAR_TICKERS,
    TICKER_CATEGORIES,
} from '@/shared/config/popular-tickers';

describe('TICKER_CATEGORIES', () => {
    it('비어있지 않은 배열이다', () => {
        expect(TICKER_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('각 카테고리가 id, label, items를 가진다', () => {
        for (const category of TICKER_CATEGORIES) {
            expect(typeof category.id).toBe('string');
            expect(category.id.length).toBeGreaterThan(0);
            expect(typeof category.label).toBe('string');
            expect(category.label.length).toBeGreaterThan(0);
            expect(category.items.length).toBeGreaterThan(0);
        }
    });

    it('카테고리 id 값에 중복이 없다', () => {
        const ids = TICKER_CATEGORIES.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('각 카테고리 내 ticker에 중복이 없다', () => {
        for (const category of TICKER_CATEGORIES) {
            const symbols = category.items.map(i => i.symbol);
            expect(new Set(symbols).size).toBe(symbols.length);
        }
    });

    it('모든 ticker가 비어있지 않은 문자열이다', () => {
        for (const category of TICKER_CATEGORIES) {
            for (const item of category.items) {
                expect(typeof item.symbol).toBe('string');
                expect(item.symbol.length).toBeGreaterThan(0);
                expect(typeof item.name).toBe('string');
                expect(item.name.length).toBeGreaterThan(0);
            }
        }
    });

    it('megacap 카테고리가 존재한다', () => {
        const megacap = TICKER_CATEGORIES.find(c => c.id === 'megacap');
        expect(megacap).toBeDefined();
        const symbols = megacap!.items.map(i => i.symbol);
        expect(symbols).toContain('AAPL');
        expect(symbols).toContain('MSFT');
    });

    it('순수 우주 기업 카테고리를 포함한다', () => {
        const space = TICKER_CATEGORIES.find(c => c.id === 'space');
        expect(space).toBeDefined();
        expect(space!.label).toBe('우주·항공우주');
        expect(space!.items.map(i => i.symbol)).toEqual([
            'RKLB',
            'ASTS',
            'LUNR',
            'RDW',
            'PL',
            'SPCE',
        ]);
    });

    /**
     * 회귀 가드(SEO 감사 라운드 2 finding 1): SPCX는 SpaceX가 아니라 SPAC/신규 발행
     * ETF다. SpaceX는 비상장이라 대체 티커가 없으므로, 이 심볼은 어떤 카테고리에도
     * 있으면 안 된다 — 있으면 카테고리 그리드가 다시 "스페이스X"로 표기하게 된다.
     */
    it('SPCX(SPAC/신규 발행 ETF, SpaceX 아님)를 어떤 카테고리에도 포함하지 않는다', () => {
        for (const category of TICKER_CATEGORIES) {
            expect(category.items.map(i => i.symbol)).not.toContain('SPCX');
        }
    });
});

describe('POPULAR_TICKERS', () => {
    it('비어있지 않은 배열이다', () => {
        expect(POPULAR_TICKERS.length).toBeGreaterThan(0);
    });

    it('모든 항목이 비어있지 않은 문자열이다', () => {
        for (const ticker of POPULAR_TICKERS) {
            expect(typeof ticker).toBe('string');
            expect(ticker.length).toBeGreaterThan(0);
        }
    });

    it('중복 값이 없다', () => {
        expect(new Set(POPULAR_TICKERS).size).toBe(POPULAR_TICKERS.length);
    });

    it('대표 메가캡 티커를 포함한다', () => {
        expect(POPULAR_TICKERS).toContain('AAPL');
        expect(POPULAR_TICKERS).toContain('MSFT');
        expect(POPULAR_TICKERS).toContain('NVDA');
        expect(POPULAR_TICKERS).toContain('GOOGL');
        expect(POPULAR_TICKERS).toContain('AMZN');
    });

    it('100개 이상의 티커를 포함한다', () => {
        expect(POPULAR_TICKERS.length).toBeGreaterThanOrEqual(100);
    });

    /**
     * 회귀 가드(SEO 감사 라운드 2 finding 1): SPCX는 SpaceX가 아니라 SPAC/신규 발행
     * ETF다. SpaceX는 비상장이라 대체 티커가 없다 — 있으면 sitemap이 다시 그 심볼을
     * 8개 URL로 실어 나른다.
     */
    it('SPCX(SPAC/신규 발행 ETF, SpaceX 아님)를 포함하지 않는다', () => {
        expect(POPULAR_TICKERS).not.toContain('SPCX');
    });

    /**
     * 회귀 가드(SEO 감사 라운드 2 finding 2): SKHY(SK하이닉스 OTC ADR)는
     * 000660.KS(KRX 원주)와 같은 회사다. 둘 다 있으면 같은 한국어 검색 의도를
     * 두 개의 색인 가능 클러스터가 나눠 갖는다 — 원주만 남긴다.
     */
    it('SKHY(000660.KS와 동일 회사인 OTC ADR)를 포함하지 않는다', () => {
        expect(POPULAR_TICKERS).not.toContain('SKHY');
        expect(POPULAR_TICKERS).toContain('000660.KS');
    });
});

/**
 * KR 카테고리들은 저장소 전체에서 한국 종목 페이지로 가는 **유일한 크롤 가능한
 * 링크**다(검색 자동완성은 `<button>` + `router.push`, 크로스링크는 같은 심볼의 다른 탭만).
 * 동시에 `CURATED_KOREAN_NAMES`의 원천이라, 여기 빠진 종목은 콜드 ISR에서 영문 티커 제목이
 * 캐시에 굳는다. 두 목록이 어긋나면 그 종목은 sitemap에만 있는 고아가 된다.
 *
 * 업종 분할(2026-08) 이후로는 **합집합**이 기준이다 — 카테고리를 더 쪼개더라도 한
 * 종목이 어느 카드에도 안 들어가면 같은 고아가 생긴다.
 */
describe('KR 카테고리 합집합 ↔ POPULAR_TICKERS KR 블록', () => {
    const krPopular = POPULAR_TICKERS.filter(t => /\.K[SQ]$/.test(t));
    const krCategories = TICKER_CATEGORIES.filter(c =>
        KR_CATEGORY_IDS.has(c.id)
    );

    it('두 목록이 정확히 같은 심볼 집합이다', () => {
        expect(krCategories.length).toBeGreaterThan(0);
        const categorySymbols = krCategories.flatMap(c =>
            c.items.map(i => i.symbol)
        );
        expect([...categorySymbols].sort()).toEqual([...krPopular].sort());
    });

    it('같은 종목이 두 카테고리에 중복 노출되지 않는다', () => {
        const all = krCategories.flatMap(c => c.items.map(i => i.symbol));
        expect(all.length).toBe(new Set(all).size);
    });

    it('모든 KR 인기 종목에 한글명 폴백이 있다', () => {
        for (const symbol of krPopular) {
            expect(CURATED_KOREAN_NAMES.get(symbol)).toBeTruthy();
        }
    });
});

/**
 * `KR_CATEGORY_IDS`가 실제 카테고리 목록과 어긋나면 홈 그리드의 미국/한국 분리와
 * 위 합집합 불변식이 **둘 다 동시에** 조용히 빗나간다 — 빠진 카테고리는 미국 섹션에
 * 렌더되면서 고아 검사에서도 제외된다.
 */
describe('KR_CATEGORY_IDS', () => {
    it('KR 종목을 담은 카테고리를 하나도 빠뜨리지 않는다', () => {
        const holdsKrSymbols = TICKER_CATEGORIES.filter(c =>
            c.items.some(i => /\.K[SQ]$/.test(i.symbol))
        ).map(c => c.id);
        expect([...holdsKrSymbols].sort()).toEqual([...KR_CATEGORY_IDS].sort());
    });

    it('KR 종목이 없는 카테고리를 포함하지 않는다', () => {
        for (const id of KR_CATEGORY_IDS) {
            const category = TICKER_CATEGORIES.find(c => c.id === id);
            expect(category).toBeDefined();
            expect(category!.items.every(i => /\.K[SQ]$/.test(i.symbol))).toBe(
                true
            );
        }
    });
});
