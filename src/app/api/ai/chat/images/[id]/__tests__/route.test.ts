const { m, RepoCtor } = vi.hoisted(() => {
    const m = {
        user: vi.fn(),
        findImageWithOwner: vi.fn(),
    };
    return {
        m,
        RepoCtor: vi.fn(function (this: unknown) {
            return { findImageWithOwner: m.findImageWithOwner };
        }),
    };
});

vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: m.user,
}));
vi.mock('@/entities/chat-conversation/api', () => ({
    DrizzleChatConversationRepository: RepoCtor,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/ai/chat/images/[id]/route';

const ID = '55555555-5555-5555-5555-555555555551';
const bytes = Buffer.from([1, 2, 3, 4]);
const call = (id = ID, headers: Record<string, string> = {}) =>
    GET(
        new Request(`https://ai.example/api/ai/chat/images/${id}`, { headers }),
        {
            params: Promise.resolve({ id }),
        }
    );

describe('GET /api/ai/chat/images/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.user.mockResolvedValue({ id: 'owner' });
        m.findImageWithOwner.mockResolvedValue({
            mediaType: 'image/webp',
            data: bytes,
            ownerId: 'owner',
        });
    });

    it('소유자에게는 재검증 캐시 헤더·ETag와 함께 image/webp 바이트를 준다', async () => {
        const res = await call();
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/webp');
        expect(res.headers.get('Cache-Control')).toBe('private, no-cache');
        expect(res.headers.get('ETag')).toBe(`"${ID}"`);
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(Buffer.from(await res.arrayBuffer())).toEqual(bytes);
        expect(m.findImageWithOwner).toHaveBeenCalledWith(ID);
    });

    it('소유자의 If-None-Match가 ETag와 맞으면 바이트 없이 304', async () => {
        const res = await call(ID, { 'If-None-Match': `W/"${ID}"` });
        expect(res.status).toBe(304);
        expect(res.headers.get('ETag')).toBe(`"${ID}"`);
        expect(await res.text()).toBe('');
    });

    it('ETag가 다르면 200으로 다시 준다', async () => {
        expect((await call(ID, { 'If-None-Match': '"other"' })).status).toBe(
            200
        );
    });

    it('타인은 If-None-Match가 맞아도 404다(소유 확인이 먼저)', async () => {
        m.user.mockResolvedValue({ id: 'someone-else' });
        const res = await call(ID, { 'If-None-Match': `"${ID}"` });
        expect(res.status).toBe(404);
        expect(res.headers.get('ETag')).toBeNull();
    });

    it('타인의 이미지는 404이고 바이트가 새지 않는다', async () => {
        m.user.mockResolvedValue({ id: 'someone-else' });
        const res = await call();
        expect(res.status).toBe(404);
        expect(res.headers.get('Content-Type')).toBeNull();
        expect(await res.text()).toBe('');
    });

    it('비로그인은 DB를 읽기 전에 404', async () => {
        m.user.mockResolvedValue(null);
        expect((await call()).status).toBe(404);
        expect(m.findImageWithOwner).not.toHaveBeenCalled();
    });

    it('없는 이미지는 소유자 불일치와 같은 404다', async () => {
        m.findImageWithOwner.mockResolvedValue(null);
        const res = await call();
        expect(res.status).toBe(404);
        expect(res.headers.get('Cache-Control')).toBeNull();
    });
});
