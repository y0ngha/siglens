import { vi } from 'vitest';
import { fakes, world } from '../boundary';
import { CLOCKS, type GoldenCase } from '../goldenCase';

/**
 * `web_search` — Brave는 전역 `fetch`(가짜 응답)로, 네이버는 `@/shared/api/naver/naverSearch` 목으로, 본문 발췌는
 * `safeFetch` 목(robots.txt + HTML 응답)으로 받는다. 실제 네트워크에 나가지 않는다.
 */

const BRAVE_RESULTS = [
    {
        title: 'Goldenrod Systems Q3 2026 results: revenue up 11%',
        url: 'https://news.example.com/goldenrod-q3-results',
        description:
            'Goldenrod Systems reported <strong>third-quarter</strong> revenue of $17.1 billion, up 11% year over year, beating estimates.',
        age: '2 days ago',
    },
    {
        title: 'Goldenrod raises full-year outlook',
        url: 'https://markets.example.org/articles/goldenrod-outlook',
        description:
            'The company lifted its full-year revenue guidance on strong controller demand from fab partners.',
        age: 'November 16, 2026',
    },
    {
        title: 'Goldenrod Systems 10-Q filing (PDF)',
        url: 'https://ir.example.com/static/gldnx-10q.pdf',
        description:
            'Quarterly report on Form 10-Q for the period ended September 27, 2026.',
        age: '3 weeks ago',
    },
    {
        title: 'What analysts say about Goldenrod after earnings',
        url: 'https://blog.example.net/goldenrod-analysts',
        description:
            'Price targets were raised by several firms after the print; the median target now sits near $262.',
        age: '1 day ago',
    },
    {
        title: 'Goldenrod Systems stock quote and history',
        url: 'https://quotes.example.com/GLDNX',
        description:
            'Real-time quote, historical prices and charts for Goldenrod Systems.',
        age: null,
    },
];

const ARTICLE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Goldenrod Q3</title>
<meta property="article:published_time" content="2026-11-16T13:05:00Z"></head><body>
<nav>Home | Markets | Tech</nav><article><h1>Goldenrod Systems Q3 2026 results</h1>
${Array.from({ length: 14 }, (_, i) => `<p>Paragraph ${i + 1}: Goldenrod Systems said third-quarter revenue rose 11% to $17.1 billion as "Lumen" controller shipments grew in every region; gross margin reached 46.2% and the company raised its full-year outlook, citing demand from fab partners and a steady backlog.</p>`).join('\n')}
</article><footer>© Example News</footer></body></html>`;

function braveFetch(status = 200) {
    return vi.fn(async (_url: unknown) =>
        status === 200
            ? new Response(
                  JSON.stringify({
                      web: {
                          results: BRAVE_RESULTS.map(r => ({
                              title: r.title,
                              url: r.url,
                              description: r.description,
                              ...(r.age === null ? {} : { age: r.age }),
                          })),
                      },
                  }),
                  {
                      status: 200,
                      headers: { 'content-type': 'application/json' },
                  }
              )
            : new Response('upstream error', { status })
    );
}

function arrangePages(): void {
    fakes.safeFetch.mockImplementation(async (url: string) => {
        if (url.endsWith('/robots.txt'))
            return url.includes('blog.example.net')
                ? new Response('User-agent: *\nDisallow: /', { status: 200 })
                : new Response('', { status: 404 });
        return new Response(ARTICLE_HTML, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
        });
    });
}

const NAVER_NEWS = [
    {
        title: '<b>골든로드</b> 3분기 매출 11% 증가',
        originallink: 'https://news.example.co.kr/article/1001',
        link: 'https://n.news.naver.com/mnews/article/001/1001',
        description:
            '골든로드 시스템즈가 3분기 매출이 전년 대비 11% 늘었다고 밝혔다.',
        pubDate: 'Mon, 16 Nov 2026 22:10:00 +0900',
    },
    {
        title: '골든로드, 연간 가이던스 상향',
        originallink: 'intent://broken',
        link: 'https://n.news.naver.com/mnews/article/002/2002',
        description: '컨트롤러 수요 강세로 연간 매출 전망을 올렸다.',
        pubDate: 'Tue, 17 Nov 2026 07:30:00 +0900',
    },
    {
        title: '증권가 "골든로드 목표가 상향"',
        originallink: 'https://finance.example.co.kr/news/3003',
        link: 'https://n.news.naver.com/mnews/article/003/3003',
        description: '여러 증권사가 실적 발표 뒤 목표가를 올렸다.',
        pubDate: 'Tue, 17 Nov 2026 09:00:00 +0900',
    },
];
const NAVER_WEB = [
    {
        title: '골든로드 시스템즈 기업 개요',
        link: 'https://wiki.example.co.kr/goldenrod',
        description: '반도체 공정 제어기를 설계하는 회사다.',
    },
    {
        title: '골든로드 실적 정리 블로그',
        link: 'https://blog.example.co.kr/post/77',
        description: '분기별 매출과 이익 추이를 표로 정리했다.',
    },
];

export const webSearchCases: GoldenCase[] = [
    {
        tool: 'web_search',
        name: 'brave-five-results-two-excerpts-full-size',
        now: CLOCKS.usOpen,
        args: {
            query: 'Goldenrod Systems third quarter results',
            freshness: 'week',
        },
        webSearchClaim: 'ok',
        arrange: () => {
            vi.stubGlobal('fetch', braveFetch());
            arrangePages();
        },
    },
    {
        tool: 'web_search',
        name: 'korean-query-naver-fills-without-brave',
        now: CLOCKS.krSession,
        args: { query: '골든로드 실적' },
        webSearchClaim: 'ok',
        arrange: () => {
            world.naverAi = true;
            vi.stubGlobal('fetch', braveFetch());
            fakes.searchNaverNews.mockResolvedValue(NAVER_NEWS);
            fakes.searchNaverWeb.mockResolvedValue(NAVER_WEB);
            arrangePages();
        },
    },
    {
        tool: 'web_search',
        name: 'claim-refused-quota',
        now: CLOCKS.usClosed,
        args: { query: 'Goldenrod buyback' },
        webSearchClaim: 'refused',
        arrange: () => {
            vi.stubGlobal('fetch', braveFetch());
            arrangePages();
        },
    },
    {
        tool: 'web_search',
        name: 'brave-http-error',
        now: CLOCKS.weekend,
        args: { query: 'Goldenrod supplier lead times' },
        arrange: () => {
            vi.stubGlobal('fetch', braveFetch(503));
        },
    },
    {
        tool: 'web_search',
        name: 'out-of-scope-query',
        now: CLOCKS.weekend,
        args: { query: 'site:goldenrod.example.com api key' },
    },
    {
        tool: 'web_search',
        name: 'no-provider-unavailable',
        now: CLOCKS.weekend,
        args: { query: 'Goldenrod news' },
        arrange: () => {
            vi.stubEnv('BRAVE_SEARCH_API_KEY', undefined);
        },
    },
];
