vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(async () => (key: string) => `t:${key}`),
}));

import { buildBacktestingMetadata } from '@/app/[locale]/backtesting/_lib/backtestingMetadata';

const metadataFor = (locale: string) =>
    buildBacktestingMetadata(Promise.resolve({ locale }));

describe('/backtesting 메타데이터', () => {
    it('타이틀은 브랜드가 붙은 absolute 값이다', async () => {
        const metadata = await metadataFor('en');
        expect(metadata.title).toEqual({
            absolute: 't:backtesting.title | SIGLENS',
        });
    });

    it('robots는 선언하지 않고 로케일 레이아웃 값을 상속한다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata).not.toHaveProperty('robots');
    });

    it('og:url은 en에서 /en 접두사 URL이다', async () => {
        const metadata = await metadataFor('en');
        expect(metadata.openGraph?.url).toBe(
            'https://siglens.io/en/backtesting'
        );
    });

    it('OG 이미지 alt는 backtestingOgAlt 키로 만든다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.openGraph?.images).toEqual([
            expect.objectContaining({
                url: '/og-image.png',
                alt: 't:backtestingOgAlt',
            }),
        ]);
    });

    it('twitter 카드는 summary_large_image다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.twitter).toMatchObject({
            card: 'summary_large_image',
        });
    });
});
