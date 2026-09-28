import { hasAnalyzableNews } from '../../lib/hasAnalyzableNews';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '../../lib/newsLookback';

/**
 * 보강이 끝난 행만 `buildAnalysisNewsItems`를 통과한다 — 이 술어의 존재 이유가
 * 바로 "DB에 기사는 있는데 분석은 no_news"를 구분하는 것이므로, 미보강 행이
 * 0건으로 취급되는지가 핵심 단언이다.
 */
function enrichedRow(id: string) {
    return {
        id,
        title: 'title',
        titleKo: '제목',
        summary: 'summary',
        summaryKo: '요약',
        url: `https://example.com/${id}`,
        site: 'example.com',
        publishedAt: new Date().toISOString(),
        symbol: 'SQQQ',
        sentiment: 'neutral',
        category: 'market',
        priceImpact: 'low',
        analyzedAt: new Date().toISOString(),
    };
}

function unenrichedRow(id: string) {
    return { ...enrichedRow(id), titleKo: null, sentiment: null };
}

describe('hasAnalyzableNews 함수는', () => {
    it('보강된 행이 있으면 true', async () => {
        const repo = {
            listBySymbol: vi.fn().mockResolvedValue([enrichedRow('a')]),
        };

        await expect(hasAnalyzableNews(repo as never, 'SQQQ')).resolves.toBe(
            true
        );
    });

    it('행이 아예 없으면 false', async () => {
        const repo = { listBySymbol: vi.fn().mockResolvedValue([]) };

        await expect(hasAnalyzableNews(repo as never, 'LABU')).resolves.toBe(
            false
        );
    });

    it('행은 있지만 전부 미보강이면 false — seam이 no_news로 떨어지는 바로 그 상태', async () => {
        const repo = {
            listBySymbol: vi
                .fn()
                .mockResolvedValue([unenrichedRow('a'), unenrichedRow('b')]),
        };

        await expect(hasAnalyzableNews(repo as never, 'SQQQ')).resolves.toBe(
            false
        );
    });

    it('seam과 같은 분석 창(30일)으로 조회한다', async () => {
        const repo = { listBySymbol: vi.fn().mockResolvedValue([]) };

        await hasAnalyzableNews(repo as never, 'sqqq');

        expect(repo.listBySymbol).toHaveBeenCalledWith(
            'sqqq',
            NEWS_ANALYSIS_LOOKBACK_MS
        );
    });
});
