import sharp from 'sharp';
import { normalizeChatImage } from '@/entities/chat-conversation/server/normalizeChatImage';

const solid = (width: number, height: number) =>
    sharp({
        create: {
            width,
            height,
            channels: 3,
            background: { r: 200, g: 40, b: 40 },
        },
    });

describe('normalizeChatImage', () => {
    it('PNG를 WebP로 바꾸고 크기를 그대로 보고한다', async () => {
        const png = await solid(120, 80).png().toBuffer();
        const out = await normalizeChatImage(png);
        expect(out).not.toBeNull();
        expect(out?.mediaType).toBe('image/webp');
        expect(out?.width).toBe(120);
        expect(out?.height).toBe(80);
        const meta = await sharp(out?.bytes).metadata();
        expect(meta.format).toBe('webp');
    });

    it('JPEG도 받는다', async () => {
        const jpeg = await solid(64, 64).jpeg().toBuffer();
        expect((await normalizeChatImage(jpeg))?.width).toBe(64);
    });

    it('GIF는 첫 프레임으로 받는다', async () => {
        const gif = await solid(50, 30).gif().toBuffer();
        const out = await normalizeChatImage(gif);
        expect(out?.width).toBe(50);
        expect(out?.height).toBe(30);
    });

    it('긴 변이 1600px을 넘으면 비율을 지켜 줄인다', async () => {
        const big = await solid(3200, 1600).png().toBuffer();
        const out = await normalizeChatImage(big);
        expect(out?.width).toBe(1600);
        expect(out?.height).toBe(800);
    });

    it('작은 이미지는 키우지 않는다', async () => {
        const small = await solid(40, 20).png().toBuffer();
        const out = await normalizeChatImage(small);
        expect(out?.width).toBe(40);
        expect(out?.height).toBe(20);
    });

    it('EXIF 방향을 픽셀에 적용하고 메타데이터를 버린다', async () => {
        // 가로 100x40 픽셀 + 방향 6(시계 방향 90도) → 화면에는 세로 40x100.
        const rotated = await solid(100, 40)
            .jpeg()
            .withMetadata({ orientation: 6 })
            .toBuffer();
        expect((await sharp(rotated).metadata()).orientation).toBe(6);
        const out = await normalizeChatImage(rotated);
        expect(out?.width).toBe(40);
        expect(out?.height).toBe(100);
        const meta = await sharp(out?.bytes).metadata();
        expect(meta.orientation).toBeUndefined();
        expect(meta.exif).toBeUndefined();
    });

    it('손상된 바이트는 null이다', async () => {
        expect(
            await normalizeChatImage(Buffer.from('not an image at all'))
        ).toBeNull();
    });

    it('이미지가 아닌 지원하지 않는 포맷(SVG)은 null이다', async () => {
        const svg = Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
        );
        expect(await normalizeChatImage(svg)).toBeNull();
    });

    it('픽셀 상한(40MP)을 넘는 이미지는 null이다', async () => {
        const huge = await solid(8000, 5200)
            .png({ compressionLevel: 9 })
            .toBuffer();
        expect(await normalizeChatImage(huge)).toBeNull();
    });
});
