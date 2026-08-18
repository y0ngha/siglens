import { searchNaverNews } from '@/entities/news-article/lib/naverNewsSearch';
import { NaverMarketNewsClient } from '../lib/naverMarketNewsClient';
import { CATEGORY_CONFIG } from '../lib/categoryConfig';

vi.mock('@/entities/news-article/lib/naverNewsSearch', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/news-article/lib/naverNewsSearch')
    >('@/entities/news-article/lib/naverNewsSearch');
    return { ...actual, searchNaverNews: vi.fn() };
});

const mockSearch = vi.mocked(searchNaverNews);

/** `daysAgo`일 전 발행된 네이버 원본 기사. */
function article(title: string, url: string, daysAgo = 0) {
    return {
        title,
        originallink: url,
        link: `https://n.news.naver.com/${url}`,
        description: `${title} 요약`,
        pubDate: new Date(
            Date.now() - daysAgo * 24 * 60 * 60 * 1000
        ).toUTCString(),
    };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('NaverMarketNewsClient', () => {
    beforeEach(() => {
        mockSearch.mockReset();
    });

    it('runs one search per configured query', async () => {
        mockSearch.mockResolvedValue([]);
        await new NaverMarketNewsClient().fetchCategoryNews('kr', WEEK_MS);

        expect(mockSearch).toHaveBeenCalledTimes(
            CATEGORY_CONFIG.kr.naverQueries.length
        );
        for (const query of CATEGORY_CONFIG.kr.naverQueries) {
            expect(mockSearch).toHaveBeenCalledWith(
                query,
                expect.any(Number),
                expect.any(String)
            );
        }
    });

    it('dedupes the same article across queries', async () => {
        // 같은 기사가 `코스피`·`국내 증시` 양쪽에 잡히는 것이 정상이다.
        mockSearch.mockResolvedValue([
            article('코스피 반등', 'https://example.com/a'),
        ]);

        const items = await new NaverMarketNewsClient().fetchCategoryNews(
            'kr',
            WEEK_MS
        );
        expect(items).toHaveLength(1);
    });

    it('buckets every item under the KR sentinel', async () => {
        mockSearch.mockResolvedValue([
            article('코스피 반등', 'https://example.com/a'),
        ]);

        const [item] = await new NaverMarketNewsClient().fetchCategoryNews(
            'kr',
            WEEK_MS
        );
        expect(item.symbol).toBe(CATEGORY_CONFIG.kr.sentinel);
    });

    it('marks the source language as Korean', async () => {
        // 이 값이 없으면 core 프롬프트가 "영문을 한국어로 번역하라"고 지시해,
        // 이미 정확한 제목을 모델이 조용히 고쳐 쓸 여지를 준다.
        mockSearch.mockResolvedValue([
            article('코스피 반등', 'https://example.com/a'),
        ]);

        const [item] = await new NaverMarketNewsClient().fetchCategoryNews(
            'kr',
            WEEK_MS
        );
        expect(item.sourceLanguage).toBe('ko');
    });

    it('leaves tickers empty rather than guessing', async () => {
        // 네이버는 기사에 붙은 종목코드를 주지 않는다 — 추정으로 채우면 무관한
        // 종목 페이지에 기사가 걸린다.
        mockSearch.mockResolvedValue([
            article('삼성전자 신고가', 'https://example.com/a'),
        ]);

        const [item] = await new NaverMarketNewsClient().fetchCategoryNews(
            'kr',
            WEEK_MS
        );
        expect(item.tickers).toEqual([]);
    });

    it('drops articles older than the lookback window', async () => {
        mockSearch.mockResolvedValue([
            article('오래된 기사', 'https://example.com/old', 30),
            article('최근 기사', 'https://example.com/new', 1),
        ]);

        const items = await new NaverMarketNewsClient().fetchCategoryNews(
            'kr',
            WEEK_MS
        );
        expect(items.map(i => i.url)).toEqual(['https://example.com/new']);
    });

    it('returns newest first', async () => {
        mockSearch.mockResolvedValue([
            article('이틀 전', 'https://example.com/older', 2),
            article('어제', 'https://example.com/newer', 1),
        ]);

        const items = await new NaverMarketNewsClient().fetchCategoryNews(
            'kr',
            WEEK_MS
        );
        expect(items.map(i => i.url)).toEqual([
            'https://example.com/newer',
            'https://example.com/older',
        ]);
    });

    it('refuses a non-naver category instead of returning US news', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const items = await new NaverMarketNewsClient().fetchCategoryNews(
            'stock',
            WEEK_MS
        );

        expect(items).toEqual([]);
        expect(mockSearch).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('degrades to an empty feed when the search fails', async () => {
        // `searchNaverNews`가 자격증명 없음·네트워크 실패를 전부 `[]`로 흡수한다.
        mockSearch.mockResolvedValue([]);

        await expect(
            new NaverMarketNewsClient().fetchCategoryNews('kr', WEEK_MS)
        ).resolves.toEqual([]);
    });
});
