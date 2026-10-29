import {
    buildSymbolsJsonLd,
    symbolsDescription,
    symbolsFullTitle,
    symbolsTitle,
} from '@/app/[locale]/symbols/_lib/symbolsSeo';

const t = (key: string) => key;

describe('symbols SEO', () => {
    it('짧은 제목은 symbols.title 키에서 온다', () => {
        expect(symbolsTitle(t)).toBe('symbols.title');
    });

    it('전체 제목은 브랜드 꼬리표가 붙는다', () => {
        expect(symbolsFullTitle(t, 'en')).toBe('symbols.title | SIGLENS');
    });

    it('설명은 symbols.description 키에서 온다', () => {
        expect(symbolsDescription(t)).toBe('symbols.description');
    });

    it('WebPage 노드는 로케일 접두사가 붙은 URL과 @id를 쓴다', () => {
        const { webPageJsonLd } = buildSymbolsJsonLd(t, 'en', 'H');
        expect(webPageJsonLd).toMatchObject({
            '@id': 'https://siglens.io/en/symbols#webpage',
            url: 'https://siglens.io/en/symbols',
            name: 'symbols.title | SIGLENS',
            inLanguage: 'en',
        });
    });

    it('WebPage 노드의 키 순서를 고정한다', () => {
        const { webPageJsonLd } = buildSymbolsJsonLd(t, 'en', 'H');
        expect(Object.keys(webPageJsonLd)).toEqual([
            '@context',
            '@type',
            '@id',
            'name',
            'description',
            'url',
            'inLanguage',
            'isPartOf',
        ]);
    });

    it('브레드크럼 마지막 마디 이름은 넘긴 heading이다', () => {
        const { breadcrumbJsonLd } = buildSymbolsJsonLd(t, 'en', 'H');
        expect(breadcrumbJsonLd.itemListElement).toEqual([
            {
                '@type': 'ListItem',
                position: 1,
                name: 'SIGLENS',
                item: 'https://siglens.io/en',
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'H',
                item: 'https://siglens.io/en/symbols',
            },
        ]);
    });
});
