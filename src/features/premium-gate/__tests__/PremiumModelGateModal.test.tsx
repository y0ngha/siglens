import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PremiumModelGateModal } from '@/features/premium-gate/ui/PremiumModelGateModal';

vi.mock('@/shared/hooks/useFocusTrap', () => ({
    useFocusTrap: vi.fn(),
}));
vi.mock('@/shared/hooks/useEscapeKey', () => ({
    useEscapeKey: vi.fn(),
}));
vi.mock('next/link', () => ({
    default: ({
        children,
        ...props
    }: {
        children: React.ReactNode;
        href: string;
    }) => <a {...props}>{children}</a>,
}));

describe('PremiumModelGateModal', () => {
    const onClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('auth mode', () => {
        it('renders auth title', () => {
            render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
            expect(
                screen.getByText('프리미엄 모델 사용 안내')
            ).toBeInTheDocument();
        });

        it('renders auth body text', () => {
            render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
            expect(
                screen.getByText(
                    '회원가입 후 API 키를 등록하면 이 모델을 사용할 수 있어요.'
                )
            ).toBeInTheDocument();
        });

        it('renders signup link', () => {
            render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
            const link = screen.getByRole('link', {
                name: '회원가입 하러 가기',
            });
            expect(link).toHaveAttribute('href', '/signup');
        });
    });

    describe('byok mode', () => {
        it('renders byok title', () => {
            render(<PremiumModelGateModal mode="byok" onClose={onClose} />);
            expect(screen.getByText('API 키 등록 필요')).toBeInTheDocument();
        });

        it('renders byok body text with provider label', () => {
            render(
                <PremiumModelGateModal
                    mode="byok"
                    providerLabel="Claude (Anthropic)"
                    onClose={onClose}
                />
            );
            expect(
                screen.getByText(
                    'Claude (Anthropic) API 키를 등록하면 이 모델을 사용할 수 있어요.'
                )
            ).toBeInTheDocument();
        });

        it('renders account link', () => {
            render(<PremiumModelGateModal mode="byok" onClose={onClose} />);
            const link = screen.getByRole('link', {
                name: '등록하러 가기',
            });
            expect(link).toHaveAttribute('href', '/account');
        });
    });

    it('renders close button', () => {
        render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
        expect(
            screen.getByRole('button', { name: '닫기' })
        ).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
        const user = userEvent.setup();
        render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
        await user.click(screen.getByRole('button', { name: '닫기' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders dialog with aria-modal', () => {
        render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
        expect(screen.getByRole('dialog')).toHaveAttribute(
            'aria-labelledby',
            'premium-model-gate-title'
        );
    });

    it('calls onClose when backdrop is clicked', async () => {
        const user = userEvent.setup();
        render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
        const backdrop = document.querySelector('[aria-hidden="true"]');
        expect(backdrop).not.toBeNull();
        await user.click(backdrop!);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
