import type { SignalType } from '@y0ngha/siglens-core';

/**
 * 카테고리 순서 = 허브·카탈로그·sitemap 정렬 순서. `howto`(실전 가이드)가 첫째다 —
 * 방문자의 질문("어떻게 보나")에 답하는 묶음이라 용어 사전보다 앞에 둔다.
 */
export const GUIDE_CATEGORIES = [
    'howto',
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
    /**
     * howto 글이 다루는 용어 항목 slug(비-howto). 역참조("이 항목으로 답하는 질문")와
     * 라이브 모듈의 패턴 탐지 대상이 여기서 나온다. 용어 항목은 빈 배열.
     */
    readonly about: readonly string[];
    /** 라이브 모듈이 섹터 신호 스캐너에서 고를 신호 타입. 없으면 빈 배열. */
    readonly signals: readonly SignalType[];
    /** 데모 차트를 빌려 올 항목 slug(`about` 중 하나). 없으면 자기 slug의 데모. */
    readonly demoFrom: string | null;
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
