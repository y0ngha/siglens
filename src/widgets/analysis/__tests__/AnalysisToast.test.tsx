vi.mock('@/shared/config/time', () => ({
    MS_PER_SECOND: 1000,
    SECONDS_PER_MINUTE: 60,
}));

import { render, screen, act } from '@testing-library/react';

import { AnalysisToast } from '../AnalysisToast';

describe('AnalysisToast', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders nothing when notice is null', () => {
        const { container } = render(<AnalysisToast notice={null} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the cooldown message when notice is provided', () => {
        render(<AnalysisToast notice={{ nonce: 1, remainingMs: 180000 }} />);

        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(
            screen.getByText(/재분석은 5분에 한 번만 가능해요/)
        ).toBeInTheDocument();
    });

    it('formats remaining time correctly for minutes + seconds', () => {
        render(<AnalysisToast notice={{ nonce: 1, remainingMs: 125000 }} />);

        expect(screen.getByText(/약 2분 05초 뒤에/)).toBeInTheDocument();
    });

    it('formats remaining time as seconds-only when under 1 minute', () => {
        render(<AnalysisToast notice={{ nonce: 1, remainingMs: 30000 }} />);

        expect(screen.getByText(/약 30초 뒤에/)).toBeInTheDocument();
    });

    it('hides after the visibility timeout', () => {
        render(<AnalysisToast notice={{ nonce: 1, remainingMs: 60000 }} />);

        expect(screen.getByRole('status')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(3500);
        });

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
