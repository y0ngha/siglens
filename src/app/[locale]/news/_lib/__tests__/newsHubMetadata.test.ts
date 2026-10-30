import { describe, expect, it } from 'vitest';
import {
    buildNewsHubMetadata,
    NEWS_HUB_OG_IMAGE_PATH,
    type NewsHubMetadataInput,
} from '@/app/[locale]/news/_lib/newsHubMetadata';
import { INDEXABLE_PAGE_ROBOTS } from '@/shared/test-utils/indexablePageRobots';

const BASE: NewsHubMetadataInput = {
    locale: 'en',
    path: '/news/us',
    title: 'US market news',
    description: 'Latest US market news.',
    keywords: ['키워드'],
    degraded: false,
    alternates: { canonical: 'https://siglens.io/en/news/us' },
};

describe('buildNewsHubMetadata', () => {
    it('이미지 경로를 로케일 URL로 바꿔 og·twitter에 싣는다', () => {
        const meta = buildNewsHubMetadata({
            ...BASE,
            imagePath: NEWS_HUB_OG_IMAGE_PATH,
        });

        expect(meta.openGraph?.images).toEqual([
            'https://siglens.io/en/news/opengraph-image',
        ]);
        expect(meta.twitter?.images).toEqual([
            'https://siglens.io/en/news/opengraph-image',
        ]);
    });

    it('기본 로케일 이미지 URL에는 접두사를 붙이지 않는다', () => {
        const meta = buildNewsHubMetadata({
            ...BASE,
            locale: 'ko',
            imagePath: NEWS_HUB_OG_IMAGE_PATH,
        });

        expect(meta.openGraph?.images).toEqual([
            'https://siglens.io/news/opengraph-image',
        ]);
    });

    it('이미지 경로가 없으면 og·twitter에 images 키를 내지 않는다', () => {
        const meta = buildNewsHubMetadata(BASE);

        expect(meta.openGraph).not.toHaveProperty('images');
        expect(meta.twitter).not.toHaveProperty('images');
    });

    it('og:url은 로케일별 URL이다', () => {
        expect(buildNewsHubMetadata(BASE).openGraph?.url).toBe(
            'https://siglens.io/en/news/us'
        );
    });

    it('소셜 카드 제목에는 로케일 브랜드를 붙이고 <title>에는 붙이지 않는다', () => {
        const meta = buildNewsHubMetadata(BASE);

        expect(meta.title).toBe('US market news');
        expect(meta.openGraph?.title).toBe('US market news | SIGLENS');
    });

    it('degraded면 noindex, follow다', () => {
        expect(
            buildNewsHubMetadata({ ...BASE, degraded: true }).robots
        ).toEqual({ index: false, follow: true });
    });

    it('정상이면 색인·미리보기 지시를 함께 낸다', () => {
        expect(
            buildNewsHubMetadata({ ...BASE, locale: 'ko' }).robots
        ).toMatchObject(INDEXABLE_PAGE_ROBOTS);
    });

    it('라우트가 넘긴 alternates를 그대로 쓴다', () => {
        expect(buildNewsHubMetadata(BASE).alternates).toEqual({
            canonical: 'https://siglens.io/en/news/us',
        });
    });
});
