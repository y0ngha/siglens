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
} from '@/app/[locale]/[symbol]/news/opengraph-image';
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
            // `alt`는 Next가 모듈 스코프 상수로 요구해 로케일별로 낼 수 없다 —
            // 네 로케일이 한 값을 공유하므로 영어로 둔다(§opengraph-image.tsx).
            expect(alt).toContain('news');
        });

        it('calls buildSymbolOgImage with ticker and news label', async () => {
            await OgImage({
                params: Promise.resolve({ locale: 'ko', symbol: 'tsla' }),
            });

            expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
                ticker: 'TSLA',
                label: '뉴스 분석',
            });
        });
    });

    describe('twitter-image (re-export)', () => {
        it('re-exports same exports from opengraph-image', async () => {
            const twitter =
                await import('@/app/[locale]/[symbol]/news/twitter-image');
            expect(twitter.size).toEqual(size);
            expect(twitter.contentType).toBe(contentType);
            expect(twitter.alt).toBe(alt);
        });
    });
});
