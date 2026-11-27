const normalizeChatImage = vi.hoisted(() => vi.fn());
vi.mock('@/entities/chat-conversation/server/normalizeChatImage', () => ({
    normalizeChatImage,
}));

import { describe, expect, it, vi } from 'vitest';

import { normalizeBodyImages } from '@/app/api/ai/chat/stream/_lib/normalizeBodyImages';

describe('normalizeBodyImages', () => {
    it('base64 문자열을 디코드한 바이트로 정규화한다', async () => {
        normalizeChatImage.mockResolvedValue({ id: 'n' });
        const bytes = Buffer.from([1, 2, 3, 4, 5]);
        const result = await normalizeBodyImages([bytes.toString('base64')]);
        expect(result).toEqual([{ id: 'n' }]);
        expect(normalizeChatImage).toHaveBeenCalledWith(bytes);
    });

    it('한 장이라도 읽지 못하면 null', async () => {
        normalizeChatImage
            .mockResolvedValueOnce({ id: 'n' })
            .mockResolvedValueOnce(null);
        expect(await normalizeBodyImages(['AAAA', 'AAAA'])).toBeNull();
    });
});
