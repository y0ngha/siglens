vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(async () => (key: string) => `t:${key}`),
}));

import { buildMethodologyMetadata } from '@/app/[locale]/methodology/_lib/methodologyMetadata';

const metadataFor = (locale: string) =>
    buildMethodologyMetadata(Promise.resolve({ locale }));

describe('/methodology 메타데이터', () => {
    it('타이틀은 레이아웃 템플릿을 타지 않는 absolute 값이다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.title).toEqual({ absolute: 't:methodology.metaTitle' });
    });

    it('색인 대상 로케일(ko)은 index를 허용한다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.robots).toMatchObject({ index: true });
    });

    it('색인 게이트 밖 로케일(en)은 noindex다', async () => {
        const metadata = await metadataFor('en');
        expect(metadata.robots).toMatchObject({ index: false });
    });

    it('og:url은 ko는 접두사 없이, en은 /en 접두사로 나간다', async () => {
        const ko = await metadataFor('ko');
        const en = await metadataFor('en');
        expect(ko.openGraph?.url).toBe('https://siglens.io/methodology');
        expect(en.openGraph?.url).toBe('https://siglens.io/en/methodology');
    });

    it('openGraph type은 article이다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.openGraph).toMatchObject({ type: 'article' });
    });

    it('OG 이미지는 정적 /og-image.png다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.openGraph?.images).toEqual([
            expect.objectContaining({ url: '/og-image.png' }),
        ]);
    });
});
