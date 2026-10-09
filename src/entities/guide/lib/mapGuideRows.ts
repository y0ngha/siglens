import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import {
    GUIDE_CATEGORIES,
    type GuideCatalog,
    type GuideCategory,
    type GuideEntry,
    type GuideFaqItem,
} from '../types';

/** `guide_entries` ⨝ `guide_entry_contents` 한 행(조인 결과). */
export interface GuideRow {
    readonly slug: string;
    readonly category: string;
    readonly sortOrder: number;
    readonly related: readonly string[];
    readonly locale: string;
    readonly title: string;
    readonly aliases: readonly string[];
    readonly summary: string;
    readonly seoTitle: string;
    readonly seoDescription: string;
    readonly demoCaption: string | null;
    readonly bodyMd: string;
    /** jsonb라 모양을 믿지 않는다. */
    readonly faq: unknown;
    readonly entryUpdatedAt: Date;
    readonly contentUpdatedAt: Date;
}

function isGuideCategory(value: string): value is GuideCategory {
    return (GUIDE_CATEGORIES as readonly string[]).includes(value);
}

function toFaq(value: unknown): GuideFaqItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): GuideFaqItem[] => {
        if (item === null || typeof item !== 'object') return [];
        const { q, a } = item as { q?: unknown; a?: unknown };
        return typeof q === 'string' && typeof a === 'string' ? [{ q, a }] : [];
    });
}

/**
 * 요청 로케일 행 + ko 행을 받아 카탈로그로 만든다. slug마다 요청 로케일 행이 있으면 그것을,
 * 없으면 ko 행을 쓰고 `isFallback`을 세운다. 둘 다 없는 slug와 알 수 없는 카테고리 행은 버린다.
 * 카테고리 순서 → `order` → slug로 정렬한다.
 */
export function mapGuideRows(
    rows: readonly GuideRow[],
    locale: Locale
): GuideCatalog {
    // 요청 로케일 > ko > (무시). 조회가 두 로케일만 가져오지만 입력을 믿지 않는다.
    const priority = (row: GuideRow): number =>
        row.locale === locale ? 2 : row.locale === DEFAULT_LOCALE ? 1 : 0;
    const chosen = new Map<string, GuideRow>();
    for (const row of rows) {
        if (!isGuideCategory(row.category) || priority(row) === 0) continue;
        const current = chosen.get(row.slug);
        if (current === undefined || priority(row) > priority(current)) {
            chosen.set(row.slug, row);
        }
    }

    const entries = [...chosen.values()]
        .map((row): GuideEntry => {
            const updatedAt =
                row.contentUpdatedAt > row.entryUpdatedAt
                    ? row.contentUpdatedAt
                    : row.entryUpdatedAt;
            return {
                slug: row.slug,
                // 위에서 걸렀다.
                category: row.category as GuideCategory,
                order: row.sortOrder,
                title: row.title,
                aliases: row.aliases,
                summary: row.summary,
                updatedAt: updatedAt.toISOString(),
                seoTitle: row.seoTitle,
                seoDescription: row.seoDescription,
                demoCaption: row.demoCaption,
                bodyMd: row.bodyMd,
                faq: toFaq(row.faq),
                related: row.related,
                isFallback: row.locale !== locale,
            };
        })
        .toSorted(
            (a, b) =>
                GUIDE_CATEGORIES.indexOf(a.category) -
                    GUIDE_CATEGORIES.indexOf(b.category) ||
                a.order - b.order ||
                a.slug.localeCompare(b.slug)
        );

    return { entries };
}
