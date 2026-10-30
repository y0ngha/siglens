import {
    parseArticleTickers,
    selectFmpArticleItems,
    selectFmpLatestItems,
    type FmpSelectionContext,
    type RawFmpArticle,
    type RawFmpLatestNews,
} from '../fmpNewsMapping';

const CUTOFF = new Date('2026-06-09T00:00:00Z');

function context(
    overrides: Partial<FmpSelectionContext> = {}
): FmpSelectionContext {
    return {
        sentinel: '__NEWS_STOCK__',
        cutoff: CUTOFF,
        normalizeDate: value => (value === 'bad' ? null : value),
        ...overrides,
    };
}

const LATEST: RawFmpLatestNews = {
    symbol: 'AAPL',
    publishedDate: '2026-06-15T10:00:00.000Z',
    publisher: null,
    title: 'Apple reports record quarter',
    site: 'Reuters',
    text: 'Apple beat estimates.',
    url: 'https://x.com/aapl',
};

const ARTICLE: RawFmpArticle = {
    title: 'How to read a balance sheet',
    date: '2026-06-15T11:00:00.000Z',
    content: 'Body.',
    tickers: 'NASDAQ:AAPL,NYSE:MSFT',
    link: 'https://x.com/guide',
    site: 'FMP',
};

describe('parseArticleTickers는', () => {
    it('EXCH: prefix를 제거하고 bare 티커를 반환한다', () => {
        expect(parseArticleTickers('NASDAQ:AAPL,NYSE:MSFT')).toEqual([
            'AAPL',
            'MSFT',
        ]);
    });

    it('null/undefined/빈 문자열이면 빈 배열을 반환한다', () => {
        expect(parseArticleTickers(null)).toEqual([]);
        expect(parseArticleTickers(undefined)).toEqual([]);
        expect(parseArticleTickers('')).toEqual([]);
    });

    it('EXCH: 없는 bare 티커도 그대로 반환한다', () => {
        expect(parseArticleTickers('AAPL,MSFT')).toEqual(['AAPL', 'MSFT']);
    });

    it('공백과 빈 항목을 정리한다', () => {
        expect(parseArticleTickers(' NASDAQ:AAPL , ,MSFT ')).toEqual([
            'AAPL',
            'MSFT',
        ]);
    });
});

describe('selectFmpLatestItems는', () => {
    it('sentinel·티커·발행처를 채워 매핑한다', () => {
        expect(selectFmpLatestItems([LATEST], context())).toEqual([
            expect.objectContaining({
                symbol: '__NEWS_STOCK__',
                source: 'Reuters',
                url: 'https://x.com/aapl',
                publishedAt: '2026-06-15T10:00:00.000Z',
                titleEn: 'Apple reports record quarter',
                bodyEn: 'Apple beat estimates.',
                tickers: ['AAPL'],
            }),
        ]);
    });

    it('publisher가 있으면 site보다 우선한다', () => {
        const [item] = selectFmpLatestItems(
            [{ ...LATEST, publisher: 'Bloomberg' }],
            context()
        );
        expect(item.source).toBe('Bloomberg');
    });

    it('symbol이 null이면 tickers가 비고 text가 없으면 bodyEn이 null이다', () => {
        const [item] = selectFmpLatestItems(
            [{ ...LATEST, symbol: null, text: undefined }],
            context()
        );
        expect(item.tickers).toEqual([]);
        expect(item.bodyEn).toBeNull();
    });

    it('날짜를 정규화하지 못한 행을 버린다', () => {
        expect(
            selectFmpLatestItems(
                [{ ...LATEST, publishedDate: 'bad' }],
                context()
            )
        ).toEqual([]);
    });

    it('컷오프 이전 기사를 버린다', () => {
        expect(
            selectFmpLatestItems(
                [{ ...LATEST, publishedDate: '2026-06-08T23:59:59.000Z' }],
                context()
            )
        ).toEqual([]);
    });

    it('컷오프와 같은 시각 기사는 남긴다', () => {
        expect(
            selectFmpLatestItems(
                [{ ...LATEST, publishedDate: CUTOFF.toISOString() }],
                context()
            )
        ).toHaveLength(1);
    });

    it('로펌 원고 모집 광고를 버린다', () => {
        expect(
            selectFmpLatestItems(
                [
                    {
                        ...LATEST,
                        title: 'ROSEN, A LEADING INVESTOR RIGHTS FIRM, Encourages Apple Inc. Investors to Secure Counsel Before Important Deadline in Securities Class Action',
                    },
                ],
                context()
            )
        ).toEqual([]);
    });
});

describe('selectFmpArticleItems는', () => {
    it('link·site·tickers를 articles 형상으로 매핑한다', () => {
        expect(selectFmpArticleItems([ARTICLE], context())).toEqual([
            expect.objectContaining({
                symbol: '__NEWS_STOCK__',
                source: 'FMP',
                url: 'https://x.com/guide',
                bodyEn: 'Body.',
                tickers: ['AAPL', 'MSFT'],
            }),
        ]);
    });

    it('컷오프 이전 기사를 버린다', () => {
        expect(
            selectFmpArticleItems(
                [{ ...ARTICLE, date: '2026-06-01T00:00:00.000Z' }],
                context()
            )
        ).toEqual([]);
    });
});
