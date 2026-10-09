import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '@/shared/ui/ToastProvider';
import { TOAST_AUTO_DISMISS_MS } from '@/shared/config/toast';

function Trigger({
    message,
    link,
}: {
    message: string;
    link?: { href: string; label: string };
}) {
    const { showToast } = useToast();
    return (
        <button type="button" onClick={() => showToast({ message, link })}>
            show {message}
        </button>
    );
}

describe('ToastProvider', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('라이브 영역은 토스트가 없어도 늘 마운트돼 있다(role=status, polite)', () => {
        render(
            <ToastProvider>
                <div />
            </ToastProvider>
        );
        const region = screen.getByRole('status');
        expect(region).toHaveAttribute('aria-live', 'polite');
        expect(region).toBeEmptyDOMElement();
    });

    it('showToast는 메시지와 링크를 그린다', async () => {
        const user = userEvent.setup();
        render(
            <ToastProvider>
                <Trigger
                    message="담았어요"
                    link={{ href: '/portfolio', label: '내 종목 보기' }}
                />
            </ToastProvider>
        );
        await user.click(screen.getByRole('button', { name: 'show 담았어요' }));
        expect(screen.getByRole('status')).toHaveTextContent('담았어요');
        expect(
            screen.getByRole('link', { name: '내 종목 보기' })
        ).toHaveAttribute('href', '/portfolio');
    });

    it('한 번에 하나 — 두 번째 토스트가 첫 토스트를 교체한다', async () => {
        const user = userEvent.setup();
        render(
            <ToastProvider>
                <Trigger message="첫째" />
                <Trigger message="둘째" />
            </ToastProvider>
        );
        await user.click(screen.getByRole('button', { name: 'show 첫째' }));
        await user.click(screen.getByRole('button', { name: 'show 둘째' }));
        expect(screen.getByRole('status')).toHaveTextContent('둘째');
        expect(screen.getByRole('status')).not.toHaveTextContent('첫째');
    });

    it('닫기 버튼으로 닫힌다', async () => {
        const user = userEvent.setup();
        render(
            <ToastProvider>
                <Trigger message="닫을게" />
            </ToastProvider>
        );
        await user.click(screen.getByRole('button', { name: 'show 닫을게' }));
        await user.click(screen.getByRole('button', { name: '알림 닫기' }));
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it(`${TOAST_AUTO_DISMISS_MS}ms 뒤 자동으로 닫힌다`, async () => {
        vi.useFakeTimers();
        render(
            <ToastProvider>
                <Trigger message="잠깐" />
            </ToastProvider>
        );
        fireEvent.click(screen.getByRole('button', { name: 'show 잠깐' }));
        expect(screen.getByRole('status')).toHaveTextContent('잠깐');
        act(() => {
            vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS - 1);
        });
        expect(screen.getByRole('status')).toHaveTextContent('잠깐');
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('호버 중에는 자동 닫힘이 멈추고, 떠나면 처음부터 다시 센다', () => {
        vi.useFakeTimers();
        render(
            <ToastProvider>
                <Trigger message="읽는 중" />
            </ToastProvider>
        );
        fireEvent.click(screen.getByRole('button', { name: 'show 읽는 중' }));
        const card = screen.getByTestId('toast');
        fireEvent.mouseEnter(card);
        act(() => {
            vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS * 3);
        });
        expect(screen.getByRole('status')).toHaveTextContent('읽는 중');
        fireEvent.mouseLeave(card);
        act(() => {
            vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS - 1);
        });
        expect(screen.getByRole('status')).toHaveTextContent('읽는 중');
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('포커스가 토스트 안에 있는 동안 멈추고, 안에서 옮겨 다녀도 유지되며, 밖으로 나가면 다시 센다', () => {
        vi.useFakeTimers();
        render(
            <ToastProvider>
                <Trigger
                    message="링크"
                    link={{ href: '/portfolio', label: '내 종목 보기' }}
                />
            </ToastProvider>
        );
        fireEvent.click(screen.getByRole('button', { name: 'show 링크' }));
        const link = screen.getByRole('link', { name: '내 종목 보기' });
        const close = screen.getByRole('button', { name: '알림 닫기' });
        fireEvent.focus(link);
        act(() => {
            vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS * 2);
        });
        expect(screen.getByRole('status')).toHaveTextContent('링크');

        // 링크 → 닫기: relatedTarget이 카드 안이라 계속 멈춰 있다.
        fireEvent.blur(link, { relatedTarget: close });
        fireEvent.focus(close);
        act(() => {
            vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS * 2);
        });
        expect(screen.getByRole('status')).toHaveTextContent('링크');

        fireEvent.blur(close, { relatedTarget: document.body });
        act(() => {
            vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS);
        });
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('useToast는 프로바이더 밖에서 던진다', () => {
        const spy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/);
        spy.mockRestore();
    });
});
