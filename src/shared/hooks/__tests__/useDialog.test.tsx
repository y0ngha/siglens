import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDialog } from '@/shared/hooks/useDialog';

function DialogHarness() {
    const { isOpen, open, close, dialogRef, triggerRef } = useDialog();
    return (
        <>
            <button ref={triggerRef} onClick={open}>
                Open
            </button>
            {isOpen && (
                <dialog ref={dialogRef} data-testid="dialog" onClose={close}>
                    <p>Dialog content</p>
                    <button onClick={close}>Close</button>
                </dialog>
            )}
        </>
    );
}

describe('useDialog', () => {
    it('starts closed', () => {
        render(<DialogHarness />);
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('opens on trigger click', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        await user.click(screen.getByText('Open'));
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('closes on close button click', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        await user.click(screen.getByText('Open'));
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
        await user.click(screen.getByText('Close'));
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('closes on Escape key', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        await user.click(screen.getByText('Open'));
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    // 네이티브 모달은 배경 클릭이 dialog 엘리먼트 자신에게 도달한다(바깥 요소는 inert).
    // 소비자는 target === currentTarget 확인으로 "배경 클릭 닫기"를 구현한다.
    it('closes when the backdrop (dialog element itself) is clicked', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        await user.click(screen.getByText('Open'));
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
        await user.click(screen.getByTestId('dialog'));
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('returns focus to trigger after closing', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        const trigger = screen.getByText('Open');
        await user.click(trigger);
        await user.click(screen.getByText('Close'));
        expect(trigger).toHaveFocus();
    });
});
