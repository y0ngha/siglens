export const GUIDE_CATEGORIES = [
    'candlesticks',
    'chart-patterns',
    'indicators',
    'strategies',
] as const;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

export function isGuideCategory(value: unknown): value is GuideCategory {
    return (
        typeof value === 'string' &&
        (GUIDE_CATEGORIES as readonly string[]).includes(value)
    );
}

export interface GuideFaqItem {
    readonly q: string;
    readonly a: string;
}

export interface GuideEntrySummary {
    readonly slug: string;
    readonly category: GuideCategory;
    readonly order: number;
    readonly title: string;
    readonly aliases: readonly string[];
    readonly summary: string;
    /** ISO 8601. */
    readonly updatedAt: string;
}

export interface GuideEntry extends GuideEntrySummary {
    readonly seoTitle: string;
    readonly seoDescription: string;
    readonly demoCaption: string | null;
    readonly bodyMd: string;
    readonly faq: readonly GuideFaqItem[];
    readonly related: readonly string[];
    /** 요청 로케일 번역이 없어 ko 내용을 대신 보여 주는가. */
    readonly isFallback: boolean;
}

/** 카테고리 순서 → `order` 순으로 정렬돼 있다. */
export interface GuideCatalog {
    readonly entries: readonly GuideEntry[];
}
