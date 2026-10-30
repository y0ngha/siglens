/**
 * 뉴스 카드 한 장의 표시 값 계산 — 대기 여부, 고영향 여부, 로케일별 제목·본문·요약, 게시 시각.
 */
import { isCardPending } from '@/entities/news-article/lib/cardPollDecision';
import type { Locale } from '@/shared/i18n/locales';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import {
    resolveNewsBody,
    resolveNewsSummary,
    resolveNewsTitle,
} from '@/shared/lib/news/resolveNewsTitle';

/** `NewsCard`가 렌더에 쓰는 파생 값 묶음. */
export interface NewsCardView {
    pending: boolean;
    isHighImpact: boolean;
    title: string;
    body: string | null;
    summary: string | null;
    publishedDate: string;
}

/**
 * 카드 표시 값을 만든다. 대기 판정은 엔티티의 `isCardPending` 한 곳을 쓰고, 고영향 강조는 보강이
 * 끝난 카드에만 건다. 제목·본문·요약은 같은 규칙으로 해석해 번역된 헤드라인 아래 한국어 본문이
 * 붙는 불일치를 막는다.
 */
export function buildNewsCardView(
    item: NewsDisplayItem,
    locale: Locale
): NewsCardView {
    const pending = isCardPending(item);
    return {
        pending,
        isHighImpact: !pending && item.priceImpact === 'high',
        title: resolveNewsTitle(item, locale),
        body: resolveNewsBody(item),
        summary: resolveNewsSummary(item),
        publishedDate: formatNewsPublishedAt(item.publishedAt, locale),
    };
}
