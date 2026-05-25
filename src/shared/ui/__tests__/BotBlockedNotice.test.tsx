import { render, screen } from '@testing-library/react';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';

describe('BotBlockedNotice', () => {
    it('renders without error', () => {
        render(<BotBlockedNotice />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has role="status" for accessibility', () => {
        render(<BotBlockedNotice />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('displays the bot-blocked explanation text', () => {
        render(<BotBlockedNotice />);
        expect(
            screen.getByText(
                '봇 트래픽으로 보여 분석 결과를 표시하지 않았어요.'
            )
        ).toBeInTheDocument();
    });

    it('displays the user guidance text', () => {
        render(<BotBlockedNotice />);
        expect(
            screen.getByText(
                '실제 사용자라면 새로고침하거나 다른 브라우저로 접속해 보세요.'
            )
        ).toBeInTheDocument();
    });

    it('applies additional className when provided', () => {
        render(<BotBlockedNotice className="mt-4" />);
        expect(screen.getByRole('status').className).toContain('mt-4');
    });
});
