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
} from '@/app/[symbol]/opengraph-image';
import { buildSymbolOgImage } from '@/entities/og-image';
import type { MockedFunction } from 'vitest';

const mockBuildSymbolOgImage = buildSymbolOgImage as MockedFunction<
    typeof buildSymbolOgImage
>;

describe('[symbol] OG images', () => {
    describe('opengraph-image', () => {
        it('exports correct size', () => {
            expect(size).toEqual({ width: 1200, height: 630 });
        });

        it('exports correct contentType', () => {
            expect(contentType).toBe('image/png');
        });

        it('exports alt text', () => {
            expect(alt).toBeDefined();
            expect(typeof alt).toBe('string');
        });

        it('calls buildSymbolOgImage with uppercased ticker and label', async () => {
            await OgImage({ params: Promise.resolve({ symbol: 'aapl' }) });

            expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
                ticker: 'AAPL',
                label: '차트 분석',
            });
        });

        it('returns a Response', async () => {
            const result = await OgImage({
                params: Promise.resolve({ symbol: 'TSLA' }),
            });
            expect(result).toBeInstanceOf(Response);
        });
    });

    describe('twitter-image (re-export)', () => {
        it('re-exports same size/contentType/alt from opengraph-image', async () => {
            const twitter = await import('@/app/[symbol]/twitter-image');
            expect(twitter.size).toEqual(size);
            expect(twitter.contentType).toBe(contentType);
            expect(twitter.alt).toBe(alt);
        });
    });
});
