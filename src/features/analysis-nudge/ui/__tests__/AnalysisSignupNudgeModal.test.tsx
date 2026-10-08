import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalysisSignupNudgeModal } from '@/features/analysis-nudge/ui/AnalysisSignupNudgeModal';
import { koMessage } from '@/shared/test-utils/koMessage';

// 기능 이름은 이제 `features.reasoning-toggle.a11y.featureLabel` 키다 —
// 예전엔 모듈 상수라 `/en`의 토글이 영어 UI 안에서 `상세 분석`을 렌더했다.
const REASONING_FEATURE_LABEL = koMessage(
    'features.reasoning-toggle.a11y.featureLabel'
);

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
        render(
            <AnalysisSignupNudgeModal variant="reasoning" onClose={vi.fn()} />
        );
        expect(
            screen.getByText('더 깊은 분석을 원하세요?')
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                new RegExp(
                    `회원가입하면 '${REASONING_FEATURE_LABEL}'을 켜고 더 자세한 분석 리포트를 받을 수 있어요\\.`
                )
            )
        ).toBeInTheDocument();
    });

    it('emailReport 문구는 메일 리포트를 알리고 상세 분석 문구는 싣지 않는다', () => {
        render(
            <AnalysisSignupNudgeModal variant="emailReport" onClose={vi.fn()} />
        );
        expect(
            screen.getByRole('heading', {
                name: '보유 종목 리포트를 메일로 받아보세요',
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/고른 요일과 시각에 일봉 차트/)
        ).toBeInTheDocument();
        expect(
            screen.queryByText('더 깊은 분석을 원하세요?')
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '회원가입 하러 가기' })
        ).toHaveAttribute('href', '/signup');
    });

    it('renders the signup CTA linking to /signup', () => {
        render(
            <AnalysisSignupNudgeModal variant="reasoning" onClose={vi.fn()} />
        );
        expect(
            screen.getByRole('link', { name: '회원가입 하러 가기' })
        ).toHaveAttribute('href', '/signup');
    });

    it('has dialog a11y attributes', () => {
        render(
            <AnalysisSignupNudgeModal variant="reasoning" onClose={vi.fn()} />
        );
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute(
            'aria-labelledby',
            'analysis-signup-nudge-title'
        );
    });

    it('calls onClose when the close button is clicked', async () => {
        const onClose = vi.fn();
        render(
            <AnalysisSignupNudgeModal variant="reasoning" onClose={onClose} />
        );
        const user = userEvent.setup();
        await user.click(screen.getByText('닫기'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the signup CTA is clicked (dismisses the modal on navigation)', async () => {
        const onClose = vi.fn();
        render(
            <AnalysisSignupNudgeModal variant="reasoning" onClose={onClose} />
        );
        const user = userEvent.setup();
        await user.click(
            screen.getByRole('link', { name: '회원가입 하러 가기' })
        );
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the backdrop is clicked', async () => {
        const onClose = vi.fn();
        render(
            <AnalysisSignupNudgeModal variant="reasoning" onClose={onClose} />
        );
        const user = userEvent.setup();
        await user.click(screen.getByTestId('modal-backdrop'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
