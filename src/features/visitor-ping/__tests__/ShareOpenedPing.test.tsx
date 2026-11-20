import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const interaction = vi.hoisted(() => ({
    pending: [] as Array<() => void>,
}));
vi.mock('@/shared/lib/onFirstInteraction', () => ({
    onFirstInteraction: (callback: () => void) => {
        interaction.pending.push(callback);
        return () => {
            interaction.pending = interaction.pending.filter(
                c => c !== callback
            );
        };
    },
}));
function fireInteraction(): void {
    const callbacks = interaction.pending;
    interaction.pending = [];
    act(() => {
        callbacks.forEach(c => c());
    });
}

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
}));

import { ShareOpenedPing } from '@/features/visitor-ping/ui/ShareOpenedPing';
import { claimShareCreated } from '@/shared/lib/funnel/shareMarks';

describe('ShareOpenedPing', () => {
    beforeEach(() => {
        interaction.pending = [];
        track.mockReset();
        window.localStorage.clear();
        Object.defineProperty(navigator, 'webdriver', {
            value: false,
            configurable: true,
        });
    });

    it('입력 전에는 보내지 않는다', () => {
        render(<ShareOpenedPing id="abc" kind="chart" />);
        expect(track).not.toHaveBeenCalled();
    });

    it('첫 입력 뒤 분석 종류만 담아 share_opened를 한 번 보낸다', () => {
        render(<ShareOpenedPing id="abc" kind="overall" />);
        fireInteraction();
        expect(track).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith('share_opened', {
            shareKind: 'overall',
        });
    });

    it('같은 날 같은 링크를 다시 열어도 보내지 않는다', () => {
        const first = render(<ShareOpenedPing id="abc" kind="chart" />);
        fireInteraction();
        first.unmount();
        render(<ShareOpenedPing id="abc" kind="chart" />);
        fireInteraction();
        expect(track).toHaveBeenCalledTimes(1);
    });

    it('이 브라우저가 만든 링크를 연 경우는 보내지 않는다', () => {
        claimShareCreated('mine');
        render(<ShareOpenedPing id="mine" kind="chart" />);
        fireInteraction();
        expect(track).not.toHaveBeenCalled();
    });

    it('언마운트하면 대기 중 게이트를 해제한다', () => {
        const { unmount } = render(<ShareOpenedPing id="abc" kind="chart" />);
        unmount();
        fireInteraction();
        expect(track).not.toHaveBeenCalled();
    });

    it('자동화 브라우저에서는 보내지 않는다', () => {
        Object.defineProperty(navigator, 'webdriver', {
            value: true,
            configurable: true,
        });
        render(<ShareOpenedPing id="abc" kind="chart" />);
        fireInteraction();
        expect(track).not.toHaveBeenCalled();
    });
});
