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

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
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
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute(
            'aria-labelledby',
            'premium-model-gate-title'
        );
        // 회귀: `aria-modal`은 `role="dialog"` 요소에 있어야 의미가 있다. 예전엔
        // 바깥 래퍼(role 없음)에 붙어 있어 보조기술이 무시했다.
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        // 모달은 document.body로 portal되므로 문서 전체에서 센다.
        expect(document.querySelectorAll('[aria-modal]')).toHaveLength(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
        const user = userEvent.setup();
        render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
        await user.click(screen.getByTestId('modal-backdrop'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    describe('퍼널 이벤트', () => {
        it('열리면 nudge_shown{model_gate}를 한 번 보낸다', () => {
            render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
            expect(
                track.mock.calls.filter(([event]) => event === 'nudge_shown')
            ).toEqual([['nudge_shown', { kind: 'model_gate' }]]);
        });

        it('auth 모드의 가입 CTA는 cta=signup', async () => {
            const user = userEvent.setup();
            render(<PremiumModelGateModal mode="auth" onClose={onClose} />);
            await user.click(
                screen.getByRole('link', { name: '회원가입 하러 가기' })
            );
            expect(track).toHaveBeenCalledWith('nudge_clicked', {
                kind: 'model_gate',
                cta: 'signup',
            });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('byok 모드의 등록 CTA는 cta=settings', async () => {
            const user = userEvent.setup();
            render(<PremiumModelGateModal mode="byok" onClose={onClose} />);
            await user.click(
                screen.getByRole('link', { name: '등록하러 가기' })
            );
            expect(track).toHaveBeenCalledWith('nudge_clicked', {
                kind: 'model_gate',
                cta: 'settings',
            });
        });
    });
});
