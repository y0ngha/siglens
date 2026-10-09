// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readLastGate, rememberLastGate } from '@/shared/lib/funnel/lastGate';
import {
    FUNNEL_EVENT_ENDPOINT,
    trackFunnelEvent,
} from '@/shared/lib/funnel/trackFunnelEvent';

function flush(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

describe('trackFunnelEvent', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('엔드포인트는 presence 하위다 — analytics·track 경로는 차단 목록이 막는다', () => {
        expect(FUNNEL_EVENT_ENDPOINT).toBe('/api/presence/funnel');
    });

    it('이벤트 하나를 JSON 본문의 keepalive POST로 보낸다', () => {
        trackFunnelEvent('gate_clicked', { gate: 'timeframe' });
        expect(fetch).toHaveBeenCalledWith(
            FUNNEL_EVENT_ENDPOINT,
            expect.objectContaining({
                method: 'POST',
                keepalive: true,
                body: JSON.stringify({
                    event: 'gate_clicked',
                    context: { gate: 'timeframe' },
                }),
                signal: expect.any(AbortSignal),
            })
        );
    });

    it('nudge_shown은 kind를 lastGate로 기록한다', () => {
        trackFunnelEvent('nudge_shown', {
            kind: 'anon_auto',
            variant: 'emailReport',
        });
        expect(readLastGate()).toBe('anon_auto');
    });

    it('gate_clicked는 gate를 lastGate로 기록한다', () => {
        trackFunnelEvent('gate_clicked', { gate: 'locked_detail' });
        expect(readLastGate()).toBe('locked_detail');
    });

    it('nudge_clicked·signup_completed는 lastGate를 바꾸지 않는다', () => {
        rememberLastGate('timeframe');
        trackFunnelEvent('nudge_clicked', {
            kind: 'rate_limit',
            cta: 'signup',
        });
        trackFunnelEvent('signup_completed', {
            method: 'email',
            lastGate: 'timeframe',
        });
        expect(readLastGate()).toBe('timeframe');
    });

    it('fetch가 거부돼도 던지지 않는다', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        expect(() =>
            trackFunnelEvent('gate_clicked', { gate: 'model' })
        ).not.toThrow();
        await expect(flush()).resolves.toBeUndefined();
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('fetch가 동기적으로 던져도 던지지 않는다', () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => {
                throw new TypeError('fetch is not available');
            })
        );
        expect(() =>
            trackFunnelEvent('gate_clicked', { gate: 'model' })
        ).not.toThrow();
    });
});
