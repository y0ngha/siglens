import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingContent } from '@/features/portfolio-onboarding/ui/OnboardingContent';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: vi.fn(),
        prefetch: vi.fn(),
    }),
}));

// PortfolioSection self-fetches via usePortfolioHoldings (react-query + a server
// action) which is unrelated to what this suite verifies (onboarding copy +
// skip/complete navigation). Stub it to avoid pulling in that data dependency.
vi.mock('@/features/portfolio-management', () => ({
    PortfolioSection: () => <div data-testid="portfolio-section-stub" />,
}));

describe('OnboardingContent', () => {
    beforeEach(() => {
        mockPush.mockClear();
    });

    it('renders the welcome heading and helper copy', () => {
        render(<OnboardingContent />);
        expect(
            screen.getByRole('heading', {
                name: '보유종목을 등록해 보세요',
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '지금 등록하면 내 평균 단가를 기준으로 분석을 받을 수 있어요. 나중에 계정 설정에서도 추가할 수 있어요.'
            )
        ).toBeInTheDocument();
    });

    it('renders the reused PortfolioSection', () => {
        render(<OnboardingContent />);
        expect(
            screen.getByTestId('portfolio-section-stub')
        ).toBeInTheDocument();
    });

    it('나중에 하기 클릭 시 홈으로 이동한다', async () => {
        const user = userEvent.setup();
        render(<OnboardingContent />);
        await user.click(screen.getByRole('button', { name: '나중에 하기' }));
        expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('완료 클릭 시 홈으로 이동한다', async () => {
        const user = userEvent.setup();
        render(<OnboardingContent />);
        await user.click(screen.getByRole('button', { name: '완료' }));
        expect(mockPush).toHaveBeenCalledWith('/');
    });
});
