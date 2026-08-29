import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// staticSymbolCache: return a few headlines per category so CategoryCards render previews.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn().mockResolvedValue([
        {
            id: 'r1',
            symbol: '__NEWS_GENERAL__',
            source: 'Reuters',
            url: 'https://example.com/news1',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'Markets rally on Fed comments',
            titleKo: '연준 발언에 시장 랠리',
            bodyEn: null,
            bodyKo: null,
            summaryKo: null,
            sentiment: null,
            category: null,
            priceImpact: null,
            tickers: [],
            analyzedAt: null,
        },
    ]),
}));

vi.mock('@/entities/market-news/api', () => ({
    getMarketNewsCards: vi.fn().mockResolvedValue([]),
}));

import NewsHubPage, { generateMetadata } from '../page';

describe('/news hub page는', () => {
    it('5개 카테고리 딥링크를 SSR 렌더한다', async () => {
        render(
            await NewsHubPage({ params: Promise.resolve({ locale: 'ko' }) })
        );

        const allLinks = screen.getAllByRole('link');
        const hrefs = allLinks.map(l => l.getAttribute('href'));

        // Each CategoryCard renders <a href="/news/{slug}"> as a deep link
        for (const slug of [
            'general',
            'stock',
            'crypto',
            'forex',
            'articles',
        ]) {
            expect(hrefs).toContain(`/news/${slug}`);
        }
    });
});

describe('/news hub page generateMetadata는', () => {
    it('canonical = /news 를 설정한다', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(meta.alternates?.canonical).toBe('https://siglens.io/news');
    });

    it('title이 3지역 커버리지를 밝힌다', async () => {
        // 2026-08: 이 페이지는 미국 허브에서 3지역 상위 허브로 승격됐다.
        // 미국 카테고리 목록과 미국 질의 키워드는 `/news/us`가 승계한다.
        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(String(meta.title)).toContain('미국');
        expect(String(meta.title)).toContain('한국');
        expect(String(meta.title)).toContain('암호화폐');
    });
});

describe('/news hub page JSON-LD는', () => {
    it('WebPage JSON-LD 스크립트를 렌더한다', async () => {
        const { container } = render(
            await NewsHubPage({ params: Promise.resolve({ locale: 'ko' }) })
        );
        const scripts = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        );
        const webPageScript = scripts.find(s => {
            try {
                return JSON.parse(s.textContent ?? '')['@type'] === 'WebPage';
            } catch {
                return false;
            }
        });
        expect(webPageScript).toBeDefined();
    });

    it('BreadcrumbList JSON-LD 스크립트를 렌더한다', async () => {
        const { container } = render(
            await NewsHubPage({ params: Promise.resolve({ locale: 'ko' }) })
        );
        const scripts = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        );
        const breadcrumbScript = scripts.find(s => {
            try {
                return (
                    JSON.parse(s.textContent ?? '')['@type'] ===
                    'BreadcrumbList'
                );
            } catch {
                return false;
            }
        });
        expect(breadcrumbScript).toBeDefined();
    });

    it('h1·breadcrumb·title이 같은 이름을 쓴다', async () => {
        // 허브 이름이 다섯 군데(NEWS_HUB_TITLE, h1, breadcrumb, OG 본문, OG alt)에
        // 손으로 중복돼 있다. 메타 title만 고정하면 탭 제목과 화면 제목이 서로
        // 다른 어휘로 갈라져도 아무도 모른다 — 실제로 이 리네임이 다섯 군데를
        // 전부 손으로 고쳐야 했다.
        const { container } = render(
            await NewsHubPage({ params: Promise.resolve({ locale: 'ko' }) })
        );
        const h1 = container.querySelector('h1')?.textContent?.trim();
        expect(h1).toBe('시장 뉴스 허브');

        const breadcrumb = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        )
            .map(s => {
                try {
                    return JSON.parse(s.textContent ?? '');
                } catch {
                    return null;
                }
            })
            .find(d => d?.['@type'] === 'BreadcrumbList');
        const last = breadcrumb.itemListElement.at(-1).name;
        expect(last).toBe(h1);
        expect(
            String(
                (
                    await generateMetadata({
                        params: Promise.resolve({ locale: 'ko' }),
                    })
                ).title
            )
        ).toContain(h1);
    });
});
