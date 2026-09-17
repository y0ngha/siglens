import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/app/[locale]/news/_lib/categoryPreviews', () => ({
    fetchCategoryPreviews: vi.fn(async () => ['헤드라인 1']),
}));

import UsNewsHubPage, {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/news/us/page';
import { fetchCategoryPreviews } from '@/app/[locale]/news/_lib/categoryPreviews';
import { categoriesInRegion, CATEGORY_CONFIG } from '@/entities/market-news';

describe('/news/us hub', () => {
    beforeEach(() => {
        vi.mocked(fetchCategoryPreviews).mockClear();
    });

    it('caches for a day — the category structure rarely changes', () => {
        expect(revalidate).toBe(86400);
    });

    it('self-canonicals to /news/us', async () => {
        expect(
            (
                await generateMetadata({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            ).alternates?.canonical
        ).toBe('https://siglens.io/news/us');
    });

    it('inherits the legacy US news queries from the old /news hub', async () => {
        // 2026-08 리브랜딩 전 유입 질의를 잃지 않으려고 이쪽이 승계한다.
        const keywords = (
            await generateMetadata({
                params: Promise.resolve({ locale: 'ko' }),
            })
        ).keywords as string[];
        expect(keywords).toContain('미국 시장 뉴스');
        expect(keywords).toContain('미국 마켓 뉴스');
    });

    it('renders exactly the US categories, not the KR or crypto ones', async () => {
        render(
            await UsNewsHubPage({ params: Promise.resolve({ locale: 'ko' }) })
        );

        for (const cat of categoriesInRegion('us')) {
            expect(
                screen.getByRole('heading', {
                    name: CATEGORY_CONFIG[cat].koLabel,
                })
            ).toBeInTheDocument();
        }
        expect(
            screen.queryByRole('heading', { name: '한국 증시' })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: '암호화폐' })
        ).not.toBeInTheDocument();
    });

    it('links each card at its category page', async () => {
        render(
            await UsNewsHubPage({ params: Promise.resolve({ locale: 'ko' }) })
        );

        expect(screen.getByRole('link', { name: '미국 주식' })).toHaveAttribute(
            'href',
            '/news/stock'
        );
    });

    it('renders the region tab strip', async () => {
        render(
            await UsNewsHubPage({ params: Promise.resolve({ locale: 'ko' }) })
        );

        const nav = screen.getByRole('navigation', { name: '지역 선택' });
        expect(nav).toHaveTextContent('한국');
        expect(nav).toHaveTextContent('암호화폐');
    });

    it('places itself under the top hub in the breadcrumb', async () => {
        const { container } = render(
            await UsNewsHubPage({ params: Promise.resolve({ locale: 'ko' }) })
        );
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

        // `buildBreadcrumbJsonLd`가 사이트명을 맨 앞에 붙인다.
        const names = breadcrumb.itemListElement.map(
            (i: { name: string }) => i.name
        );
        expect(names.slice(-2)).toEqual(['시장 뉴스 허브', '미국 시장 뉴스']);
    });
});

/**
 * 가시 브레드크럼과 `BreadcrumbList` 마크업은 **같은 문자열**이어야 한다 —
 * 구글은 둘이 다르면 마크업을 무시하고, 그 어긋남은 화면에 표시가 나지 않는다.
 */
describe('/news/us 가시 브레드크럼', () => {
    it('BreadcrumbList와 같은 마디를 그린다', async () => {
        const { expectVisibleBreadcrumbMatchesJsonLdDom } =
            await import('@/__tests__/utils/expectVisibleBreadcrumb');
        const { koMessage } = await import('@/shared/test-utils/koMessage');

        const { container } = render(
            await UsNewsHubPage({ params: Promise.resolve({ locale: 'ko' }) })
        );

        expectVisibleBreadcrumbMatchesJsonLdDom(
            container,
            koMessage('shared.ui.Breadcrumb.46c31f')
        );
    });
});
