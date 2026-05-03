import type { NewsCategory, NewsSentiment } from '@y0ngha/siglens-core';

/** Display-side projection of a news item; `infrastructure/db/newsRepository.NewsRow` extends this with persistence-only fields. */
export interface NewsDisplayItem {
    id: string;
    publishedAt: string;
    titleEn: string;
    titleKo: string | null;
    sentiment: NewsSentiment | null;
    category: NewsCategory | null;
    summaryKo: string | null;
    url: string;
    source: string;
}
