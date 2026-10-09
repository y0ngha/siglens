vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioSignupCta } from '@/features/portfolio-management/ui/PortfolioSignupCta';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

describe('PortfolioSignupCta', () => {
    it('가입 링크는 /portfolio로 돌아오는 next를 달고, 클릭 시 gate_clicked{portfolio_page}를 1회 보낸다', async () => {
        const user = userEvent.setup();
        render(<PortfolioSignupCta />);
        const link = screen.getByRole('link', { name: '가입하기' });
        expect(link).toHaveAttribute(
            'href',
            `/signup?next=${encodeURIComponent('/portfolio')}`
        );
        expect(
            screen.getByText(
                '보유종목은 가입 후 평단·수량과 함께 관리할 수 있어요'
            )
        ).toBeInTheDocument();
        await user.click(link);
        expect(vi.mocked(trackFunnelEvent)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(trackFunnelEvent)).toHaveBeenCalledWith(
            'gate_clicked',
            { gate: 'portfolio_page' }
        );
    });
});
