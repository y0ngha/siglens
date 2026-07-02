import { render, screen, fireEvent } from '@testing-library/react';
import { ShareTriggerDialog } from '../ui/ShareTriggerDialog';

describe('ShareTriggerDialog', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the title', () => {
        render(
            <ShareTriggerDialog
                open
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        expect(
            screen.getByRole('heading', {
                name: '공유하기 전에 분석을 준비할게요',
            })
        ).toBeInTheDocument();
    });

    it('renders the body copy', () => {
        render(
            <ShareTriggerDialog
                open
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        expect(
            screen.getByText(/이 종목의 AI 분석이 아직 없어요/)
        ).toBeInTheDocument();
    });

    it('renders the primary CTA button', () => {
        render(
            <ShareTriggerDialog
                open
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        expect(
            screen.getByRole('button', { name: '분석하고 공유하기' })
        ).toBeInTheDocument();
    });

    it('renders the secondary cancel button', () => {
        render(
            <ShareTriggerDialog
                open
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        expect(
            screen.getByRole('button', { name: '다음에' })
        ).toBeInTheDocument();
    });

    it('calls onConfirm when the primary CTA is clicked', () => {
        render(
            <ShareTriggerDialog
                open
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        fireEvent.click(
            screen.getByRole('button', { name: '분석하고 공유하기' })
        );
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when the secondary button is clicked', () => {
        render(
            <ShareTriggerDialog
                open
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '다음에' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('returns null when open is false', () => {
        const { container } = render(
            <ShareTriggerDialog
                open={false}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders the header close button', () => {
        render(
            <ShareTriggerDialog
                open
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        expect(
            screen.getByRole('button', { name: '닫기' })
        ).toBeInTheDocument();
    });

    it('calls onCancel when the header close button is clicked', () => {
        render(
            <ShareTriggerDialog
                open
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('focuses the header close button on open (useFocusTrap moves to first focusable)', () => {
        render(
            <ShareTriggerDialog
                open
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        // useFocusTrap focuses the first focusable element inside the dialog.
        // The header ✕ close button is now the first focusable element (added for
        // dialog-dismissal consistency with SharePreparingModal).
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: '닫기' })
        );
    });
});
