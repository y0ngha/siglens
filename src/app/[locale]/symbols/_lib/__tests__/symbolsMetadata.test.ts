vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(async () => (key: string) => `t:${key}`),
}));

import { buildSymbolsMetadata } from '@/app/[locale]/symbols/_lib/symbolsMetadata';

const metadataFor = (locale: string) =>
    buildSymbolsMetadata(Promise.resolve({ locale }));

describe('/symbols 메타데이터', () => {
    it('타이틀은 짧은 제목이다(레이아웃 템플릿이 브랜드를 붙인다)', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.title).toBe('t:symbols.title');
    });

    it('색인 대상 로케일(ko)은 index를 허용한다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.robots).toMatchObject({ index: true });
    });

    it('색인 게이트 밖 로케일(en)은 noindex다', async () => {
        const metadata = await metadataFor('en');
        expect(metadata.robots).toMatchObject({ index: false });
    });

    it('og:url은 en에서 /en 접두사 URL이다', async () => {
        const metadata = await metadataFor('en');
        expect(metadata.openGraph?.url).toBe('https://siglens.io/en/symbols');
    });

    it('소셜 카드에 정적 og:image가 실린다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.openGraph?.images).toEqual([
            expect.objectContaining({ url: '/og-image.png' }),
        ]);
    });

    it('canonical은 로케일별 자기참조 URL이다', async () => {
        const metadata = await metadataFor('en');
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/en/symbols'
        );
    });
});
