// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { track, claim } = vi.hoisted(() => ({
    track: vi.fn(),
    claim: vi.fn(),
}));
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
}));
vi.mock('@/shared/lib/funnel/meterShownDedupe', () => ({
    claimMeterShown: claim,
}));

import { useFunnelMeterShown } from '@/shared/hooks/useFunnelMeterShown';
import type { MeterState } from '@/shared/lib/funnel/funnelEvents';

function Probe({
    state,
    symbol,
}: {
    state: MeterState | null;
    symbol: string;
}) {
    const ref = useFunnelMeterShown(state, symbol);
    return <div ref={ref} data-testid="probe" />;
}

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

describe('useFunnelMeterShown', () => {
    let callbacks: ObserverCallback[];
    let disconnect: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        track.mockReset();
        claim.mockReset();
        claim.mockReturnValue(true);
        callbacks = [];
        disconnect = vi.fn();
        vi.stubGlobal(
            'IntersectionObserver',
            class {
                constructor(callback: ObserverCallback) {
                    callbacks.push(callback);
                }
                observe = vi.fn();
                disconnect = disconnect;
            }
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('화면에 들어오기 전에는 보내지 않고, 들어오면 한 번 보낸다', () => {
        render(<Probe state="revealed" symbol="AAPL" />);
        expect(track).not.toHaveBeenCalled();

        callbacks[0]([{ isIntersecting: false }]);
        expect(track).not.toHaveBeenCalled();

        callbacks[0]([{ isIntersecting: true }]);
        expect(track).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith('meter_shown', {
            state: 'revealed',
        });
        expect(claim).toHaveBeenCalledWith('AAPL', 'revealed');
        expect(disconnect).toHaveBeenCalled();
    });

    it('이미 보낸 (종목, 상태)면 보내지 않는다', () => {
        claim.mockReturnValue(false);
        render(<Probe state="exhausted" symbol="AAPL" />);

        callbacks[0]([{ isIntersecting: true }]);

        expect(track).not.toHaveBeenCalled();
    });

    it('state가 null이면 관찰하지 않는다', () => {
        render(<Probe state={null} symbol="AAPL" />);
        expect(callbacks).toHaveLength(0);
        expect(track).not.toHaveBeenCalled();
    });

    it('IntersectionObserver가 없으면 마운트 즉시 보낸다', () => {
        vi.unstubAllGlobals();
        vi.stubGlobal('IntersectionObserver', undefined);

        render(<Probe state="revealed" symbol="AAPL" />);

        expect(track).toHaveBeenCalledWith('meter_shown', {
            state: 'revealed',
        });
    });
});
