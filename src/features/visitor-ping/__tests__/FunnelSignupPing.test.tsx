import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    consume: vi.fn<() => 'email' | 'oauth' | null>(),
    readLastGate: vi.fn<() => string | null>(),
    clearLastGate: vi.fn(),
    track: vi.fn(),
    pathname: '/',
}));
vi.mock('@/shared/lib/funnel/signupCookie', () => ({
    consumeFunnelSignupCookie: m.consume,
}));
vi.mock('@/shared/lib/funnel/lastGate', () => ({
    readLastGate: m.readLastGate,
    clearLastGate: m.clearLastGate,
}));
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: m.track,
}));
vi.mock('next/navigation', () => ({ usePathname: () => m.pathname }));

import { FunnelSignupPing } from '@/features/visitor-ping/ui/FunnelSignupPing';

describe('FunnelSignupPing', () => {
    beforeEach(() => {
        m.consume.mockReset();
        m.readLastGate.mockReset();
        m.clearLastGate.mockReset();
        m.track.mockReset();
        m.pathname = '/';
    });

    it('쿠키가 있으면 lastGate를 붙여 signup_completed를 한 번 보내고 lastGate를 지운다', () => {
        m.consume.mockReturnValue('oauth');
        m.readLastGate.mockReturnValue('timeframe');
        render(<FunnelSignupPing />);
        expect(m.track).toHaveBeenCalledTimes(1);
        expect(m.track).toHaveBeenCalledWith('signup_completed', {
            method: 'oauth',
            lastGate: 'timeframe',
        });
        expect(m.clearLastGate).toHaveBeenCalledTimes(1);
    });

    it('lastGate가 없으면 null로 보낸다', () => {
        m.consume.mockReturnValue('email');
        m.readLastGate.mockReturnValue(null);
        render(<FunnelSignupPing />);
        expect(m.track).toHaveBeenCalledWith('signup_completed', {
            method: 'email',
            lastGate: null,
        });
    });

    it('쿠키가 없으면 보내지도, lastGate를 지우지도 않는다', () => {
        m.consume.mockReturnValue(null);
        render(<FunnelSignupPing />);
        expect(m.track).not.toHaveBeenCalled();
        expect(m.clearLastGate).not.toHaveBeenCalled();
    });

    it('경로가 바뀌면 다시 확인한다 — 서버 액션 redirect는 리마운트가 아니다', () => {
        m.consume.mockReturnValue(null);
        const { rerender } = render(<FunnelSignupPing />);
        m.pathname = '/portfolio';
        m.consume.mockReturnValue('email');
        m.readLastGate.mockReturnValue(null);
        rerender(<FunnelSignupPing />);
        expect(m.consume).toHaveBeenCalledTimes(2);
        expect(m.track).toHaveBeenCalledTimes(1);
    });

    it('아무것도 렌더하지 않는다', () => {
        m.consume.mockReturnValue(null);
        const { container } = render(<FunnelSignupPing />);
        expect(container).toBeEmptyDOMElement();
    });
});
