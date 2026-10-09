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

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
}));

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

    describe('퍼널 이벤트', () => {
        beforeEach(() => {
            track.mockReset();
        });

        it('설정 권유는 nudge_shown{member_setup}, CTA는 cta=settings', async () => {
            render(
                <EmailReportNudgeModal
                    nudge={{ kind: 'setup', holdingsCount: 2 }}
                    onClose={vi.fn()}
                />
            );
            expect(
                track.mock.calls.filter(([event]) => event === 'nudge_shown')
            ).toEqual([['nudge_shown', { kind: 'member_setup' }]]);
            await userEvent
                .setup()
                .click(
                    screen.getByRole('link', { name: '메일 리포트 설정하기' })
                );
            expect(track).toHaveBeenCalledWith('nudge_clicked', {
                kind: 'member_setup',
                cta: 'settings',
            });
        });

        it('종목 권유는 nudge_shown{member_symbol}, CTA는 cta=add', async () => {
            render(
                <EmailReportNudgeModal
                    nudge={{ kind: 'symbol', symbol: 'NVDA' }}
                    onClose={vi.fn()}
                />
            );
            expect(track).toHaveBeenCalledWith('nudge_shown', {
                kind: 'member_symbol',
            });
            await userEvent
                .setup()
                .click(
                    screen.getByRole('link', { name: '포트폴리오에 추가하기' })
                );
            expect(track).toHaveBeenCalledWith('nudge_clicked', {
                kind: 'member_symbol',
                cta: 'add',
            });
        });

        it('나중에 버튼은 nudge_clicked를 보내지 않는다', async () => {
            render(
                <EmailReportNudgeModal
                    nudge={{ kind: 'setup', holdingsCount: 1 }}
                    onClose={vi.fn()}
                />
            );
            await userEvent
                .setup()
                .click(screen.getByRole('button', { name: '나중에' }));
            expect(
                track.mock.calls.some(([event]) => event === 'nudge_clicked')
            ).toBe(false);
        });
    });
});
