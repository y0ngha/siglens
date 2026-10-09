import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

/** node 프로젝트(window 없음) — SSR·RSC에서 불려도 아무것도 하지 않아야 한다. */
describe('trackFunnelEvent (SSR)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('window가 없으면 전송도 던지기도 하지 않는다', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        expect(() =>
            trackFunnelEvent('gate_clicked', { gate: 'timeframe' })
        ).not.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
