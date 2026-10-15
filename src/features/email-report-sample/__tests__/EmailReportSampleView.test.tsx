import { render, screen } from '@testing-library/react';
import { EmailReportSampleView } from '@/features/email-report-sample/ui/EmailReportSampleView';

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

describe('EmailReportSampleView', () => {
    it('샘플 메일을 스크립트 없는 샌드박스 iframe에 넣는다', () => {
        render(<EmailReportSampleView srcDoc="<p>sample</p>" />);

        const frame = screen.getByTitle('메일 리포트 샘플 미리보기');
        expect(frame).toHaveAttribute('srcdoc', '<p>sample</p>');
        const tokens = (frame.getAttribute('sandbox') ?? '').split(' ');
        expect(tokens).toEqual([
            'allow-popups',
            'allow-popups-to-escape-sandbox',
        ]);
        expect(tokens).not.toContain('allow-scripts');
        expect(tokens).not.toContain('allow-same-origin');
    });

    it('가입 CTA와 기존 회원용 설정 링크를 보인다', () => {
        render(<EmailReportSampleView srcDoc="" />);

        expect(
            screen.getByRole('heading', { name: '이런 메일을 받아요' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '회원가입하고 받아보기' })
        ).toHaveAttribute('href', '/signup');
        expect(
            screen.getByRole('link', {
                name: '이미 회원이라면 메일 리포트 설정으로',
            })
        ).toHaveAttribute('href', '/email-report');
    });

    it('화면의 내용이 예시라는 점을 알린다', () => {
        render(<EmailReportSampleView srcDoc="" />);

        expect(
            screen.getByText(/종목, 수치, 문장은 모두 예시예요/)
        ).toBeInTheDocument();
    });
});
