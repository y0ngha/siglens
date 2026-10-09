vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: vi.fn(),
}));

const urlParam = vi.hoisted(() => ({ symbol: null as string | null }));
vi.mock('@/shared/hooks/useUrlSearchParam', () => ({
    useUrlSearchParam: (name: string) =>
        name === 'symbol' ? urlParam.symbol : null,
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioSignupCta } from '@/features/portfolio-management/ui/PortfolioSignupCta';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

describe('PortfolioSignupCta', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        urlParam.symbol = null;
    });

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

    it('심볼이 없으면 가입·로그인 링크 모두 /portfolio만 next로 단다', () => {
        render(<PortfolioSignupCta />);
        const next = encodeURIComponent('/portfolio');
        expect(screen.getByRole('link', { name: '가입하기' })).toHaveAttribute(
            'href',
            `/signup?next=${next}`
        );
        expect(
            screen.getByRole('link', { name: '이미 회원이신가요? 로그인' })
        ).toHaveAttribute('href', `/login?next=${next}`);
    });

    it('?symbol=가 있으면(소문자·공백 정규화) 가입·로그인 next에 그대로 싣는다', () => {
        urlParam.symbol = ' aapl ';
        render(<PortfolioSignupCta />);
        const next = encodeURIComponent('/portfolio?symbol=AAPL');
        expect(screen.getByRole('link', { name: '가입하기' })).toHaveAttribute(
            'href',
            `/signup?next=${next}`
        );
        expect(
            screen.getByRole('link', { name: '이미 회원이신가요? 로그인' })
        ).toHaveAttribute('href', `/login?next=${next}`);
    });

    it('로그인 링크 클릭은 가입 게이트 이벤트를 보내지 않는다', async () => {
        const user = userEvent.setup();
        render(<PortfolioSignupCta />);
        await user.click(
            screen.getByRole('link', { name: '이미 회원이신가요? 로그인' })
        );
        expect(vi.mocked(trackFunnelEvent)).not.toHaveBeenCalled();
    });
});
