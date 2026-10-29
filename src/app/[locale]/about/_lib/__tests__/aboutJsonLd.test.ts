import {
    ABOUT_PAGE_URL,
    buildAboutBreadcrumbJsonLd,
    buildAboutJsonLd,
    buildAboutPersonJsonLd,
} from '@/app/[locale]/about/_lib/aboutJsonLd';

const t = (key: string) => key;

describe('about JSON-LD', () => {
    it('절대 URL은 로케일 접두사 없는 /about이다', () => {
        expect(ABOUT_PAGE_URL).toBe('https://siglens.io/about');
    });

    it('AboutPage 노드는 @type을 AboutPage로 좁힌다', () => {
        expect(buildAboutJsonLd(t, 'ko')['@type']).toBe('AboutPage');
    });

    it('mainEntity는 홈 Organization의 @id를 가리킨다', () => {
        expect(buildAboutJsonLd(t, 'ko').mainEntity).toEqual({
            '@id': 'https://siglens.io#organization',
        });
    });

    it('dateModified는 ABOUT_UPDATED_AT의 ISO 문자열이다', () => {
        expect(buildAboutJsonLd(t, 'ko').dateModified).toBe(
            '2026-10-22T15:00:00.000Z'
        );
    });

    it('AboutPage 노드의 키 순서를 고정한다', () => {
        expect(Object.keys(buildAboutJsonLd(t, 'ko'))).toEqual([
            '@context',
            '@type',
            '@id',
            'name',
            'description',
            'url',
            'inLanguage',
            'isPartOf',
            'mainEntity',
            'dateModified',
        ]);
    });

    it('Person 노드의 @id는 홈 founder가 가리키는 #person이다', () => {
        expect(buildAboutPersonJsonLd()['@id']).toBe(
            'https://siglens.io/about#person'
        );
    });

    it('Person 노드의 키 순서를 고정한다', () => {
        expect(Object.keys(buildAboutPersonJsonLd())).toEqual([
            '@context',
            '@type',
            '@id',
            'name',
            'email',
            'url',
            'sameAs',
            'affiliation',
        ]);
    });

    it('브레드크럼 마지막 마디는 로케일 접두사가 붙은 /about이다', () => {
        expect(buildAboutBreadcrumbJsonLd(t, 'en').itemListElement).toEqual([
            {
                '@type': 'ListItem',
                position: 1,
                name: 'SIGLENS',
                item: 'https://siglens.io/en',
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'about.title',
                item: 'https://siglens.io/en/about',
            },
        ]);
    });
});
