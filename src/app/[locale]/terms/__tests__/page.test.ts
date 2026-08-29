vi.mock('@/widgets/legal/PolicyMarkdownBody', () => ({
    PolicyMarkdownBody: () => null,
}));
vi.mock('@/widgets/legal/LegalPageShell', () => ({
    LegalPageShell: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/lib/legal', () => ({
    formatKoreanDate: vi.fn().mockReturnValue('2025년 1월 1일'),
    INVESTMENT_DISCLAIMER_KEY: 'investmentDisclaimer',
    termsDescription: () => 'terms desc',
    termsFullTitle: () => 'Terms Full Title',
    TERMS_PATH: '/terms',
    termsTitle: () => '이용약관',
}));
vi.mock('@/shared/lib/legal-toc', () => ({
    extractToc: vi.fn().mockReturnValue([]),
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
/**
 * **부분 목이다.** 통째로 갈아끼우면 이 모듈에 export가 하나 생길 때마다
 * `No "x" export is defined on the mock`으로 깨지고, 더 나쁘게는 URL을 만드는
 * 로직이 스텁으로 대체돼 테스트가 아무것도 검증하지 못한다.
 */
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/entities/terms', () => ({
    DrizzleTermsRepository: vi.fn().mockImplementation(() => ({
        findActive: vi.fn().mockResolvedValue(null),
    })),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

import { generateMetadata } from '@/app/[locale]/terms/page';

const metadataFor = (locale = 'ko') =>
    generateMetadata({ params: Promise.resolve({ locale }) });

describe('Terms page', () => {
    it('exports metadata with terms title', async () => {
        const metadata = await metadataFor();
        expect(metadata.title).toBe('이용약관');
    });

    it('allows indexing', async () => {
        const metadata = await metadataFor();
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: true })
        );
    });

    it('includes canonical URL', async () => {
        const metadata = await metadataFor();
        expect(metadata.alternates?.canonical).toBe('https://siglens.io/terms');
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
});
