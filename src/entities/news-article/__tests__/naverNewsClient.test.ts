import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NaverNewsClient, stripNaverMarkup } from '../lib/naverNewsClient';

const KOREAN_NAME = '삼성전자';
const SYMBOL = '005930.KS';

function naverItem(overrides: Record<string, unknown> = {}) {
    return {
        title: '<b>삼성전자</b>, 3분기 영업이익 발표',
        originallink: 'https://news.example.com/article/1',
        link: 'https://n.news.naver.com/article/1',
        description:
            '삼성전자가 &quot;호실적&quot;을 기록했다고 <b>발표</b>했다.',
        pubDate: 'Fri, 14 Aug 2026 15:30:00 +0900',
        ...overrides,
    };
}

function mockNaverResponse(items: unknown[]) {
    return {
        ok: true,
        status: 200,
        json: async () => ({ items }),
    } as unknown as Response;
}

describe('stripNaverMarkup', () => {
    it('removes <b> highlight tags', () => {
        expect(stripNaverMarkup('<b>삼성전자</b> 실적')).toBe('삼성전자 실적');
    });

    it('decodes HTML entities', () => {
        expect(stripNaverMarkup('&quot;호실적&quot; &amp; 전망')).toBe(
            '"호실적" & 전망'
        );
    });

    it('does not resurrect tags from double-encoded input', () => {
        // `&amp;`를 먼저 풀면 `&amp;lt;b&amp;gt;`가 `<b>`로 되살아나 태그가 다시 생긴다.
        expect(stripNaverMarkup('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
    });
});

describe('NaverNewsClient', () => {
    const resolveQuery = vi.fn(async () => KOREAN_NAME as string | null);
    const fetchSpy = vi.fn();

    beforeEach(() => {
        vi.stubEnv('NAVER_CLIENT_ID', 'test-id');
        vi.stubEnv('NAVER_CLIENT_SECRET', 'test-secret');
        resolveQuery.mockClear();
        fetchSpy.mockReset();
        vi.stubGlobal('fetch', fetchSpy);
        vi.setSystemTime(new Date('2026-08-16T00:00:00Z'));
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('maps a Naver article to a NewsItem with markup stripped', async () => {
        fetchSpy.mockResolvedValue(mockNaverResponse([naverItem()]));

        const items = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            symbol: SYMBOL,
            source: '네이버뉴스',
            url: 'https://news.example.com/article/1',
            titleEn: '삼성전자, 3분기 영업이익 발표',
            bodyEn: '삼성전자가 "호실적"을 기록했다고 발표했다.',
        });
        // pubDate에 +0900 오프셋이 있으므로 UTC 변환이 정확해야 한다.
        expect(items[0]!.publishedAt).toBe('2026-08-14T06:30:00.000Z');
    });

    it('sends the Korean company name as the query, not the ticker', async () => {
        // 종목코드로 검색하면 국내 기사가 거의 잡히지 않는다.
        fetchSpy.mockResolvedValue(mockNaverResponse([]));

        await new NaverNewsClient(resolveQuery).fetchNews(SYMBOL, '24h');

        const url = String(fetchSpy.mock.calls[0]![0]);
        expect(url).toContain(`query=${encodeURIComponent(KOREAN_NAME)}`);
        expect(url).not.toContain('005930');
        expect(url).toContain('sort=date');
    });

    it('authenticates with the Naver client headers', async () => {
        fetchSpy.mockResolvedValue(mockNaverResponse([]));

        await new NaverNewsClient(resolveQuery).fetchNews(SYMBOL, '24h');

        expect(fetchSpy.mock.calls[0]![1]).toMatchObject({
            headers: {
                'X-Naver-Client-Id': 'test-id',
                'X-Naver-Client-Secret': 'test-secret',
            },
        });
    });

    it('prefers the original link over the Naver mirror', async () => {
        // 네이버 링크는 기사 이관 시 만료되지만 원문 URL은 남는다.
        fetchSpy.mockResolvedValue(mockNaverResponse([naverItem()]));

        const [item] = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(item!.url).toBe('https://news.example.com/article/1');
    });

    it('falls back to the Naver link when the original is missing', async () => {
        fetchSpy.mockResolvedValue(
            mockNaverResponse([naverItem({ originallink: undefined })])
        );

        const [item] = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(item!.url).toBe('https://n.news.naver.com/article/1');
    });

    it('drops articles with no usable URL, title, or date', async () => {
        fetchSpy.mockResolvedValue(
            mockNaverResponse([
                naverItem({ originallink: undefined, link: undefined }),
                naverItem({ title: undefined }),
                naverItem({ pubDate: 'not-a-date' }),
            ])
        );

        const items = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(items).toEqual([]);
    });

    it('filters out articles older than the requested range', async () => {
        fetchSpy.mockResolvedValue(
            mockNaverResponse([
                naverItem({ pubDate: 'Fri, 14 Aug 2026 15:30:00 +0900' }),
                naverItem({
                    pubDate: 'Mon, 01 Jun 2026 09:00:00 +0900',
                    originallink: 'https://news.example.com/article/old',
                }),
            ])
        );

        const items = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(items).toHaveLength(1);
        expect(items[0]!.url).toBe('https://news.example.com/article/1');
    });

    it('returns empty without calling the API when credentials are missing', async () => {
        vi.stubEnv('NAVER_CLIENT_ID', '');

        const items = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(items).toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('skips the request when no Korean name is known yet', async () => {
        resolveQuery.mockResolvedValueOnce(null);

        const items = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(items).toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('degrades to empty on a non-OK response', async () => {
        fetchSpy.mockResolvedValue({
            ok: false,
            status: 429,
            json: async () => ({}),
        } as unknown as Response);

        await expect(
            new NaverNewsClient(resolveQuery).fetchNews(SYMBOL, '7d')
        ).resolves.toEqual([]);
    });

    it('degrades to empty on a network failure', async () => {
        fetchSpy.mockRejectedValue(new Error('network'));

        await expect(
            new NaverNewsClient(resolveQuery).fetchNews(SYMBOL, '7d')
        ).resolves.toEqual([]);
    });

    it('does not fabricate an earnings calendar', async () => {
        // 국내 실적 일정은 네이버 검색 API에 없다 — 추정 값을 채우면 잘못된 발표일이 박힌다.
        await expect(
            new NaverNewsClient(resolveQuery).fetchEarningsReport()
        ).resolves.toBeNull();
    });
});
