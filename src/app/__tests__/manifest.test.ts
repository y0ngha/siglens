vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
}));

import manifest from '@/app/manifest';

describe('manifest', () => {
    it('returns a valid manifest object', () => {
        const result = manifest();

        expect(result).toBeDefined();
        expect(result.name).toContain('Siglens');
        expect(result.short_name).toBe('Siglens');
    });

    it('sets display to standalone', () => {
        const result = manifest();

        expect(result.display).toBe('standalone');
    });

    it('includes PWA icons', () => {
        const result = manifest();

        expect(result.icons).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ sizes: '192x192' }),
                expect.objectContaining({ sizes: '512x512' }),
            ])
        );
    });

    it('includes shortcuts for market and search', () => {
        const result = manifest();

        expect(result.shortcuts).toHaveLength(2);
        expect(result.shortcuts![0].url).toBe('/market');
        expect(result.shortcuts![1].url).toBe('/?focus=search');
    });

    it('sets lang to ko-KR', () => {
        const result = manifest();

        expect(result.lang).toBe('ko-KR');
    });

    it('sets start_url to /', () => {
        const result = manifest();

        expect(result.start_url).toBe('/');
    });
});
