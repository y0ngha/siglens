import type { GuideEntry } from '@/entities/guide/types';

export function guideEntry(
    overrides: Partial<GuideEntry> & { slug: string }
): GuideEntry {
    return {
        category: 'indicators',
        order: 1,
        title: overrides.slug.toUpperCase(),
        aliases: [],
        summary: `${overrides.slug} 요약이에요.`,
        updatedAt: '2026-10-09T15:00:00.000Z',
        seoTitle: `${overrides.slug} 뜻과 보는 법`,
        seoDescription: `${overrides.slug}의 계산과 해석을 정리했어요.`,
        demoCaption: null,
        bodyMd: '## 어떻게 계산하나\n\n본문이에요.',
        faq: [],
        related: [],
        isFallback: false,
        ...overrides,
    };
}
