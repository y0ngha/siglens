const { ensureEconomicCalendarAction, ensureEconomicEventsAnalyzedAction } =
    vi.hoisted(() => ({
        ensureEconomicCalendarAction: vi.fn(),
        ensureEconomicEventsAnalyzedAction: vi.fn(),
    }));

vi.mock('@/entities/economy/actions', () => ({
    ensureEconomicCalendarAction,
    ensureEconomicEventsAnalyzedAction,
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { useEconomicCalendarTrigger } from '../useEconomicCalendarTrigger';

function Probe({ country = 'US' as const }: { country?: 'US' | 'KR' }) {
    useEconomicCalendarTrigger(country);
    return null;
}

describe('useEconomicCalendarTrigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureEconomicCalendarAction.mockResolvedValue(undefined);
        ensureEconomicEventsAnalyzedAction.mockResolvedValue(undefined);
    });

    it('fires the ensure action once on mount', () => {
        render(<Probe />);
        expect(ensureEconomicCalendarAction).toHaveBeenCalledOnce();
    });

    it('does not re-fire on re-render', () => {
        const { rerender } = render(<Probe />);
        rerender(<Probe />);
        expect(ensureEconomicCalendarAction).toHaveBeenCalledOnce();
    });

    it('swallows a rejected action without throwing', () => {
        ensureEconomicCalendarAction.mockRejectedValue(new Error('boom'));
        expect(() => render(<Probe />)).not.toThrow();
    });

    it('also fires the analysis ensure once on mount', () => {
        render(<Probe />);
        expect(ensureEconomicEventsAnalyzedAction).toHaveBeenCalledOnce();
    });

    it('swallows a rejected ensureEconomicEventsAnalyzedAction without throwing', () => {
        vi.mocked(ensureEconomicEventsAnalyzedAction).mockRejectedValue(
            new Error('analysis down')
        );
        expect(() => render(<Probe />)).not.toThrow();
    });

    /**
     * 이 훅이 KR 인제스션의 **유일한** 트리거다. `country`가 그대로 흐르지 않으면
     * `economic_calendar`에 KR 행이 영영 안 들어오고, `/economy/kr`은 빈 그리드 +
     * noindex로 굳는다. 두 액션 모두 오류를 삼키고 *미국* 플래그만 세워지므로
     * 런타임 신호가 하나도 없다 — 인자 단언이 유일한 방어선이다.
     */
    it('country를 두 ensure 액션에 그대로 넘긴다', () => {
        render(<Probe country="KR" />);

        expect(ensureEconomicCalendarAction).toHaveBeenCalledWith('KR');
        expect(ensureEconomicEventsAnalyzedAction).toHaveBeenCalledWith('KR');
    });

    /**
     * StrictMode(개발 환경)는 마운트 effect를 두 번 태운다 — cleanup이 없으니
     * `triggeredRef`가 살아남아, 두 번째 호출은 가드로 걸러져야 한다. 가드가
     * 없으면 개발 환경에서 매 마운트마다 인제스션·분석 액션이 중복 호출된다.
     */
    it('StrictMode의 이중 마운트에서도 ensure 액션은 한 번만 실행된다', () => {
        render(
            <StrictMode>
                <Probe />
            </StrictMode>
        );

        expect(ensureEconomicCalendarAction).toHaveBeenCalledOnce();
        expect(ensureEconomicEventsAnalyzedAction).toHaveBeenCalledOnce();
    });

    it('기본 국가는 미국이다', () => {
        render(<Probe />);

        expect(ensureEconomicCalendarAction).toHaveBeenCalledWith('US');
        expect(ensureEconomicEventsAnalyzedAction).toHaveBeenCalledWith('US');
    });
});
