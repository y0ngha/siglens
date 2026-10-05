// @vitest-environment jsdom
/**
 * `/symbols`는 **링크를 내보내는 것**이 유일한 목적인 페이지다. 그래서 렌더 테스트도
 * 링크 집합을 본다: 목록의 모든 심볼이 실제 `<a href="/{symbol}">`로 나가는지,
 * 로케일별 색인 지시가 다른 정적 페이지와 같은지.
 */
// 이름 조회는 DB를 탄다 — 이 파일의 관심사는 링크 집합과 표기 형태라 고정 맵으로 막는다.
vi.mock('@/app/[locale]/symbols/loadSymbolNames', () => ({
    loadSymbolNames: (symbols: readonly string[], locale: string) =>
        Promise.resolve(
            new Map(
                symbols
                    .slice(0, 2)
                    .map(s => [s, locale === 'ko' ? `한글:${s}` : `Name:${s}`])
            )
        ),
}));

vi.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: ({ data }: { data: Record<string, unknown> }) => {
        jsonLdSpy(data);
        return null;
    },
}));

const jsonLdSpy = vi.fn();

vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfDatabaseMissingAtBuild: vi.fn(async () => undefined),
}));

import { shortenRevalidateIfDatabaseMissingAtBuild } from '@/shared/cache/buildDegradedRevalidate';
import { renderToStaticMarkup } from 'react-dom/server';
import SymbolsDirectoryPage, {
    generateMetadata,
} from '@/app/[locale]/symbols/page';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { buildSymbolDirectory } from '@/shared/lib/symbolDirectory';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { SITE_URL } from '@/shared/lib/seo';

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

    // 배포 빌드에는 DB가 없어 종목 이름이 빈 채로 구워진다 — 60초 revalidate 배선.
    // DB 판정 자체는 헬퍼 테스트가 고정하므로 여기서는 호출 여부만 본다.
    it('빌드타임 DB 부재 degrade revalidate 헬퍼를 부른다', async () => {
        vi.mocked(shortenRevalidateIfDatabaseMissingAtBuild).mockClear();

        await renderPage('ko');

        expect(shortenRevalidateIfDatabaseMissingAtBuild).toHaveBeenCalled();
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

    it('이름을 아는 종목은 `자산명 (티커)`로, 로케일에 맞는 이름으로 찍는다', async () => {
        const ko = await renderPage('ko');
        const en = await renderPage('en');

        const first = POPULAR_TICKERS[0];
        expect(ko).toContain(`한글:${first} (${first})`);
        expect(en).toContain(`Name:${first} (${first})`);
        // 이름을 못 받은 종목은 티커만 — 링크는 그대로 남는다.
        expect(ko).toContain(`>${POPULAR_TICKERS[5]}<`);
    });

    /**
     * 모바일은 두 칸이라 긴 한글 이름이 말줄임으로 잘리면 어느 종목인지 알 수 없다.
     * 줄바꿈(`break-keep wrap-break-word`)이 기본이고 `truncate`는 `sm` 이상에서만 건다.
     */
    it('종목 링크는 모바일에서 줄바꿈하고 sm 이상에서만 말줄임한다', async () => {
        const html = await renderPage('ko');

        const classOfLink = html.match(
            /<a[^>]*href="\/AAPL"[^>]*class="([^"]*)"|<a[^>]*class="([^"]*)"[^>]*href="\/AAPL"/
        );
        const className = classOfLink?.[1] ?? classOfLink?.[2] ?? '';
        expect(className).toContain('break-keep');
        expect(className).toContain('wrap-break-word');
        expect(className).toContain('sm:truncate');
        expect(className.split(/\s+/)).not.toContain('truncate');
    });

    it('h1은 하나고 자산군 섹션마다 h2가 붙는다', async () => {
        const html = await renderPage('ko');

        expect([...html.matchAll(/<h1\b/g)]).toHaveLength(1);
        expect([...html.matchAll(/<h2\b/g)]).toHaveLength(
            buildSymbolDirectory(new Map(), 'ko-KR').length
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

    /**
     * 이미지를 안 주면 공유 카드가 텅 빈 채로 나간다 — 배포 직후 실측에서 이 라우트만
     * `og:image`가 없었다. 종목별 동적 OG를 만들 근거가 없어 정적 자산을 쓴다.
     */
    it('OG·트위터 카드 이미지를 싣는다', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });

        expect(meta.openGraph?.images).toEqual([
            expect.objectContaining({ url: '/og-image.png' }),
        ]);
        expect(meta.twitter?.images).toEqual(['/og-image.png']);
    });

    /**
     * `og:url`은 canonical과 같은 로케일별 URL이어야 한다 — 전 로케일이 ko URL을
     * 가리키면 `/en/symbols` 공유 카드가 한국어 페이지로 연결된다.
     */
    it.each([
        ['ko', `${SITE_URL}/symbols`],
        ['en', `${SITE_URL}/en/symbols`],
        ['ja', `${SITE_URL}/ja/symbols`],
        ['zh', `${SITE_URL}/zh/symbols`],
    ])('og:url이 %s 로케일의 canonical과 같다', async (locale, expected) => {
        const meta = await generateMetadata({
            params: Promise.resolve({ locale }),
        });

        expect(meta.openGraph?.url).toBe(expected);
        expect(meta.alternates?.canonical).toBe(expected);
    });

    it('제목·설명이 "전체/모든 종목"이라고 주장하지 않는다 — 상장 종목 전체가 아니다', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });

        const claim = `${String(meta.title)} ${String(meta.description)}`;
        expect(claim).not.toMatch(/전체 종목|모든 종목|분석 가능한/);
    });
});
