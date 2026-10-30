import { describe, expect, it } from 'vitest';
import { buildHomeJsonLdNodes } from '@/app/[locale]/(home)/_lib/homeJsonLdNodes';

const INPUT = { title: '홈 제목', description: '홈 설명' } as const;

describe('buildHomeJsonLdNodes', () => {
    it('ko WebApplication은 접두사 없는 루트 @id·url과 inLanguage ko를 쓴다', () => {
        const { webApplication } = buildHomeJsonLdNodes({
            ...INPUT,
            locale: 'ko',
        });

        expect(webApplication).toMatchObject({
            '@type': 'WebApplication',
            '@id': 'https://siglens.io#webapplication',
            url: 'https://siglens.io',
            inLanguage: 'ko',
            description: '홈 설명',
        });
    });

    it('en WebApplication은 /en 접두사 @id와 inLanguage en을 쓴다', () => {
        const { webApplication } = buildHomeJsonLdNodes({
            ...INPUT,
            locale: 'en',
        });

        expect(webApplication).toMatchObject({
            '@id': 'https://siglens.io/en#webapplication',
            url: 'https://siglens.io/en',
            inLanguage: 'en',
        });
    });

    it('WebPage는 제목을 name으로 쓰고 WebApplication·Organization을 @id로 가리킨다', () => {
        const { webPage } = buildHomeJsonLdNodes({ ...INPUT, locale: 'en' });

        expect(webPage).toMatchObject({
            '@type': 'WebPage',
            name: '홈 제목',
            mainEntity: { '@id': 'https://siglens.io/en#webapplication' },
            publisher: { '@id': 'https://siglens.io#organization' },
        });
    });

    it('Organization은 같은 @id에 한글 표기·로고·운영자 노드를 싣는다', () => {
        const { organization } = buildHomeJsonLdNodes({
            ...INPUT,
            locale: 'ko',
        });

        expect(organization).toMatchObject({
            '@type': 'Organization',
            '@id': 'https://siglens.io#organization',
            alternateName: '시그렌즈',
            logo: 'https://siglens.io/icon512.png',
            description: '홈 설명',
            founder: {
                '@type': 'Person',
                '@id': 'https://siglens.io/about#person',
                url: 'https://siglens.io/about',
            },
        });
    });
});

/**
 * 키 순서는 직렬화된 `<script type="application/ld+json">` 바이트를 정한다 — ISR HTML이
 * 재생성마다 같아야 하므로 노드별로 순서까지 고정한다.
 */
describe('buildHomeJsonLdNodes 직렬화 순서', () => {
    const nodes = buildHomeJsonLdNodes({ ...INPUT, locale: 'ko' });

    it('WebApplication', () => {
        expect(Object.keys(nodes.webApplication)).toEqual([
            '@context',
            '@type',
            '@id',
            'name',
            'description',
            'url',
            'inLanguage',
            'applicationCategory',
            'operatingSystem',
            'offers',
        ]);
    });

    it('WebPage', () => {
        expect(Object.keys(nodes.webPage)).toEqual([
            '@context',
            '@type',
            '@id',
            'name',
            'description',
            'url',
            'inLanguage',
            'isPartOf',
            'mainEntity',
            'publisher',
        ]);
    });

    it('Organization', () => {
        expect(Object.keys(nodes.organization)).toEqual([
            '@context',
            '@type',
            '@id',
            'name',
            'url',
            'alternateName',
            'logo',
            'description',
            'sameAs',
            'founder',
        ]);
    });
});
