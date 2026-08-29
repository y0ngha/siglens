import { render, screen } from '@testing-library/react';
import { OverlayLegend } from '@/widgets/chart/OverlayLegend';
import type { OverlayLegendItem } from '@/widgets/chart/types';
import type { OverlayGroup } from '@/widgets/chart/utils/overlayLegendFormat';

vi.mock('@/widgets/chart/hooks/useOverlayGroups', () => ({
    useOverlayGroups: (items: OverlayLegendItem[]): OverlayGroup[] => {
        if (items.length === 0) return [];
        return [{ key: 'TestGroup', items }];
    },
}));

describe('OverlayLegend', () => {
    it('returns null when items is empty', () => {
        const { container } = render(<OverlayLegend items={[]} />);

        expect(container.firstChild).toBeNull();
    });

    it('renders item names and formatted values', () => {
        const items: OverlayLegendItem[] = [
            { name: 'MA(5)', color: '#ff0000', value: 100.5 },
            { name: 'MA(20)', color: '#00ff00', value: null },
        ];

        render(<OverlayLegend items={items} />);

        expect(screen.getByText(/MA\(5\)/)).toBeInTheDocument();
        expect(screen.getByText(/100\.50/)).toBeInTheDocument();
        expect(screen.getByText(/MA\(20\)/)).toBeInTheDocument();
        expect(screen.getByText(/-/)).toBeInTheDocument();
    });

    it('renders the bullet character for each item', () => {
        const items: OverlayLegendItem[] = [
            { name: 'RSI', color: '#ff0000', value: 70 },
        ];

        render(<OverlayLegend items={items} />);

        expect(screen.getByText(/●/)).toBeInTheDocument();
    });

    it('applies the decimals prop so crypto sub-cent overlays are not flattened', () => {
        const items: OverlayLegendItem[] = [
            { name: 'MA(20)', color: '#00ff00', value: 0.058158 },
        ];

        // decimals=5 mirrors the candlestick precision for a sub-cent token;
        // without it the value would collapse to 0.06 (the wiring-gap bug).
        render(<OverlayLegend items={items} decimals={5} />);

        expect(screen.getByText(/0\.05816/)).toBeInTheDocument();
    });

    /**
     * 범례는 캔들·지표선 위에 뜬다. 배경이 없으면 대비가 뒤에 그려진 내용에
     * 좌우돼 다크 33행 중 11행이 4.5:1 아래로(최악 1.14:1) 떨어졌다.
     * `secondary-900`은 두 테마에서 차트 배경과 같은 값이라 "빈 배경 위"
     * 실측치를 그대로 보장한다.
     */
    it('paints an opaque backdrop so contrast does not depend on what is behind', () => {
        const { container } = render(
            <OverlayLegend
                items={[{ name: 'MA(5)', color: '#ff0000', value: 100 }]}
            />
        );

        expect(container.firstElementChild).toHaveClass('bg-secondary-900');
    });

    it('does not bound itself before the pane has been measured', () => {
        const items: OverlayLegendItem[] = Array.from(
            { length: 12 },
            (_, i) => ({ name: `MA(${i})`, color: '#ff0000', value: 100 })
        );

        const { container } = render(<OverlayLegend items={items} />);

        // 첫 페인트에 접었다 펴면 깜빡인다 — 재기 전에는 제한하지 않는다.
        expect(container.querySelectorAll('span')).toHaveLength(
            items.length * 2
        );
        expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
    });

    it('clips to the price pane and reports the hidden count', () => {
        const items: OverlayLegendItem[] = Array.from(
            { length: 12 },
            (_, i) => ({
                name: `MA(${i})`,
                color: '#ff0000',
                value: 311.54,
            })
        );

        // 감사 실패 케이스: 246px 폭 차트, 보조 pane 3개일 때의 가격 pane.
        const { container } = render(
            <OverlayLegend
                items={items}
                pricePaneHeightPx={110}
                chartWidthPx={246}
            />
        );

        const chip = screen.getByText(/^\+\d+$/);
        const hidden = Number(chip.textContent?.slice(1));
        // 상자에 남은 항목 수 = 전체 - 접힌 수. 조용히 사라진 항목이 없어야 한다.
        const shown = container.querySelectorAll('.font-mono').length - 1;

        expect(hidden).toBeGreaterThan(0);
        expect(shown + hidden).toBe(items.length);
    });

    it('caps the box height at the price pane', () => {
        const items: OverlayLegendItem[] = Array.from(
            { length: 12 },
            (_, i) => ({ name: `MA(${i})`, color: '#ff0000', value: 311.54 })
        );

        const { container } = render(
            <OverlayLegend
                items={items}
                pricePaneHeightPx={110}
                chartWidthPx={246}
            />
        );

        // 줄 수 계산이 어긋나도 이 상한이 pane 밖으로 나가는 것을 막는다.
        expect(container.firstElementChild).toHaveStyle({
            maxHeight: '94px',
        });
        expect(container.firstElementChild).toHaveClass('overflow-hidden');
    });
});
