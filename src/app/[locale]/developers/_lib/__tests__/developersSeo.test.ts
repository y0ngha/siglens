import {
    buildDevelopersJsonLd,
    developersFullTitle,
} from '@/app/[locale]/developers/_lib/developersSeo';

const t = (key: string) => key;

describe('developers SEO', () => {
    it('전체 제목은 developers.metaTitle 키에서 온다', () => {
        expect(developersFullTitle(t)).toBe('developers.metaTitle');
    });

    it('publisher는 홈 Organization의 @id를 가리킨다', () => {
        expect(buildDevelopersJsonLd(t, 'ko').publisher).toEqual({
            '@id': 'https://siglens.io#organization',
        });
    });

    it('dateModified는 DEVELOPERS_UPDATED_AT의 ISO 문자열이다', () => {
        expect(buildDevelopersJsonLd(t, 'ko').dateModified).toBe(
            '2026-10-15T15:00:00.000Z'
        );
    });

    it('@type은 WebPage다(더 좁은 타입을 얹지 않는다)', () => {
        expect(buildDevelopersJsonLd(t, 'ko')['@type']).toBe('WebPage');
    });

    it('WebPage 노드의 키 순서를 고정한다', () => {
        expect(Object.keys(buildDevelopersJsonLd(t, 'ko'))).toEqual([
            '@context',
            '@type',
            '@id',
            'name',
            'description',
            'url',
            'inLanguage',
            'isPartOf',
            'dateModified',
            'publisher',
        ]);
    });
});
