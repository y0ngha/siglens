// @vitest-environment jsdom
/**
 * `/symbols`는 **링크를 내보내는 것**이 유일한 목적인 페이지다. 그래서 렌더 테스트도
 * 링크 집합을 본다: 목록의 모든 심볼이 실제 `<a href="/{symbol}">`로 나가는지,
 * 로케일별 색인 지시가 다른 정적 페이지와 같은지.
 */
vi.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: ({ data }: { data: Record<string, unknown> }) => {
        jsonLdSpy(data);
        return null;
    },
}));

const jsonLdSpy = vi.fn();

import { renderToStaticMarkup } from 'react-dom/server';
import SymbolsDirectoryPage, {
    generateMetadata,
} from '@/app/[locale]/symbols/page';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { buildSymbolDirectory } from '@/shared/lib/symbolDirectory';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';

async function renderPage(locale: string): Promise<string> {
    return renderToStaticMarkup(
        <IntlTestProvider>
            {await SymbolsDirectoryPage({
                params: Promise.resolve({ locale }),
            })}
        </IntlTestProvider>
    );
}

describe('/symbols 디렉터리 페이지', () => {
    beforeEach(() => {
        jsonLdSpy.mockClear();
    });

    it('sitemap 소스의 모든 심볼을 루트 URL로 링크한다', async () => {
        const html = await renderPage('ko');

        const hrefs = new Set(
            [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1])
        );
        const missing = [...POPULAR_TICKERS, ...POPULAR_CRYPTOS].filter(
            symbol => !hrefs.has(`/${symbol}`)
        );

        expect(missing).toEqual([]);
    });

    /**
     * 탭 URL은 싣지 않는다 — 416 × 7이면 2,900개 링크가 되고, 탭은 종목 페이지의
     * 탭 내비에서 이미 한 클릭이다. 링크 예산을 종목 루트에 몰아준다.
     */
    it('종목 탭 URL은 링크하지 않는다', async () => {
        const html = await renderPage('ko');

        expect(html).not.toContain('/AAPL/overall');
        expect(html).not.toContain('/AAPL/news');
    });

    it('ko에서는 한글명을 함께 보여주고, en에서는 심볼만 남긴다', async () => {
        const ko = await renderPage('ko');
        const en = await renderPage('en');

        expect(ko).toContain('애플');
        expect(en).not.toContain('애플');
        expect(en).toContain('>AAPL<');
    });

    it('h1은 하나고 자산군 섹션마다 h2가 붙는다', async () => {
        const html = await renderPage('ko');

        expect([...html.matchAll(/<h1\b/g)]).toHaveLength(1);
        expect([...html.matchAll(/<h2\b/g)]).toHaveLength(
            buildSymbolDirectory().length
        );
    });

    /**
     * `ItemList`를 싣지 않는 것은 의도다(416항목이면 JSON-LD만 50KB 가까이 늘어난다).
     * 크롤러가 이 페이지에서 얻어야 하는 것은 `<a>`이고 그건 위 테스트가 본다.
     */
    it('WebPage·BreadcrumbList만 싣고 ItemList는 싣지 않는다', async () => {
        await renderPage('ko');

        const types = jsonLdSpy.mock.calls.map(([data]) => data['@type']);
        expect(types).toContain('BreadcrumbList');
        expect(types).not.toContain('ItemList');
    });

    it('ko는 색인 대상, 나머지 로케일은 noindex — 다른 정적 페이지와 같은 규칙', async () => {
        const ko = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        const ja = await generateMetadata({
            params: Promise.resolve({ locale: 'ja' }),
        });

        expect(ko.robots).toMatchObject({ index: true });
        expect(ja.robots).toMatchObject({ index: false });
    });

    it('제목·설명이 "전체/모든 종목"이라고 주장하지 않는다 — 상장 종목 전체가 아니다', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });

        const claim = `${String(meta.title)} ${String(meta.description)}`;
        expect(claim).not.toMatch(/전체 종목|모든 종목/);
    });
});
