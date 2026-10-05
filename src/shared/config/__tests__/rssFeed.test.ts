import { describe, expect, it } from 'vitest';
import {
    RSS_ALTERNATE_TYPES,
    RSS_FEED_URL,
    rssAlternateTypes,
} from '../rssFeed';

describe('rssAlternateTypes', () => {
    it('ko에만 RSS 발견 링크를 낸다 — 피드가 한국어 전용이다', () => {
        expect(rssAlternateTypes('ko')).toBe(RSS_ALTERNATE_TYPES);
        expect(RSS_ALTERNATE_TYPES['application/rss+xml']).toBe(RSS_FEED_URL);
        for (const locale of ['en', 'ja', 'zh'] as const) {
            expect(rssAlternateTypes(locale)).toBeUndefined();
        }
    });
});
