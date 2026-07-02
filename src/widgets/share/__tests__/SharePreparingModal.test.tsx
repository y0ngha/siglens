import { render, screen, fireEvent } from '@testing-library/react';
import { SharePreparingModal } from '../ui/SharePreparingModal';

describe('SharePreparingModal', () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // C-7: !open → null
    it('returns null when open is false', () => {
        const { container } = render(
            <SharePreparingModal
                open={false}
                phase="pending"
                onClose={onClose}
                onRetry={onRetry}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    describe('pending phase', () => {
        // C-7: pending shows aria-live text
        it('renders the aria-live status text', () => {
            render(
                <SharePreparingModal
                    open
                    phase="pending"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            const liveRegion = screen
                .getByRole('dialog')
                .querySelector('[aria-live="polite"]');
            expect(liveRegion).toBeInTheDocument();
            expect(liveRegion).toHaveTextContent(
                /AI가 분석 결과를 준비하고 있어요/
            );
        });

        // C-7: pending shows sub-hint text (ellipsis)
        it('renders the sub-hint about timing', () => {
            render(
                <SharePreparingModal
                    open
                    phase="pending"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            expect(
                screen.getByText(/보통 10.30초면 끝나요/)
            ).toBeInTheDocument();
        });

        // C-7: aria-busy="true" in pending phase
        it('sets aria-busy on the dialog in pending phase', () => {
            render(
                <SharePreparingModal
                    open
                    phase="pending"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            expect(screen.getByRole('dialog')).toHaveAttribute(
                'aria-busy',
                'true'
            );
        });

        it('does not render the retry button in pending phase', () => {
            render(
                <SharePreparingModal
                    open
                    phase="pending"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            expect(
                screen.queryByRole('button', { name: '다시 시도' })
            ).not.toBeInTheDocument();
        });

        it('renders the close button', () => {
            render(
                <SharePreparingModal
                    open
                    phase="pending"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            expect(
                screen.getByRole('button', { name: '닫기' })
            ).toBeInTheDocument();
        });

        it('calls onClose when the close button is clicked in pending phase', () => {
            render(
                <SharePreparingModal
                    open
                    phase="pending"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            fireEvent.click(screen.getByRole('button', { name: '닫기' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('error phase', () => {
        // C-7: error shows retry button calling onRetry
        it('renders the retry button', () => {
            render(
                <SharePreparingModal
                    open
                    phase="error"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            expect(
                screen.getByRole('button', { name: '다시 시도' })
            ).toBeInTheDocument();
        });

        it('calls onRetry when the retry button is clicked', () => {
            render(
                <SharePreparingModal
                    open
                    phase="error"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
            expect(onRetry).toHaveBeenCalledTimes(1);
        });

        // C-7: 닫기 calling onClose
        it('renders exactly two close buttons (header ✕ + body 닫기) in error phase', () => {
            render(
                <SharePreparingModal
                    open
                    phase="error"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            // ✕ button has aria-label="닫기"; body button has text "닫기" — both match by name
            const closeButtons = screen.getAllByRole('button', {
                name: '닫기',
            });
            expect(closeButtons.length).toBe(2);
        });

        it('calls onClose when the body 닫기 button is clicked', () => {
            render(
                <SharePreparingModal
                    open
                    phase="error"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            // getAllByRole returns elements in DOM order: header ✕ first, body 닫기 second
            const [, bodyCloseBtn] = screen.getAllByRole('button', {
                name: '닫기',
            });
            fireEvent.click(bodyCloseBtn!);
            expect(onClose).toHaveBeenCalled();
        });

        it('renders the error message text', () => {
            render(
                <SharePreparingModal
                    open
                    phase="error"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            expect(
                screen.getByText(/분석을 끝내지 못했어요/)
            ).toBeInTheDocument();
        });

        it('does not set aria-busy in error phase', () => {
            render(
                <SharePreparingModal
                    open
                    phase="error"
                    onClose={onClose}
                    onRetry={onRetry}
                />
            );
            expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-busy');
        });
    });
});
