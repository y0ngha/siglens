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
} from '@/app/[locale]/[symbol]/opengraph-image';
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
            await OgImage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });

            expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
                ticker: 'AAPL',
                label: '차트 분석',
            });
        });

        /**
         * ko만 검증하면 로케일 전달을 통째로 빼도 통과한다 — `getTranslations`가
         * 로케일 없이도 기본 로케일로 떨어지기 때문이다. 실제로 이 파일의
         * 6개 테스트는 로케일 인자를 제거한 상태에서도 전부 초록이었다.
         * 비-기본 로케일이 유일한 판별 지점이다.
         */
        it.each([
            ['ja', 'チャート分析'],
            ['en', 'Chart Analysis'],
        ])('%s 로케일 라벨을 쓴다', async (locale, expected) => {
            await OgImage({
                params: Promise.resolve({ locale, symbol: 'aapl' }),
            });

            expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
                ticker: 'AAPL',
                label: expected,
            });
        });

        it('returns a Response', async () => {
            const result = await OgImage({
                params: Promise.resolve({ locale: 'ko', symbol: 'TSLA' }),
            });
            expect(result).toBeInstanceOf(Response);
        });
    });

    describe('twitter-image (re-export)', () => {
        it('re-exports same size/contentType/alt from opengraph-image', async () => {
            const twitter =
                await import('@/app/[locale]/[symbol]/twitter-image');
            expect(twitter.size).toEqual(size);
            expect(twitter.contentType).toBe(contentType);
            expect(twitter.alt).toBe(alt);
        });
    });
});
