// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { useExclusiveChartMenu } from '@/widgets/chart/hooks/useExclusiveChartMenu';
import { IndicatorMenu } from '@/widgets/chart/ui/IndicatorMenu';
import {
    INDICATOR_META,
    type IndicatorBinding,
} from '@/widgets/chart/model/indicatorRegistry';

vi.mock('@/shared/lib/chartColors', () => ({
    getPeriodColor: (period: number) => `hsl(${period * 10}, 70%, 50%)`,
    /* 차트 크롬을 런타임 테마에서 읽는 리졸버. 테스트는 다크 고정이면 충분하다. */
    getChartChrome: () => ({
        background: '#1a1a2e',
        grid: '#2a2a3e',
        text: '#a0a0b0',
    }),
}));

function IndicatorMenuHarness(
    props: Omit<ComponentProps<typeof IndicatorMenu>, 'menu'>
) {
    const { bind } = useExclusiveChartMenu();
    return <IndicatorMenu menu={bind('indicators')} {...props} />;
}

interface FlowCallbacks {
    onToggleRsi: ReturnType<typeof vi.fn<() => void>>;
    onToggleMaPeriod: ReturnType<typeof vi.fn<(period: number) => void>>;
}

function makeBindings(cb: FlowCallbacks): IndicatorBinding[] {
    return [
        {
            meta: INDICATOR_META.ma,
            active: false,
            availablePeriods: [5, 10, 20, 50, 100, 200],
            visiblePeriods: [],
            onTogglePeriod: cb.onToggleMaPeriod,
        },
        { meta: INDICATOR_META.rsi, active: false, onToggle: cb.onToggleRsi },
        { meta: INDICATOR_META.bollinger, active: false, onToggle: vi.fn() },
        {
            meta: INDICATOR_META.volumeProfile,
            active: false,
            onToggle: vi.fn(),
        },
    ];
}

function makeCallbacks(): FlowCallbacks {
    return {
        onToggleRsi: vi.fn<() => void>(),
        onToggleMaPeriod: vi.fn<(period: number) => void>(),
    };
}

describe('Chart Indicator Flow (settings popover, real popover hooks)', () => {
    it('shows the gear trigger and keeps the popover closed initially', () => {
        render(
            <IndicatorMenuHarness bindings={makeBindings(makeCallbacks())} />
        );
        expect(
            screen.getByRole('button', { name: /^보조지표/ })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('group', { name: '보조지표 설정' })
        ).not.toBeInTheDocument();
    });

    it('opens the popover and groups indicators by category when the gear is clicked', async () => {
        const user = userEvent.setup();
        render(
            <IndicatorMenuHarness bindings={makeBindings(makeCallbacks())} />
        );
        await user.click(screen.getByRole('button', { name: /^보조지표/ }));
        expect(
            screen.getByRole('group', { name: '보조지표 설정' })
        ).toBeInTheDocument();
        expect(screen.getByText('추세')).toBeInTheDocument();
        expect(screen.getByText('모멘텀')).toBeInTheDocument();
        expect(screen.getByText('변동성')).toBeInTheDocument();
        expect(screen.getByText('볼륨')).toBeInTheDocument();
        expect(screen.queryByText('SMC')).not.toBeInTheDocument();
    });

    it('calls the RSI toggle when its checkbox is clicked', async () => {
        const cb = makeCallbacks();
        const user = userEvent.setup();
        render(<IndicatorMenuHarness bindings={makeBindings(cb)} />);
        await user.click(screen.getByRole('button', { name: /^보조지표/ }));
        await user.click(screen.getByRole('checkbox', { name: /RSI/ }));
        expect(cb.onToggleRsi).toHaveBeenCalledTimes(1);
    });

    it('calls the MA period toggle when a period chip is clicked', async () => {
        const cb = makeCallbacks();
        const user = userEvent.setup();
        render(<IndicatorMenuHarness bindings={makeBindings(cb)} />);
        await user.click(screen.getByRole('button', { name: /^보조지표/ }));
        await user.click(screen.getByRole('button', { name: /^20$/ }));
        expect(cb.onToggleMaPeriod).toHaveBeenCalledWith(20);
    });

    it('closes the popover when the gear is clicked again', async () => {
        const user = userEvent.setup();
        render(
            <IndicatorMenuHarness bindings={makeBindings(makeCallbacks())} />
        );
        const gear = screen.getByRole('button', { name: /^보조지표/ });
        await user.click(gear);
        expect(
            screen.getByRole('group', { name: '보조지표 설정' })
        ).toBeInTheDocument();
        await user.click(gear);
        expect(
            screen.queryByRole('group', { name: '보조지표 설정' })
        ).not.toBeInTheDocument();
    });

    it('closes the popover on Escape and on an outside click', async () => {
        const user = userEvent.setup();
        render(
            <div>
                <button type="button">outside</button>
                <IndicatorMenuHarness
                    bindings={makeBindings(makeCallbacks())}
                />
            </div>
        );
        const gear = screen.getByRole('button', { name: /^보조지표/ });
        const group = () =>
            screen.queryByRole('group', { name: '보조지표 설정' });
        await user.click(gear);
        expect(group()).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(group()).not.toBeInTheDocument();
        await user.click(gear);
        expect(group()).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'outside' }));
        expect(group()).not.toBeInTheDocument();
    });

    describe('focus (real useFocusTrap)', () => {
        it('moves focus into the panel when it opens', async () => {
            const user = userEvent.setup();
            render(
                <IndicatorMenuHarness
                    bindings={makeBindings(makeCallbacks())}
                />
            );
            await user.click(screen.getByRole('button', { name: /^보조지표/ }));
            const panel = screen.getByRole('group', { name: '보조지표 설정' });
            expect(panel.contains(document.activeElement)).toBe(true);
            expect(document.activeElement).not.toBe(document.body);
        });

        it('returns focus to the gear on Escape', async () => {
            const user = userEvent.setup();
            render(
                <IndicatorMenuHarness
                    bindings={makeBindings(makeCallbacks())}
                />
            );
            const gear = screen.getByRole('button', { name: /^보조지표/ });
            await user.click(gear);
            await user.keyboard('{Escape}');
            expect(
                screen.queryByRole('group', { name: '보조지표 설정' })
            ).not.toBeInTheDocument();
            expect(gear).toHaveFocus();
        });

        it('lets an outside click close the panel without stealing focus back to the gear', async () => {
            const user = userEvent.setup();
            render(
                <div>
                    <button type="button">outside</button>
                    <IndicatorMenuHarness
                        bindings={makeBindings(makeCallbacks())}
                    />
                </div>
            );
            const gear = screen.getByRole('button', { name: /^보조지표/ });
            const outside = screen.getByRole('button', { name: 'outside' });
            await user.click(gear);
            await user.click(outside);
            expect(
                screen.queryByRole('group', { name: '보조지표 설정' })
            ).not.toBeInTheDocument();
            expect(outside).toHaveFocus();
            expect(gear).not.toHaveFocus();
        });

        it('wraps Tab from the last control back to the first inside the panel', async () => {
            const user = userEvent.setup();
            render(
                <IndicatorMenuHarness
                    bindings={makeBindings(makeCallbacks())}
                />
            );
            await user.click(screen.getByRole('button', { name: /^보조지표/ }));
            const panel = screen.getByRole('group', { name: '보조지표 설정' });
            const controls = panel.querySelectorAll<HTMLElement>(
                'button, input:not([disabled])'
            );
            const first = controls[0]!;
            controls[controls.length - 1]!.focus();
            await user.tab();
            expect(first).toHaveFocus();
        });
    });
});
