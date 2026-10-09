// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postBeacon, sendOnHumanInteraction } from '@/shared/lib/beacon';

const onFirstInteraction = vi.hoisted(() => vi.fn(() => () => {}));
vi.mock('@/shared/lib/onFirstInteraction', () => ({ onFirstInteraction }));

function flush(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

describe('postBeacon', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('본문이 없으면 headers·body 없이 keepalive POST를 보낸다', () => {
        postBeacon({ url: '/api/x', onDelivered: vi.fn() });
        expect(fetch).toHaveBeenCalledWith(
            '/api/x',
            expect.objectContaining({ method: 'POST', keepalive: true })
        );
        const init = vi
            .mocked(fetch)
            .mock.calls.find(([url]) => url === '/api/x')?.[1];
        expect(init).not.toHaveProperty('body');
        expect(init).not.toHaveProperty('headers');
    });

    it('본문이 있으면 JSON으로 보낸다', () => {
        postBeacon({ url: '/api/y', body: { a: 1 }, onDelivered: vi.fn() });
        expect(fetch).toHaveBeenCalledWith(
            '/api/y',
            expect.objectContaining({
                headers: { 'content-type': 'application/json' },
                body: '{"a":1}',
            })
        );
    });

    it('ok 응답에만 onDelivered를 부른다', async () => {
        const onDelivered = vi.fn();
        vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
        postBeacon({ url: '/api/x', onDelivered });
        await flush();
        expect(onDelivered).not.toHaveBeenCalled();

        postBeacon({ url: '/api/x', onDelivered });
        await flush();
        expect(onDelivered).toHaveBeenCalledOnce();
    });

    it('onDelivered 없이도 ok 응답을 조용히 끝낸다', async () => {
        postBeacon({ url: '/api/x' });
        await expect(flush()).resolves.toBeUndefined();
    });

    it('네트워크 오류와 onDelivered의 예외를 삼킨다', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
        postBeacon({ url: '/api/x', onDelivered: vi.fn() });
        postBeacon({
            url: '/api/x',
            onDelivered: () => {
                throw new Error('quota');
            },
        });
        await expect(flush()).resolves.toBeUndefined();
    });
});

describe('sendOnHumanInteraction', () => {
    afterEach(() => {
        onFirstInteraction.mockClear();
    });

    it('자동화 브라우저에서는 게이트를 걸지 않는다', () => {
        Object.defineProperty(navigator, 'webdriver', {
            value: true,
            configurable: true,
        });
        expect(sendOnHumanInteraction(vi.fn())).toBeUndefined();
        expect(onFirstInteraction).not.toHaveBeenCalled();
    });

    it('그 밖에는 첫 입력 게이트를 건다', () => {
        Object.defineProperty(navigator, 'webdriver', {
            value: false,
            configurable: true,
        });
        const send = vi.fn();
        expect(typeof sendOnHumanInteraction(send)).toBe('function');
        expect(onFirstInteraction).toHaveBeenCalledWith(send);
    });
});
