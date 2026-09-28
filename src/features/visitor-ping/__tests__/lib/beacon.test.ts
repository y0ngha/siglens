// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    postBeacon,
    sendOnHumanInteraction,
} from '@/features/visitor-ping/lib/beacon';

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

    it('sends a body-less keepalive POST when no body is given', () => {
        postBeacon({ url: '/api/x', onDelivered: vi.fn() });
        const init = vi.mocked(fetch).mock.calls[0][1];
        expect(init).toMatchObject({ method: 'POST', keepalive: true });
        expect(init).not.toHaveProperty('body');
        expect(init).not.toHaveProperty('headers');
    });

    it('sends a JSON body when given', () => {
        postBeacon({ url: '/api/x', body: { a: 1 }, onDelivered: vi.fn() });
        expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
            headers: { 'content-type': 'application/json' },
            body: '{"a":1}',
        });
    });

    it('calls onDelivered only for an ok response', async () => {
        const onDelivered = vi.fn();
        vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
        postBeacon({ url: '/api/x', onDelivered });
        await flush();
        expect(onDelivered).not.toHaveBeenCalled();

        postBeacon({ url: '/api/x', onDelivered });
        await flush();
        expect(onDelivered).toHaveBeenCalledOnce();
    });

    it('swallows network errors and onDelivered errors', async () => {
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

    it('never arms the gate for an automated browser', () => {
        Object.defineProperty(navigator, 'webdriver', {
            value: true,
            configurable: true,
        });
        expect(sendOnHumanInteraction(vi.fn())).toBeUndefined();
        expect(onFirstInteraction).not.toHaveBeenCalled();
    });

    it('arms the first-interaction gate otherwise', () => {
        Object.defineProperty(navigator, 'webdriver', {
            value: false,
            configurable: true,
        });
        const send = vi.fn();
        expect(typeof sendOnHumanInteraction(send)).toBe('function');
        expect(onFirstInteraction).toHaveBeenCalledWith(send);
    });
});
