import { describe, expect, it } from 'vitest';
import {
    buildAiHomeJsonLd,
    buildAiHomeMetadata,
} from '@/app/ai/[locale]/aiSeo';
import { AI_SITE_URL } from '@/shared/config/aiHost';

const copy = {
    title: 'SIGLENS AI (Beta) — 주식·코인 AI 리서치 어시스턴트',
    description: '설명',
    ogLabel: '라벨',
};

describe('buildAiHomeMetadata', () => {
    it('indexable locale (ko): index, canonical to the ai host home, full OG/Twitter card', () => {
        const m = buildAiHomeMetadata('ko', copy);
        expect(m.title).toEqual({ absolute: copy.title });
        expect(m.description).toBe(copy.description);
        expect(m.robots).toEqual({ index: true, follow: true });
        expect(m.alternates?.canonical).toBe(`${AI_SITE_URL}/`);
        expect(m.openGraph).toMatchObject({
            siteName: 'SIGLENS AI',
            url: `${AI_SITE_URL}/`,
            images: [{ url: `${AI_SITE_URL}/api/ai/og?locale=ko` }],
        });
        expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
    });

    it('a locale outside the static index gate is noindex (still followed) and keeps its own canonical', () => {
        const m = buildAiHomeMetadata('en', copy);
        expect(m.robots).toEqual({ index: false, follow: true });
        expect(m.alternates?.canonical).toBe(`${AI_SITE_URL}/en`);
        // A one-locale cluster is not a cluster: no hreflang map.
        expect(m.alternates?.languages).toBeUndefined();
    });
});

describe('buildAiHomeJsonLd', () => {
    it('is a WebApplication tied to the siglens Organization, not a separate publisher', () => {
        const ld = buildAiHomeJsonLd('ko', copy);
        expect(ld['@type']).toBe('WebApplication');
        expect(ld.url).toBe(`${AI_SITE_URL}/`);
        expect(ld.publisher).toEqual({
            '@id': expect.stringMatching(/#organization$/),
        });
        expect(ld.applicationCategory).toBe('FinanceApplication');
    });
});
