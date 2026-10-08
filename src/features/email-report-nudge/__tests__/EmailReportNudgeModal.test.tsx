import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailReportNudgeModal } from '@/features/email-report-nudge/ui/EmailReportNudgeModal';

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
vi.mock('@/shared/hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
vi.mock('@/shared/hooks/useFocusTrap', () => ({ useFocusTrap: vi.fn() }));

describe('EmailReportNudgeModal', () => {
    it('설정 권유는 보유 종목 수를 알리고 계정 페이지의 메일 리포트 섹션으로 보낸다', () => {
        render(
            <EmailReportNudgeModal
                nudge={{ kind: 'setup', holdingsCount: 4 }}
                onClose={vi.fn()}
            />
        );

        expect(
            screen.getByRole('heading', {
                name: '보유 종목 리포트를 메일로 받아보세요',
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/포트폴리오에 담은 4개 종목/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '메일 리포트 설정하기' })
        ).toHaveAttribute('href', '/email-report');
    });

    it('종목 권유는 그 종목을 미리 채운 포트폴리오 추가로 보낸다', () => {
        render(
            <EmailReportNudgeModal
                nudge={{ kind: 'symbol', symbol: '005930.KS' }}
                onClose={vi.fn()}
            />
        );

        expect(
            screen.getByText(/005930\.KS을\(를\) 포트폴리오에 추가하면/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '포트폴리오에 추가하기' })
        ).toHaveAttribute('href', '/portfolio?symbol=005930.KS');
    });

    it('나중에·이동 버튼 모두 모달을 닫는다', async () => {
        const onClose = vi.fn();
        render(
            <EmailReportNudgeModal
                nudge={{ kind: 'setup', holdingsCount: 1 }}
                onClose={onClose}
            />
        );
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: '나중에' }));
        await user.click(
            screen.getByRole('link', { name: '메일 리포트 설정하기' })
        );

        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
