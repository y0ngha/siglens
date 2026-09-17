import { describe, expect, it } from 'vitest';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { buildWebPageJsonLd, ORGANIZATION_JSON_LD_ID } from '@/shared/lib/seo';

const BASE = {
    url: 'https://siglens.io/AAPL/news',
    name: 'Apple 뉴스',
    description: '애플 뉴스 요약',
    locale: 'ko' as const,
};

describe('buildSymbolWebPageJsonLd', () => {
    it('기본 WebPage 노드를 그대로 유지한다 (@id·inLanguage·isPartOf)', () => {
        const base = buildWebPageJsonLd(BASE);
        const node = buildSymbolWebPageJsonLd(BASE);

        for (const key of Object.keys(base)) {
            expect(node[key]).toEqual(base[key]);
        }
    });

    it('publisher를 홈 Organization 노드의 @id로 참조한다 (이름·로고를 복제하지 않는다)', () => {
        const node = buildSymbolWebPageJsonLd(BASE);

        expect(node.publisher).toEqual({
            '@type': 'Organization',
            '@id': ORGANIZATION_JSON_LD_ID,
        });
    });

    it('generatedAt이 있으면 ISO dateModified를 싣는다', () => {
        const node = buildSymbolWebPageJsonLd({
            ...BASE,
            generatedAt: new Date('2026-09-01T03:04:05.000Z'),
        });

        expect(node.dateModified).toBe('2026-09-01T03:04:05.000Z');
    });

    it('문자열 generatedAt도 ISO로 정규화한다 (캐시 왕복 후 모양)', () => {
        const node = buildSymbolWebPageJsonLd({
            ...BASE,
            generatedAt: '2026-09-01T03:04:05.000Z',
        });

        expect(node.dateModified).toBe('2026-09-01T03:04:05.000Z');
    });

    it.each([undefined, null])(
        'generatedAt이 %s면 dateModified를 아예 싣지 않는다 (거짓 신선도 금지)',
        generatedAt => {
            const node = buildSymbolWebPageJsonLd({ ...BASE, generatedAt });

            expect('dateModified' in node).toBe(false);
        }
    );
});
