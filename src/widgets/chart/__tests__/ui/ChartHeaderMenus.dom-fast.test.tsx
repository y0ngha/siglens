import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useExclusiveChartMenu } from '../../hooks/useExclusiveChartMenu';
import { INDICATOR_META } from '../../model/indicatorRegistry';
import { ChartOverlayMenu } from '../../ui/ChartOverlayMenu';
import { ChartSettingsMenu } from '../../ui/ChartSettingsMenu';
import { IndicatorMenu } from '../../ui/IndicatorMenu';

/** 헤더 띠와 같은 구성 — 메뉴 셋이 한 `useExclusiveChartMenu`를 공유한다. */
function Strip() {
    const { bind } = useExclusiveChartMenu();
    return (
        <div>
            <IndicatorMenu
                menu={bind('indicators')}
                bindings={[
                    {
                        meta: INDICATOR_META.rsi!,
                        active: true,
                        onToggle: vi.fn(),
                    },
                ]}
            />
            <ChartOverlayMenu
                menu={bind('overlays')}
                items={[{ key: 'p1', kind: 'pattern', label: 'Double Bottom' }]}
                hiddenKeys={new Set()}
                onSetVisible={vi.fn()}
                rightExtend={{ checked: true, onChange: vi.fn() }}
            />
            <ChartSettingsMenu
                menu={bind('settings')}
                extendedHours={{ checked: true, onChange: vi.fn() }}
            />
        </div>
    );
}

const indicators = () => screen.getByRole('button', { name: /^보조지표/ });
const overlays = () => screen.getByRole('button', { name: /^차트 작도/ });
const gear = () => screen.getByRole('button', { name: '차트 설정' });
const openGroups = () => screen.queryAllByRole('group');

describe('차트 헤더 메뉴 셋', () => {
    it('헤더 순서는 보조지표 → 차트 작도 → 차트 설정이다', () => {
        render(<Strip />);
        const names = screen
            .getAllByRole('button')
            .map(b => b.getAttribute('aria-label'));
        expect(names).toEqual(['보조지표 (1)', '차트 작도 (1)', '차트 설정']);
    });

    it('한 번에 하나만 열린다 — 다른 메뉴 트리거를 누르면 열려 있던 메뉴가 닫힌다', async () => {
        const user = userEvent.setup();
        render(<Strip />);

        await user.click(indicators());
        expect(openGroups()).toHaveLength(1);
        expect(
            screen.getByRole('group', { name: '보조지표 설정' })
        ).toBeVisible();

        await user.click(overlays());
        expect(openGroups()).toHaveLength(1);
        expect(screen.getByRole('group', { name: '차트 작도' })).toBeVisible();
        expect(indicators()).toHaveAttribute('aria-expanded', 'false');

        await user.click(gear());
        expect(openGroups()).toHaveLength(1);
        expect(screen.getByRole('group', { name: '차트 설정' })).toBeVisible();
        expect(overlays()).toHaveAttribute('aria-expanded', 'false');

        await user.click(indicators());
        expect(openGroups()).toHaveLength(1);
        expect(gear()).toHaveAttribute('aria-expanded', 'false');
    });

    it('바깥을 누르거나 Escape를 누르면 열린 메뉴가 닫힌다', async () => {
        const user = userEvent.setup();
        render(<Strip />);
        await user.click(overlays());
        await user.click(document.body);
        expect(openGroups()).toHaveLength(0);
        await user.click(gear());
        await user.keyboard('{Escape}');
        expect(openGroups()).toHaveLength(0);
    });

    it('열린 메뉴의 트리거를 다시 누르면 닫히고, 다른 메뉴는 영향받지 않는다', async () => {
        const user = userEvent.setup();
        render(<Strip />);
        await user.click(indicators());
        await user.click(indicators());
        expect(openGroups()).toHaveLength(0);
    });

    it('모든 패널은 data-chart-popover를 달아 PWA 배너·FAB 숨김 규칙에 걸린다', async () => {
        const user = userEvent.setup();
        render(<Strip />);
        for (const trigger of [indicators, overlays, gear]) {
            await user.click(trigger());
            expect(
                document.querySelector('[data-chart-popover]')
            ).not.toBeNull();
            await user.keyboard('{Escape}');
            expect(document.querySelector('[data-chart-popover]')).toBeNull();
        }
    });
});
