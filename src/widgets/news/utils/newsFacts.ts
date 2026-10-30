/**
 * 뉴스 사실 요약의 집계 — 최신 게시 시각, 감성 개수, 분석 완료 수, 헤드라인 목록을 순수하게 계산한다.
 */
import type { Locale } from '@/shared/i18n/locales';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { resolveNewsTitle } from '@/shared/lib/news/resolveNewsTitle';

/** 요약에 싣는 헤드라인 최대 개수. */
export const MAX_HEADLINES = 5;

/** 감성별 기사 수. */
export interface SentimentCounts {
    bullish: number;
    neutral: number;
    bearish: number;
}

/** 번호 목록에 쓰는 헤드라인 한 줄. */
export interface HeadlineItem {
    id: string;
    title: string;
}

/** 가장 최근 `publishedAt`. 파싱 불가한 값은 무시하고, 동률이면 먼저 나온 것을 유지한다. */
export function getLatestPublishedAt(
    items: readonly NewsDisplayItem[]
): string | null {
    const latest = items
        .map(item => ({
            publishedAt: item.publishedAt,
            ms: Date.parse(item.publishedAt),
        }))
        .filter(entry => Number.isFinite(entry.ms))
        .reduce<{ publishedAt: string; ms: number } | null>(
            (best, entry) =>
                best === null || entry.ms > best.ms ? entry : best,
            null
        );
    return latest?.publishedAt ?? null;
}

/** 감성별 개수 — 분석 전(`null`) 기사는 어디에도 세지 않는다. */
export function getSentimentCounts(
    items: readonly NewsDisplayItem[]
): SentimentCounts {
    const countOf = (sentiment: keyof SentimentCounts) =>
        items.filter(item => item.sentiment === sentiment).length;
    return {
        bullish: countOf('bullish'),
        neutral: countOf('neutral'),
        bearish: countOf('bearish'),
    };
}

/** 감성 분석이 끝난 기사 수. */
export function countAnalyzed(items: readonly NewsDisplayItem[]): number {
    return items.filter(item => item.sentiment !== null).length;
}

/** 제목이 빈 기사를 건너뛰고 앞에서 `MAX_HEADLINES`개를 로케일에 맞는 제목으로 만든다. */
export function getHeadlineItems(
    items: readonly NewsDisplayItem[],
    locale: Locale
): HeadlineItem[] {
    return items
        .flatMap(item => {
            const title = resolveNewsTitle(item, locale);
            return title.length > 0 ? [{ id: item.id, title }] : [];
        })
        .slice(0, MAX_HEADLINES);
}
