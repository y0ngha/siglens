import { render, screen } from '@testing-library/react';
import { INDICATOR_META } from '../../model/indicatorRegistry';
import { ChartHeaderBar } from '../../ui/ChartHeaderBar';

const renderBar = (showIndicatorMenu?: boolean) =>
    render(
        <ChartHeaderBar
            indicatorBindings={[
                { meta: INDICATOR_META.rsi!, active: true, onToggle: vi.fn() },
            ]}
            {...(showIndicatorMenu === undefined ? {} : { showIndicatorMenu })}
            overlayItems={[
                { key: 'p1', kind: 'pattern', label: 'Double Bottom' },
            ]}
            hiddenOverlayKeys={new Set()}
            onSetOverlayVisible={vi.fn()}
            overlayItemColors={new Map()}
        />
    );

describe('ChartHeaderBar', () => {
    it('기본으로 보조지표 메뉴를 그린다', () => {
        renderBar();
        expect(
            screen.getByRole('button', { name: /^보조지표/ })
        ).toBeInTheDocument();
    });

    it('showIndicatorMenu가 false면 보조지표 메뉴 없이 작도 메뉴만 그린다', () => {
        renderBar(false);
        expect(screen.queryByRole('button', { name: /^보조지표/ })).toBeNull();
        expect(
            screen.getByRole('button', { name: /^차트 작도/ })
        ).toBeInTheDocument();
    });
});
