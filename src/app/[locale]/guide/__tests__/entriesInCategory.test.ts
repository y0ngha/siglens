vi.mock('@/views/guide/GuideUnavailablePage', () => ({
    GuideUnavailablePage: () => null,
}));

import { describe, expect, it, vi } from 'vitest';
import { entriesInCategory } from '@/app/[locale]/guide/_lib/guideRoute';
import { CATALOG } from '@/__tests__/fixtures/guideFixtures';

describe('entriesInCategory', () => {
    it('그 분류의 항목만 카탈로그 순서대로 고른다', () => {
        expect(
            entriesInCategory(CATALOG.entries, 'indicators').map(e => e.slug)
        ).toEqual(['rsi', 'macd']);
    });

    it('항목이 없는 분류는 빈 배열이다', () => {
        expect(entriesInCategory(CATALOG.entries, 'howto')).toEqual([]);
    });
});
