import { describe, expect, it } from 'vitest';
import {
    NEWS_CATEGORY_LABEL_KEY,
    newsCategoryLabelKey,
} from '../categoryDisplay';

describe('newsCategoryLabelKey', () => {
    it.each(Object.entries(NEWS_CATEGORY_LABEL_KEY))(
        '%s → %s',
        (category, key) => {
            expect(newsCategoryLabelKey(category)).toBe(key);
        }
    );

    it('키는 shared.enumLabel 아래 newsCategory.* 네임스페이스다', () => {
        for (const key of Object.values(NEWS_CATEGORY_LABEL_KEY)) {
            expect(key).toMatch(/^newsCategory\./);
        }
    });

    it('other·알 수 없는 값·null은 null(배지를 그리지 않는다)', () => {
        expect(newsCategoryLabelKey('other')).toBeNull();
        expect(newsCategoryLabelKey('brand_new')).toBeNull();
        expect(newsCategoryLabelKey(null)).toBeNull();
        expect(newsCategoryLabelKey('')).toBeNull();
    });

    it('프로토타입 키를 카테고리로 오인하지 않는다', () => {
        expect(newsCategoryLabelKey('toString')).toBeNull();
        expect(newsCategoryLabelKey('constructor')).toBeNull();
    });
});
