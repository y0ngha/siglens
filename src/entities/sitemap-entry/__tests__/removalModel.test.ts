import {
    isRemovalSitemapKind,
    REMOVAL_SITEMAP_KINDS,
} from '@/entities/sitemap-entry';

describe('isRemovalSitemapKind', () => {
    describe('removal sitemap kind 목록의 값이면', () => {
        it('허용한다', () => {
            for (const kind of REMOVAL_SITEMAP_KINDS) {
                expect(isRemovalSitemapKind(kind)).toBe(true);
            }
        });
    });

    describe('removal sitemap kind 목록의 값이 아니면', () => {
        it.each(['', 'popular', 'unknown', 'chart.xml'])(
            '%s를 거부한다',
            value => {
                expect(isRemovalSitemapKind(value)).toBe(false);
            }
        );
    });
});
