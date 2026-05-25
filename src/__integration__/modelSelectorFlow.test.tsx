import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PremiumModelGateModal } from '@/features/premium-gate/ui/PremiumModelGateModal';
import type { GateMode } from '@/entities/api-key';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/shared/hooks/useEscapeKey', () => ({
    useEscapeKey: vi.fn(),
}));

vi.mock('@/shared/hooks/useFocusTrap', () => ({
    useFocusTrap: vi.fn(),
}));

describe('Model Selector Flow', () => {
    describe('PremiumModelGateModal - auth mode', () => {
        it('renders auth gate with signup CTA', () => {
            render(
                <PremiumModelGateModal
                    mode={'auth' as GateMode}
                    onClose={vi.fn()}
                />
            );
            expect(
                screen.getByText('프리미엄 모델 사용 안내')
            ).toBeInTheDocument();
            expect(
                screen.getByRole('link', { name: '회원가입 하러 가기' })
            ).toHaveAttribute('href', '/signup');
        });

        it('calls onClose when dismiss button is clicked', async () => {
            const onClose = vi.fn();
            render(
                <PremiumModelGateModal
                    mode={'auth' as GateMode}
                    onClose={onClose}
                />
            );
            const user = userEvent.setup();
            await user.click(screen.getByText('닫기'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when backdrop is clicked', async () => {
            const onClose = vi.fn();
            render(
                <PremiumModelGateModal
                    mode={'auth' as GateMode}
                    onClose={onClose}
                />
            );
            const user = userEvent.setup();
            const backdrop = screen
                .getByRole('dialog')
                .parentElement!.querySelector('[aria-hidden="true"]');
            if (backdrop) {
                await user.click(backdrop);
                expect(onClose).toHaveBeenCalledTimes(1);
            }
        });
    });

    describe('PremiumModelGateModal - byok mode', () => {
        it('renders API key registration CTA', () => {
            render(
                <PremiumModelGateModal
                    mode={'byok' as GateMode}
                    providerLabel="Anthropic"
                    onClose={vi.fn()}
                />
            );
            expect(screen.getByText('API 키 등록 필요')).toBeInTheDocument();
            expect(
                screen.getByText(
                    'Anthropic API 키를 등록하면 이 모델을 사용할 수 있어요.'
                )
            ).toBeInTheDocument();
            expect(
                screen.getByRole('link', { name: '등록하러 가기' })
            ).toHaveAttribute('href', '/account');
        });
    });
});
