import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { SHARE_KIND_OG_BUILDERS } from '@/entities/shared-analysis/server/kindServerRegistry';

describe('SHARE_KIND_OG_BUILDERS', () => {
    it('has a builder for every ShareableKind (8 kinds)', () => {
        expect(Object.keys(SHARE_KIND_OG_BUILDERS).length).toBe(
            SHAREABLE_KIND_VALUES.length
        );
        for (const kind of SHAREABLE_KIND_VALUES) {
            expect(typeof SHARE_KIND_OG_BUILDERS[kind]).toBe('function');
        }
    });
});
