vi.mock('@/widgets/legal/PolicyMarkdownBody', () => ({
    PolicyMarkdownBody: () => null,
}));
vi.mock('@/widgets/legal/LegalPageShell', () => ({
    LegalPageShell: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/lib/legal', () => ({
    formatKoreanDate: vi.fn().mockReturnValue('2025년 1월 1일'),
    INVESTMENT_DISCLAIMER: 'disclaimer text',
    TERMS_DESCRIPTION: 'terms desc',
    TERMS_FULL_TITLE: 'Terms Full Title',
    TERMS_PATH: '/terms',
    TERMS_TITLE: '이용약관',
}));
vi.mock('@/shared/lib/legal-toc', () => ({
    extractToc: vi.fn().mockReturnValue([]),
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
vi.mock('@/shared/lib/seo', () => ({
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

import { metadata } from '@/app/terms/page';

describe('Terms page', () => {
    it('exports metadata with terms title', () => {
        expect(metadata.title).toBe('이용약관');
    });

    it('allows indexing', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: true })
        );
    });

    it('includes canonical URL', () => {
        expect(metadata.alternates?.canonical).toBe('https://siglens.io/terms');
    });

    it('sets openGraph type to article', () => {
        expect(metadata.openGraph).toEqual(
            expect.objectContaining({ type: 'article' })
        );
    });

    it('sets twitter card to summary', () => {
        expect(metadata.twitter).toEqual(
            expect.objectContaining({ card: 'summary' })
        );
    });
});
