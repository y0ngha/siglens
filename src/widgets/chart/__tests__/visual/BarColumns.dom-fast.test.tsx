import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarColumns } from '@/widgets/chart/visual/BarColumns';

const group = (key: string, value: number | null, label = key) => ({
    key,
    label,
    title: key,
    bars: [{ id: 'v', value, fillClass: 'bg-primary-400' }],
});

describe('BarColumns', () => {
    it('음수가 없으면 기준선이 아래에 있고 양수 막대는 값에 비례한다', () => {
        const { container } = render(
            <BarColumns groups={[group('a', 10), group('b', 5)]} />
        );
        const bars = container.querySelectorAll<HTMLElement>('.bg-primary-400');
        expect(bars[0]?.style.height).toBe('100%');
        expect(bars[1]?.style.height).toBe('50%');
        expect(bars[0]?.style.top).toBe('0%');
        expect(bars[1]?.style.top).toBe('50%');
    });

    it('음수는 기준선 아래로 내려간다 — 기준선 위치는 값 범위가 정한다', () => {
        const { container } = render(
            <BarColumns groups={[group('up', 30), group('down', -10)]} />
        );
        const [up, down] = Array.from(
            container.querySelectorAll<HTMLElement>('.bg-primary-400')
        );
        // 범위 40(=30-(-10)): 기준선은 위에서 75%.
        expect(up?.style.top).toBe('0%');
        expect(up?.style.height).toBe('75%');
        expect(down?.style.top).toBe('75%');
        expect(down?.style.height).toBe('25%');
    });

    it('값이 null이면 막대를 그리지 않고, 모두 0이어도 깨지지 않는다', () => {
        const { container } = render(
            <BarColumns groups={[group('a', null), group('b', 0)]} />
        );
        const bars = container.querySelectorAll<HTMLElement>('.bg-primary-400');
        expect(bars).toHaveLength(1);
        expect(bars[0]?.style.height).toBe('0%');
    });

    it('한 그룹의 막대들은 나란히 선다', () => {
        const two = {
            key: 'k',
            label: 'k',
            title: 'k',
            bars: [
                { id: 'c', value: 3, fillClass: 'bg-chart-bullish' },
                { id: 'p', value: -3, fillClass: 'bg-chart-bearish' },
            ],
        };
        const side = render(<BarColumns groups={[two]} />);
        expect(
            side.container.querySelector<HTMLElement>('.bg-chart-bearish')
                ?.style.width
        ).toBe('50%');
        expect(
            side.container.querySelector<HTMLElement>('.bg-chart-bearish')
                ?.style.left
        ).toBe('50%');
    });

    it('눈금은 label이 있는 그룹에만 그린다', () => {
        const { getByText, queryByText } = render(
            <BarColumns
                groups={[
                    group('a', 1, 'A'),
                    group('b', 1, ''),
                    group('c', 1, 'C'),
                ]}
            />
        );
        expect(getByText('A')).toBeInTheDocument();
        expect(queryByText('B')).toBeNull();
    });

    it('그래픽은 스크린 리더에서 숨긴다', () => {
        const { container } = render(<BarColumns groups={[group('a', 1)]} />);
        expect(container.firstElementChild).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });
});
