vi.mock('@/entities/market-news/lib/categoryConfig', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@/entities/market-news/lib/categoryConfig')
        >();
    return { ...actual, categoriesInRegion: vi.fn(actual.categoriesInRegion) };
});

import { describe, expect, it, vi } from 'vitest';
import { categoriesInRegion } from '@/entities/market-news/lib/categoryConfig';
import {
    allPreviewsEmpty,
    previewCategoryOf,
} from '@/app/[locale]/news/_lib/regionPreviews';

describe('previewCategoryOf', () => {
    it('미국은 /news/us 첫 카드(general)와 겹치지 않게 stock을 고른다', () => {
        expect(previewCategoryOf('us')).toBe('stock');
    });

    it('한국은 그 지역의 첫 카테고리를 고른다', () => {
        expect(previewCategoryOf('kr')).toBe('kr');
    });

    it('암호화폐는 그 지역의 첫 카테고리를 고른다', () => {
        expect(previewCategoryOf('crypto')).toBe('crypto');
    });
});

describe('previewCategoryOf — 설정 결함', () => {
    it('카테고리가 없는 지역이면 던진다', () => {
        vi.mocked(categoriesInRegion).mockReturnValueOnce([]);

        expect(() => previewCategoryOf('kr')).toThrow(
            '[NewsHubPage] region has no categories: kr'
        );
    });
});

describe('allPreviewsEmpty', () => {
    it('모든 목록이 비면 참이다', () => {
        expect(allPreviewsEmpty([[], [], []])).toBe(true);
    });

    it('하나라도 헤드라인이 있으면 거짓이다', () => {
        expect(allPreviewsEmpty([[], ['헤드라인'], []])).toBe(false);
    });
});
