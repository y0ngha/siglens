vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
vi.mock('@/entities/og-image', () => ({
    buildSymbolOgImage: vi.fn().mockResolvedValue(new Response('image')),
}));

import OgImage, {
    size,
    contentType,
    alt,
} from '@/app/[symbol]/news/opengraph-image';
import { buildSymbolOgImage } from '@/entities/og-image';
import type { MockedFunction } from 'vitest';

const mockBuildSymbolOgImage = buildSymbolOgImage as MockedFunction<
    typeof buildSymbolOgImage
>;

describe('[symbol]/news OG images', () => {
    describe('opengraph-image', () => {
        it('exports correct size', () => {
            expect(size).toEqual({ width: 1200, height: 630 });
        });

        it('exports correct contentType', () => {
            expect(contentType).toBe('image/png');
        });

        it('exports alt text containing news', () => {
            expect(alt).toContain('뉴스');
        });

        it('calls buildSymbolOgImage with ticker and news label', async () => {
            await OgImage({ params: Promise.resolve({ symbol: 'tsla' }) });

            expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
                ticker: 'TSLA',
                label: '뉴스 분석',
            });
        });
    });

    describe('twitter-image (re-export)', () => {
        it('re-exports same exports from opengraph-image', async () => {
            const twitter = await import('@/app/[symbol]/news/twitter-image');
            expect(twitter.size).toEqual(size);
            expect(twitter.contentType).toBe(contentType);
            expect(twitter.alt).toBe(alt);
        });
    });
});
