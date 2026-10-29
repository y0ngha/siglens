import { describe, expect, it } from 'vitest';
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

describe('allPreviewsEmpty', () => {
    it('모든 목록이 비면 참이다', () => {
        expect(allPreviewsEmpty([[], [], []])).toBe(true);
    });

    it('하나라도 헤드라인이 있으면 거짓이다', () => {
        expect(allPreviewsEmpty([[], ['헤드라인'], []])).toBe(false);
    });
});
