import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalysisSignupNudgeModal } from '@/features/analysis-nudge/ui/AnalysisSignupNudgeModal';

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

vi.mock('@/shared/hooks/useEscapeKey', () => ({
    useEscapeKey: vi.fn(),
}));

vi.mock('@/shared/hooks/useFocusTrap', () => ({
    useFocusTrap: vi.fn(),
}));

describe('AnalysisSignupNudgeModal', () => {
    it('renders the nudge title and body copy', () => {
        render(<AnalysisSignupNudgeModal onClose={vi.fn()} />);
        expect(
            screen.getByText('더 깊은 분석을 원하세요?')
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /회원가입하면 '상세 분석'을 켜고 더 자세한 분석 리포트를 받을 수 있어요\./
            )
        ).toBeInTheDocument();
    });

    it('renders the signup CTA linking to /signup', () => {
        render(<AnalysisSignupNudgeModal onClose={vi.fn()} />);
        expect(
            screen.getByRole('link', { name: '회원가입 하러 가기' })
        ).toHaveAttribute('href', '/signup');
    });

    it('has dialog a11y attributes', () => {
        render(<AnalysisSignupNudgeModal onClose={vi.fn()} />);
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute(
            'aria-labelledby',
            'analysis-signup-nudge-title'
        );
    });

    it('calls onClose when the close button is clicked', async () => {
        const onClose = vi.fn();
        render(<AnalysisSignupNudgeModal onClose={onClose} />);
        const user = userEvent.setup();
        await user.click(screen.getByText('닫기'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the signup CTA is clicked (dismisses the modal on navigation)', async () => {
        const onClose = vi.fn();
        render(<AnalysisSignupNudgeModal onClose={onClose} />);
        const user = userEvent.setup();
        await user.click(
            screen.getByRole('link', { name: '회원가입 하러 가기' })
        );
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the backdrop is clicked', async () => {
        const onClose = vi.fn();
        render(<AnalysisSignupNudgeModal onClose={onClose} />);
        const user = userEvent.setup();
        const backdrop = screen
            .getByRole('dialog')
            .parentElement!.querySelector('[aria-hidden="true"]');
        expect(backdrop).not.toBeNull();
        await user.click(backdrop!);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
