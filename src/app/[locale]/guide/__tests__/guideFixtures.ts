import type { GuideCatalog, GuideEntry } from '@/entities/guide/types';

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

export const RSI = guideEntry({
    slug: 'rsi',
    title: 'RSI',
    aliases: ['상대강도지수'],
    seoTitle: 'RSI 뜻과 보는 법, 70과 30의 의미',
    seoDescription: 'RSI 14의 계산 원리와 70·30 기준을 정리했어요.',
    faq: [
        {
            q: 'RSI가 70을 넘으면 팔아야 하나요?',
            a: '자동으로 하락 신호는 아니에요.',
        },
    ],
    related: ['macd'],
});
export const MACD = guideEntry({ slug: 'macd', title: 'MACD', order: 2 });
export const DOJI = guideEntry({
    slug: 'doji',
    category: 'candlesticks',
    title: '도지',
});

export const CATALOG: GuideCatalog = { entries: [DOJI, RSI, MACD] };
