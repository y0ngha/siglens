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
} from '@/app/[symbol]/fear-greed/opengraph-image';
import { buildSymbolOgImage } from '@/entities/og-image';
import type { MockedFunction } from 'vitest';

const mockBuildSymbolOgImage = buildSymbolOgImage as MockedFunction<
    typeof buildSymbolOgImage
>;

describe('[symbol]/fear-greed OG images', () => {
    describe('opengraph-image', () => {
        it('exports correct size', () => {
            expect(size).toEqual({ width: 1200, height: 630 });
        });

        it('exports correct contentType', () => {
            expect(contentType).toBe('image/png');
        });

        it('exports alt text containing fear-greed', () => {
            expect(alt).toContain('공포 탐욕 지수');
        });

        it('calls buildSymbolOgImage with ticker and fear-greed label', async () => {
            await OgImage({ params: Promise.resolve({ symbol: 'amzn' }) });

            expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
                ticker: 'AMZN',
                label: '공포 탐욕 지수',
            });
        });
    });

    describe('twitter-image (re-export)', () => {
        it('re-exports same exports from opengraph-image', async () => {
            const twitter =
                await import('@/app/[symbol]/fear-greed/twitter-image');
            expect(twitter.size).toEqual(size);
            expect(twitter.contentType).toBe(contentType);
            expect(twitter.alt).toBe(alt);
        });
    });
});
