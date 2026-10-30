import { describe, expect, it } from 'vitest';
import {
    buildEmptyCategoryMetadata,
    categorySocialMetadata,
} from '@/app/[locale]/news/[category]/_lib/categoryMetadata';
import type { SeoTranslator } from '@/shared/lib/seo';

/** `키:label`을 돌려주는 번역자 — 어떤 템플릿 키에 어떤 라벨을 넘겼는지 단언한다. */
const tSeo: SeoTranslator = (key, values) => `${key}:${String(values?.label)}`;

describe('buildEmptyCategoryMetadata', () => {
    const meta = buildEmptyCategoryMetadata({
        locale: 'en',
        canonicalPath: '/news/crypto',
        label: 'Crypto',
        tSeo,
    });

    it('빈 상태 템플릿으로 제목·설명을 만든다', () => {
        expect(meta.title).toBe('newsCategory.emptyTitleTemplate:Crypto');
        expect(meta.description).toBe(
            'newsCategory.emptyDescriptionTemplate:Crypto'
        );
    });

    it('noindex지만 링크는 따라가게 둔다', () => {
        expect(meta.robots).toEqual({ index: false, follow: true });
    });

    it('로케일별 self-canonical만 내고 hreflang 군집은 싣지 않는다', () => {
        expect(meta.alternates).toEqual({
            canonical: 'https://siglens.io/en/news/crypto',
        });
    });

    it('og:url도 자기 로케일 URL이다', () => {
        expect(meta.openGraph?.url).toBe('https://siglens.io/en/news/crypto');
    });
});

describe('categorySocialMetadata', () => {
    it('og·twitter에 같은 제목·설명을 싣는다', () => {
        const social = categorySocialMetadata(
            'ko',
            '/news/stock',
            '제목 | 시그렌즈',
            '설명'
        );

        expect(social.openGraph).toMatchObject({
            title: '제목 | 시그렌즈',
            description: '설명',
            url: 'https://siglens.io/news/stock',
        });
        expect(social.twitter).toMatchObject({
            title: '제목 | 시그렌즈',
            description: '설명',
        });
    });
});
