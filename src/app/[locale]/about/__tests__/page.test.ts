vi.mock('@/widgets/legal/PolicyMarkdownBody', () => ({
    PolicyMarkdownBody: () => null,
}));
vi.mock('@/widgets/legal/LegalPageShell', () => ({
    LegalPageShell: () => null,
}));
vi.mock('@/shared/lib/legal-toc', () => ({
    extractToc: vi.fn().mockReturnValue([]),
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
/**
 * 부분 목이다(terms 스위트와 같은 이유) — `SITE_OPERATOR`/`ABOUT_PATH`/
 * `ABOUT_UPDATED_AT`는 실제 값을 유지해 JSON-LD `@id`/`sameAs`가 실제 배선과
 * 일치하는지 검증하고, title/description/formatKoreanDate만 결정적 스텁으로
 * 바꾼다.
 */
vi.mock('@/shared/lib/legal', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/legal')>()),
    aboutTitle: () => 'Siglens 소개',
    aboutFullTitle: () => 'Siglens 소개 Full Title',
    aboutDescription: () => 'about desc',
    formatKoreanDate: vi.fn().mockReturnValue('2026년 9월 11일'),
}));
/**
 * **부분 목이다.** 통째로 갈아끼우면 이 모듈에 export가 하나 생길 때마다
 * `No "x" export is defined on the mock`으로 깨지고, 더 나쁘게는 URL을 만드는
 * 로직이 스텁으로 대체돼 테스트가 아무것도 검증하지 못한다.
 */
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
    }),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import {
    generateMetadata,
    default as AboutPage,
} from '@/app/[locale]/about/page';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';

const metadataFor = (locale = 'ko') =>
    generateMetadata({ params: Promise.resolve({ locale }) });

describe('About page', () => {
    it('exports metadata with about title', async () => {
        const metadata = await metadataFor();
        expect(metadata.title).toBe('Siglens 소개');
    });

    it('allows indexing', async () => {
        const metadata = await metadataFor();
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: true })
        );
    });

    it('includes canonical URL', async () => {
        const metadata = await metadataFor();
        expect(metadata.alternates?.canonical).toBe('https://siglens.io/about');
    });

    it('sets openGraph type to article', async () => {
        const metadata = await metadataFor();
        expect(metadata.openGraph).toEqual(
            expect.objectContaining({ type: 'article' })
        );
    });

    it('sets twitter card to summary', async () => {
        const metadata = await metadataFor();
        expect(metadata.twitter).toEqual(
            expect.objectContaining({ card: 'summary' })
        );
    });

    it('renders AboutPage and Person JSON-LD nodes for ko, cross-linked to the home Organization', async () => {
        const tree = await AboutPage({
            params: Promise.resolve({ locale: 'ko' }),
        });
        const nodes = collectJsonLdData(tree);

        const aboutPage = nodes.find(n => n['@type'] === 'AboutPage');
        expect(aboutPage).toBeDefined();
        expect(aboutPage?.mainEntity).toEqual({
            '@id': 'https://siglens.io#organization',
        });

        const person = nodes.find(n => n['@type'] === 'Person');
        expect(person).toBeDefined();
        expect(person?.name).toBe('신용하');
        expect(person?.['@id']).toBe('https://siglens.io/about#person');
        expect(person?.email).toBe('mailto:dev.y0ngha@gmail.com');
        expect(person?.sameAs).toEqual(['https://github.com/y0ngha']);
        expect(person?.affiliation).toEqual({
            '@id': 'https://siglens.io#organization',
        });
    });
});
