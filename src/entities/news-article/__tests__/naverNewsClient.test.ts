import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NaverNewsClient, stripNaverMarkup } from '../lib/naverNewsClient';
import { hashUrlToId } from '../lib/fmpNewsClient';

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
            source: 'Naver News',
            url: 'https://news.example.com/article/1',
            titleEn: '삼성전자, 3분기 영업이익 발표',
            bodyEn: '삼성전자가 "호실적"을 기록했다고 발표했다.',
        });
        // pubDate에 +0900 오프셋이 있으므로 UTC 변환이 정확해야 한다.
        expect(items[0]!.publishedAt).toBe('2026-08-14T06:30:00.000Z');
        // `id`는 news 테이블의 upsert 충돌 키다. URL이 아닌 걸 해싱하면 한 심볼의
        // 기사 전체가 한 행으로 붕괴한다(또는 ON CONFLICT가 같은 행을 두 번 건드려
        // INSERT가 통째로 실패한다).
        expect(items[0]!.id).toBe(
            hashUrlToId('https://news.example.com/article/1')
        );
    });

    it('기사마다 서로 다른 id를 만든다', async () => {
        fetchSpy.mockResolvedValue(
            mockNaverResponse([
                naverItem(),
                naverItem({
                    originallink: 'https://news.example.com/article/2',
                    link: 'https://n.news.naver.com/article/2',
                }),
            ])
        );

        const items = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(items).toHaveLength(2);
        expect(items[0]!.id).not.toBe(items[1]!.id);
    });

    it('sends the Korean company name as the query, not the ticker', async () => {
        // 종목코드로 검색하면 국내 기사가 거의 잡히지 않는다.
        fetchSpy.mockResolvedValue(mockNaverResponse([]));

        await new NaverNewsClient(resolveQuery).fetchNews(SYMBOL, '24h');

        const url = String(fetchSpy.mock.calls[0]![0]);
        expect(url).toContain(`query=${encodeURIComponent(KOREAN_NAME)}`);
        expect(url).not.toContain('005930');
        // 정확도순이어야 한다 — 최신순은 종목명이 스쳐 지나가는 정치·연예 기사를
        // 상위에 올린다(실측: 제목 매치율 date 15~23% vs sim 90~98%).
        expect(url).toContain('sort=sim');
    });

    it('authenticates with the API HUB gateway headers', async () => {
        // 구 개발자센터의 `X-Naver-Client-*`로는 401이 떨어진다(2026-08-17 실측).
        // 검색 API가 NAVER API HUB로 이관되면서 NCP API Gateway 규약을 쓴다.
        fetchSpy.mockResolvedValue(mockNaverResponse([]));

        await new NaverNewsClient(resolveQuery).fetchNews(SYMBOL, '24h');

        expect(fetchSpy.mock.calls[0]![1]).toMatchObject({
            headers: {
                'X-NCP-APIGW-API-KEY-ID': 'test-id',
                'X-NCP-APIGW-API-KEY': 'test-secret',
            },
        });
    });

    it('calls the API HUB endpoint, not the retired developer-center one', async () => {
        // 구 도메인은 2026-07-31부로 신규 신청이 막혔다 — 새 키로는 호출 자체가 안 된다.
        fetchSpy.mockResolvedValue(mockNaverResponse([]));

        await new NaverNewsClient(resolveQuery).fetchNews(SYMBOL, '24h');

        const url = String(fetchSpy.mock.calls[0]![0]);
        expect(url).toContain('naverapihub.apigw.ntruss.com/search/v1/news');
        expect(url).not.toContain('openapi.naver.com');
    });

    it('marks articles as Korean so the prompt skips translation', async () => {
        // core는 `sourceLanguage`가 없으면 영문으로 간주해 "한국어로 번역하라"고
        // 지시한다 — 한국어 기사에는 토큰 낭비이고, 모델이 이미 정확한 제목을
        // 고쳐 쓸 여지를 준다.
        fetchSpy.mockResolvedValue(mockNaverResponse([naverItem()]));

        const [item] = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(item!.sourceLanguage).toBe('ko');
    });

    it('flags the body as truncated — description is a ~120-char slice', async () => {
        // 네이버 `description`은 AI 요약이 아니라 본문 앞부분을 기계적으로 자른 것이다
        // (실측 117~130자, 항상 `…`으로 끝남). 표시가 없으면 core 프롬프트가 이를
        // 온전한 본문으로 읽고 없는 수치를 요구받는다.
        fetchSpy.mockResolvedValue(
            mockNaverResponse([
                naverItem({
                    description:
                        '삼성전자가 반도체 부문 회복에 힘입어 시장 예상을 웃도는 실적을 냈다. 3분기 영업이익은...',
                }),
            ])
        );

        const [item] = await new NaverNewsClient(resolveQuery).fetchNews(
            SYMBOL,
            '7d'
        );

        expect(item!.bodyTruncated).toBe(true);
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
