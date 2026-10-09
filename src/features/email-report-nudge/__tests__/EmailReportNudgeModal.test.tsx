import { render, screen, waitFor } from '@testing-library/react';
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

const watchlist = vi.hoisted(() => ({
    items: [] as Array<{ symbol: string }>,
    hydrated: true,
    identityPending: false,
    toggle: vi.fn(),
}));
vi.mock('@/features/watchlist/hooks/useWatchlist', () => ({
    useWatchlist: () => ({
        items: watchlist.items,
        has: (symbol: string) =>
            watchlist.items.some(i => i.symbol === symbol.toUpperCase()),
        toggle: watchlist.toggle,
        isHydrated: watchlist.hydrated,
        isIdentityPending: watchlist.identityPending,
        isAtLimit: false,
        limit: 50,
    }),
}));

const ADD_CTA = '관심종목에 담아 메일로 받기';

describe('EmailReportNudgeModal', () => {
    beforeEach(() => {
        track.mockReset();
        watchlist.items = [];
        watchlist.hydrated = true;
        watchlist.identityPending = false;
        watchlist.toggle.mockReset();
        watchlist.toggle.mockResolvedValue('added');
    });

    it('설정 권유는 보유·관심 종목 수를 알리고 넛지 출처를 달아 설정 페이지로 보낸다', () => {
        render(
            <EmailReportNudgeModal
                nudge={{ kind: 'setup', symbolCount: 4 }}
                onClose={vi.fn()}
            />
        );

        expect(
            screen.getByRole('heading', {
                name: '보유·관심종목 리포트를 메일로 받아보세요',
            })
        ).toBeInTheDocument();
        expect(screen.getByText(/보유·관심종목 4개의/)).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '메일 리포트 설정하기' })
        ).toHaveAttribute('href', '/email-report?from=nudge');
    });

    it('종목 권유 CTA는 페이지 이동 없이 관심종목 담기를 nudge 출처로 실행한다', async () => {
        render(
            <EmailReportNudgeModal
                nudge={{ kind: 'symbol', symbol: '005930.KS' }}
                onClose={vi.fn()}
            />
        );

        expect(
            screen.getByText(/005930\.KS을\(를\) 관심종목에 담으면/)
        ).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: ADD_CTA }));

        expect(watchlist.toggle).toHaveBeenCalledWith(
            { symbol: '005930.KS', label: '005930.KS' },
            'nudge'
        );
    });

    it('담긴 뒤에는 CTA 대신 "담았어요" 상태를 보이고 다시 토글하지 않는다', () => {
        watchlist.items = [{ symbol: 'TSLA' }];
        render(
            <EmailReportNudgeModal
                nudge={{ kind: 'symbol', symbol: 'TSLA' }}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByRole('status')).toHaveTextContent(
            '담았어요 — 다음 리포트부터 포함돼요'
        );
        expect(
            screen.queryByRole('button', { name: ADD_CTA })
        ).not.toBeInTheDocument();
    });

    it.each(['at_limit', 'failed'] as const)(
        '담기가 %s로 끝나면 "담았어요"를 보이지 않고 CTA를 그대로 둔다',
        async outcome => {
            watchlist.toggle.mockResolvedValue(outcome);
            render(
                <EmailReportNudgeModal
                    nudge={{ kind: 'symbol', symbol: 'TSLA' }}
                    onClose={vi.fn()}
                />
            );

            await userEvent
                .setup()
                .click(screen.getByRole('button', { name: ADD_CTA }));

            await waitFor(() =>
                expect(
                    screen.getByRole('button', { name: ADD_CTA })
                ).toBeEnabled()
            );
            expect(screen.getByRole('status')).toBeEmptyDOMElement();
        }
    );

    it.each([
        ['하이드레이션 전', () => (watchlist.hydrated = false)],
        ['회원 여부 미확정', () => (watchlist.identityPending = true)],
    ])('관심종목이 %s이면 CTA를 누를 수 없다', (_, arrange) => {
        arrange();
        render(
            <EmailReportNudgeModal
                nudge={{ kind: 'symbol', symbol: 'TSLA' }}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: ADD_CTA })).toHaveAttribute(
            'aria-disabled',
            'true'
        );
    });

    it('담기 진행 중에는 CTA가 aria-disabled이고 포커스를 유지하며 다시 눌러도 토글하지 않는다', async () => {
        watchlist.toggle.mockReturnValue(new Promise(() => {}));
        render(
            <EmailReportNudgeModal
                nudge={{ kind: 'symbol', symbol: 'TSLA' }}
                onClose={vi.fn()}
            />
        );
        const user = userEvent.setup();
        const cta = screen.getByRole('button', { name: ADD_CTA });

        await user.click(cta);
        await user.click(cta);

        expect(cta).toHaveAttribute('aria-disabled', 'true');
        expect(cta).toHaveFocus();
        expect(watchlist.toggle).toHaveBeenCalledTimes(1);
    });

    it('담김 상태로 바뀌면 포커스가 모달 안(상태 문구)에 남는다', async () => {
        const { rerender } = render(
            <EmailReportNudgeModal
                nudge={{ kind: 'symbol', symbol: 'TSLA' }}
                onClose={vi.fn()}
            />
        );
        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: ADD_CTA }));
        watchlist.items = [{ symbol: 'TSLA' }];
        rerender(
            <EmailReportNudgeModal
                nudge={{ kind: 'symbol', symbol: 'TSLA' }}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByRole('status')).toHaveFocus();
        expect(screen.getByRole('dialog')).toContainElement(
            document.activeElement as HTMLElement
        );
    });

    it('나중에·이동 버튼 모두 모달을 닫는다', async () => {
        const onClose = vi.fn();
        render(
            <EmailReportNudgeModal
                nudge={{ kind: 'setup', symbolCount: 1 }}
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
        it('설정 권유는 nudge_shown{member_setup}, CTA는 cta=settings', async () => {
            render(
                <EmailReportNudgeModal
                    nudge={{ kind: 'setup', symbolCount: 2 }}
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

        it('종목 권유는 nudge_shown{member_symbol}, CTA는 nudge_clicked 한 번(cta=add)', async () => {
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
                .click(screen.getByRole('button', { name: ADD_CTA }));
            expect(
                track.mock.calls.filter(([event]) => event === 'nudge_clicked')
            ).toEqual([
                ['nudge_clicked', { kind: 'member_symbol', cta: 'add' }],
            ]);
        });

        it('나중에 버튼은 nudge_clicked를 보내지 않는다', async () => {
            render(
                <EmailReportNudgeModal
                    nudge={{ kind: 'setup', symbolCount: 1 }}
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
