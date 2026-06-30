import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareSheet } from '@/widgets/share/ui/ShareSheet';

const defaultProps = {
    shareUrl: 'https://siglens.io/share/abc',
    tweetText: 'AAPL 강세',
    title: 'AAPL AI 분석 결과',
    description: '강세',
    onClose: vi.fn(),
};

function setup(extraProps: Partial<typeof defaultProps> = {}) {
    const onClose = vi.fn();
    render(<ShareSheet {...defaultProps} {...extraProps} onClose={onClose} />);
    return { onClose };
}

describe('ShareSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: clipboard writes succeed.
        vi.stubGlobal('navigator', {
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    // C-5 test 1: renders copy + X options; X has rel containing noopener
    it('renders copy and X share options', () => {
        setup();
        expect(
            screen.getByRole('button', { name: /링크 복사/ })
        ).toBeInTheDocument();
        const xLink = screen.getByRole('link', { name: /X|트위터/ });
        expect(xLink).toHaveAttribute(
            'rel',
            expect.stringContaining('noopener')
        );
    });

    // C-5 test 2: copy → copied feedback text appears + aria-live region present
    it('shows copied feedback and aria-live region after copy', async () => {
        setup();
        // aria-live region must be present before copy too
        const liveRegion = document.querySelector('[aria-live="polite"]');
        expect(liveRegion).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /링크 복사/ }));

        // After copy the live region should announce the success message.
        await waitFor(() => {
            expect(liveRegion).toHaveTextContent('링크를 복사했어요');
        });
        // The visible button label also switches to copied state.
        expect(
            screen.getByRole('button', { name: /복사됨/ })
        ).toBeInTheDocument();
    });

    // C-5 test 3: copy failure → selectable readonly input fallback appears
    it('shows selectable readonly input fallback when clipboard write fails', async () => {
        vi.stubGlobal('navigator', {
            clipboard: {
                writeText: vi.fn().mockRejectedValue(new Error('denied')),
            },
        });
        setup();
        fireEvent.click(screen.getByRole('button', { name: /링크 복사/ }));

        await waitFor(() => {
            const input = screen.getByRole('textbox', {
                name: /공유 링크/,
            }) as HTMLInputElement;
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('readonly');
            expect(input.value).toBe('https://siglens.io/share/abc');
        });
    });

    // Kakao button is removed (no-op SDK not wired — follow-up task)
    it('does not render a Kakao button', () => {
        setup();
        expect(
            screen.queryByRole('button', { name: /카카오|Kakao/ })
        ).not.toBeInTheDocument();
    });

    // C-5 test 5a: on mount, first actionable item (copy button) receives focus
    it('focuses the first actionable item (copy button) on mount', () => {
        setup();
        expect(screen.getByRole('button', { name: /링크 복사/ })).toHaveFocus();
    });

    // C-5 test 5b: Escape key calls onClose
    it('calls onClose when Escape is pressed', () => {
        const { onClose } = setup();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // R4-1: pointerdown outside the panel calls onClose (click-outside dismissal)
    it('calls onClose when pointerdown occurs outside the panel', () => {
        const { onClose } = setup();
        // Simulate a click outside the dialog panel (on document.body)
        fireEvent.pointerDown(document.body);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // R4-1: pointerdown inside the panel does NOT call onClose
    it('does NOT call onClose when pointerdown occurs inside the panel', () => {
        const { onClose } = setup();
        const panel = document.querySelector('[role="dialog"]') as HTMLElement;
        fireEvent.pointerDown(panel);
        expect(onClose).not.toHaveBeenCalled();
    });
});
