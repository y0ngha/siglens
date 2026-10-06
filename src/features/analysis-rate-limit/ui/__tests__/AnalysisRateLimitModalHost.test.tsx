import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalysisRateLimitModalHost } from '@/features/analysis-rate-limit/ui/AnalysisRateLimitModalHost';
import { publishAnalysisRateLimited } from '@/shared/lib/sse/analysisRateLimitSignal';
import { koMessage } from '@/shared/test-utils/koMessage';

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

const TITLE = koMessage('features.analysis-rate-limit.title');
const RETRY_AT = Date.parse('2026-10-07T00:00:00.000Z');

function publish(
    audience: 'guest' | 'member',
    retryAt = RETRY_AT,
    reason: 'quota' | 'unavailable' = 'quota'
): void {
    act(() => publishAnalysisRateLimited({ audience, reason, retryAt }));
}

describe('AnalysisRateLimitModalHost', () => {
    it('renders nothing until a rate_limited notice arrives', () => {
        render(<AnalysisRateLimitModalHost />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens an accessible signup modal for guests with signup and login CTAs', () => {
        render(<AnalysisRateLimitModalHost />);
        publish('guest');

        const dialog = screen.getByRole('dialog', { name: TITLE });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute(
            'aria-describedby',
            'analysis-rate-limit-signup-description'
        );
        expect(
            screen.getByRole('link', {
                name: koMessage('features.analysis-rate-limit.signup'),
            })
        ).toHaveAttribute('href', '/signup');
        expect(
            screen.getByRole('link', {
                name: koMessage('features.analysis-rate-limit.login'),
            })
        ).toHaveAttribute('href', '/login');
    });

    it('does not open for members — they get the banner message only', () => {
        render(<AnalysisRateLimitModalHost />);
        publish('member', RETRY_AT + 1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not open for a store outage — the guest did not use up a quota', () => {
        render(<AnalysisRateLimitModalHost />);
        publish('guest', RETRY_AT + 50, 'unavailable');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes on Escape and stays closed for repeat notices in the same window', async () => {
        render(<AnalysisRateLimitModalHost />);
        publish('guest', RETRY_AT + 2);
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await userEvent.setup().keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        publish('guest', RETRY_AT + 2);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        // 더 늦은 재시도 시각(새 한도 창)이면 다시 연다.
        publish('guest', RETRY_AT + 3);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('keeps focus inside the dialog (focus trap) and closes via the close button', async () => {
        render(<AnalysisRateLimitModalHost />);
        publish('guest', RETRY_AT + 10);
        const dialog = screen.getByRole('dialog');
        const user = userEvent.setup();

        for (let i = 0; i < 5; i += 1) {
            await user.tab();
            expect(dialog).toContainElement(
                document.activeElement as HTMLElement
            );
        }

        await user.click(
            screen.getByRole('button', {
                name: koMessage('features.analysis-rate-limit.close'),
            })
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
