vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import { buildRemovalEntries } from '../lib/buildRemovalEntries';

const LAST_MODIFIED = new Date('2026-07-08T00:00:00.000Z');

describe('buildRemovalEntries', () => {
    describe('when chart symbols contain mixed casing and duplicates', () => {
        it('returns sorted unique uppercase chart URLs with the removal date', () => {
            const symbols = ['msft', 'AAA', 'MSFT'];

            const entries = buildRemovalEntries('chart', symbols);

            expect(entries).toEqual([
                {
                    url: 'https://siglens.io/AAA',
                    lastModified: LAST_MODIFIED,
                },
                {
                    url: 'https://siglens.io/MSFT',
                    lastModified: LAST_MODIFIED,
                },
            ]);
            expect(symbols).toEqual(['msft', 'AAA', 'MSFT']);
        });
    });

    describe('when building legacy tab entries', () => {
        it.each([
            ['news', '/news'],
            ['overall', '/overall'],
            ['fundamental', '/fundamental'],
            ['fear-greed', '/fear-greed'],
        ] as const)('appends the %s suffix', (kind, suffix) => {
            expect(buildRemovalEntries(kind, ['aapl'])).toEqual([
                {
                    url: `https://siglens.io/AAPL${suffix}`,
                    lastModified: LAST_MODIFIED,
                },
            ]);
        });
    });
});
