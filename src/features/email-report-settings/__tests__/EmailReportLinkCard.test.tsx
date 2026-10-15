import { render, screen } from '@testing-library/react';
import { EmailReportLinkCard } from '@/features/email-report-settings/ui/EmailReportLinkCard';

describe('EmailReportLinkCard', () => {
    it('제목으로 이름 붙은 영역에 메일 리포트 설정 화면 링크를 그린다', () => {
        render(<EmailReportLinkCard />);

        expect(
            screen.getByRole('region', { name: '메일 리포트' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '메일 리포트 설정하기' })
        ).toHaveAttribute('href', '/email-report');
    });

    it('수신 설정 폼을 직접 그리지 않는다 (설정은 /email-report 한 곳)', () => {
        render(<EmailReportLinkCard />);

        expect(screen.queryByRole('form')).not.toBeInTheDocument();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
});
