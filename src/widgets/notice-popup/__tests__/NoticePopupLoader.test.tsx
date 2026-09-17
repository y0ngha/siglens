// @vitest-environment jsdom
/**
 * 로더가 **지연 게이트**를 들고 있는지 고정한다. 팝업 자체는 "띄울 공지가 있으면
 * 띄운다"는 계약 그대로고, 언제 띄울지만 여기서 정한다(2026-09 구글 정책 감사 L21 —
 * 모바일 인터스티셜 판정).
 */
const loaded = vi.hoisted(() => ({ popup: 0 }));

vi.mock('@/widgets/notice-popup/ui/NoticePopup', () => {
    loaded.popup += 1;
    return { NoticePopup: () => <div data-testid="notice-popup" /> };
});

import { act, render, screen, waitFor } from '@testing-library/react';
import { NoticePopupLoader } from '@/widgets/notice-popup/ui/NoticePopupLoader';
import { NOTICE_REVEAL_DELAY_MS } from '@/widgets/notice-popup/hooks/useDeferredReveal';

describe('NoticePopupLoader', () => {
    it('마운트 직후에는 팝업도 그 청크도 가져오지 않는다', () => {
        const { container } = render(<NoticePopupLoader />);
        expect(container).toBeEmptyDOMElement();
        expect(loaded.popup).toBe(0);
    });

    it('첫 상호작용이 오면 팝업을 마운트한다', async () => {
        render(<NoticePopupLoader />);
        act(() => {
            window.dispatchEvent(new Event('pointerdown'));
        });
        await waitFor(() =>
            expect(screen.getByTestId('notice-popup')).toBeInTheDocument()
        );
    });

    it('상호작용이 없어도 지연 시간이 지나면 마운트한다', async () => {
        vi.useFakeTimers();
        try {
            render(<NoticePopupLoader />);
            act(() => {
                vi.advanceTimersByTime(NOTICE_REVEAL_DELAY_MS);
            });
        } finally {
            vi.useRealTimers();
        }
        await waitFor(() =>
            expect(
                screen.getAllByTestId('notice-popup').length
            ).toBeGreaterThan(0)
        );
    });
});
