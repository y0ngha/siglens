import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    fitWithin,
    imagePayloads,
    prepareChatImage,
    storedImageSrc,
} from '@/features/agent-chat/lib/prepareChatImage';
import {
    CHAT_IMAGE_CLIENT_JPEG_QUALITY,
    CHAT_IMAGE_CLIENT_MAX_EDGE,
    CHAT_IMAGE_CLIENT_MAX_ENCODED_BYTES,
    CHAT_IMAGE_SOURCE_MAX_BYTES,
} from '@/shared/config/chatImages';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const fileOf = (type: string, size = 4): File =>
    new File([new Uint8Array(size)], 'x.png', { type });

describe('fitWithin', () => {
    it('긴 변이 한도 이내면 그대로 둔다(키우지 않는다)', () => {
        expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
        expect(fitWithin(2048, 100, 2048)).toEqual({
            width: 2048,
            height: 100,
        });
    });

    it('긴 변을 한도에 맞추고 비율을 지킨다', () => {
        expect(fitWithin(4096, 2048, 2048)).toEqual({
            width: 2048,
            height: 1024,
        });
        expect(fitWithin(1000, 8000, 2048)).toEqual({
            width: 256,
            height: 2048,
        });
    });

    it('극단적인 비율도 한 변이 0이 되지 않는다', () => {
        expect(fitWithin(10000, 1, 2048).height).toBe(1);
    });
});

describe('prepareChatImage', () => {
    it('지원하지 않는 형식은 디코드 전에 거절한다', async () => {
        const decode = vi.fn();
        vi.stubGlobal('createImageBitmap', decode);
        expect(await prepareChatImage(fileOf('image/svg+xml'))).toEqual({
            ok: false,
            reason: 'unsupported',
        });
        expect(decode).not.toHaveBeenCalled();
    });

    it('원본이 25MB를 넘으면 디코드 전에 거절한다', async () => {
        const decode = vi.fn();
        vi.stubGlobal('createImageBitmap', decode);
        const big = fileOf('image/png');
        Object.defineProperty(big, 'size', {
            value: CHAT_IMAGE_SOURCE_MAX_BYTES + 1,
        });
        expect(await prepareChatImage(big)).toEqual({
            ok: false,
            reason: 'too_large',
        });
        expect(decode).not.toHaveBeenCalled();
    });

    it('디코드에 실패하면 그 파일만 unreadable로 거절한다', async () => {
        vi.stubGlobal(
            'createImageBitmap',
            vi.fn().mockRejectedValue(new Error('bad'))
        );
        expect(await prepareChatImage(fileOf('image/png'))).toEqual({
            ok: false,
            reason: 'unreadable',
        });
    });

    it('큰 이미지는 긴 변 1600px 이내 JPEG로 줄이고 base64 payload와 object URL을 만든다', async () => {
        const bitmap = { width: 4096, height: 1024, close: vi.fn() };
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
        const drawImage = vi.fn();
        const canvas = {
            width: 0,
            height: 0,
            getContext: () => ({ fillRect: vi.fn(), drawImage }),
            toBlob: (cb: (b: Blob | null) => void, type: string, q: number) => {
                expect([type, q]).toEqual([
                    'image/jpeg',
                    CHAT_IMAGE_CLIENT_JPEG_QUALITY,
                ]);
                cb(new Blob([new Uint8Array([1, 2, 3])], { type }));
            },
        };
        vi.spyOn(document, 'createElement').mockReturnValue(
            canvas as unknown as HTMLElement
        );
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:abc');
        const result = await prepareChatImage(fileOf('image/png'));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.image.width).toBe(CHAT_IMAGE_CLIENT_MAX_EDGE);
        expect(result.image.height).toBe(400);
        expect(result.image.src).toBe('blob:abc');
        expect(result.image.payload).toEqual({
            mediaType: 'image/jpeg',
            data: btoa(String.fromCharCode(1, 2, 3)),
        });
        expect(drawImage).toHaveBeenCalledWith(
            bitmap,
            0,
            0,
            CHAT_IMAGE_CLIENT_MAX_EDGE,
            400
        );
        expect(bitmap.close).toHaveBeenCalled();
    });

    it('인코딩 결과가 장당 상한을 넘으면 object URL을 만들기 전에 too_large로 거절한다', async () => {
        vi.stubGlobal(
            'createImageBitmap',
            vi.fn().mockResolvedValue({ width: 10, height: 10, close: vi.fn() })
        );
        vi.spyOn(document, 'createElement').mockReturnValue({
            getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
            toBlob: (cb: (b: Blob | null) => void) =>
                cb(
                    new Blob([
                        new Uint8Array(CHAT_IMAGE_CLIENT_MAX_ENCODED_BYTES + 1),
                    ])
                ),
        } as unknown as HTMLElement);
        const create = vi.spyOn(URL, 'createObjectURL');
        expect(await prepareChatImage(fileOf('image/jpeg'))).toEqual({
            ok: false,
            reason: 'too_large',
        });
        expect(create).not.toHaveBeenCalled();
    });

    it('JPEG 인코딩이 null을 주면 unreadable이다', async () => {
        vi.stubGlobal(
            'createImageBitmap',
            vi.fn().mockResolvedValue({ width: 10, height: 10, close: vi.fn() })
        );
        vi.spyOn(document, 'createElement').mockReturnValue({
            getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
            toBlob: (cb: (b: Blob | null) => void) => cb(null),
        } as unknown as HTMLElement);
        expect(await prepareChatImage(fileOf('image/jpeg'))).toEqual({
            ok: false,
            reason: 'unreadable',
        });
    });
});

describe('imagePayloads / storedImageSrc', () => {
    it('payload가 있는 이미지만 본문에 싣는다', () => {
        expect(
            imagePayloads([
                {
                    id: 'a',
                    src: 'blob:a',
                    width: 1,
                    height: 1,
                    payload: { mediaType: 'image/jpeg', data: 'AAAA' },
                },
                { id: 'b', src: '/x', width: 1, height: 1 },
            ])
        ).toEqual([{ mediaType: 'image/jpeg', data: 'AAAA' }]);
    });

    it('저장된 이미지 조회 경로', () => {
        expect(storedImageSrc('abc')).toBe('/api/ai/chat/images/abc');
    });
});
