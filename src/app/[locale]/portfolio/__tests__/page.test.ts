/**
 * `/portfolio` 페이지 메타데이터 — noindex·로케일별 canonical. 세션 의존 영역은
 * `_components/__tests__/PortfolioMemberArea.test.tsx`가 본다.
 */

vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import { generateMetadata } from '@/app/[locale]/portfolio/page';

describe('Portfolio page', () => {
    it('exports metadata with the portfolio title', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.title).toBe('내 포트폴리오');
    });

    it('sets robots to noindex, nofollow', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false, follow: false })
        );
    });

    it('includes canonical URL', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/portfolio'
        );
    });
});
