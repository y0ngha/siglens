import { render } from '@testing-library/react';
import { computePositionStatus } from '../lib/positionStatus';
import type { PositionStatus } from '../lib/positionStatus';
import { PositionStatusSummary } from '../ui/PositionStatusSummary';

function status(
    overrides: Partial<Parameters<typeof computePositionStatus>[0]> = {}
): PositionStatus {
    return computePositionStatus({
        low52w: 100,
        high52w: 200,
        current: 180,
        avg: 150,
        quantity: 10,
        ...overrides,
    }) as PositionStatus;
}

describe('PositionStatusSummary', () => {
    it('status가 null이면 아무것도 렌더하지 않는다', () => {
        const { container } = render(
            <PositionStatusSummary
                status={null}
                avgRaw="150"
                quantityRaw="10"
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('평단·수량을 trimTrailingZeros로 다듬어 표시한다', () => {
        const { getByText } = render(
            <PositionStatusSummary
                status={status()}
                avgRaw="150.00000000"
                quantityRaw="10.50000000"
            />
        );
        expect(getByText('$150 · 10.5주')).toBeInTheDocument();
    });

    it('평가손익이 양수면 ui-success-text, 수익률도 양수면 ui-success-text', () => {
        // avg=150, current=180, quantity=10 → pnl=+300, returnPct=+20
        const { getByText } = render(
            <PositionStatusSummary
                status={status()}
                avgRaw="150"
                quantityRaw="10"
            />
        );
        const pnlValue = getByText('+$300.00');
        expect(pnlValue.className).toContain('text-ui-success-text');
        expect(pnlValue.className).not.toContain('text-ui-danger-text');

        const returnValue = getByText('+20.0%');
        expect(returnValue.className).toContain('text-ui-success-text');
    });

    it('평가손익·수익률이 음수면 ui-danger-text를 사용한다', () => {
        // avg=180, current=150, quantity=5 → pnl=-150, returnPct≈-16.7
        const { getByText } = render(
            <PositionStatusSummary
                status={status({ avg: 180, current: 150, quantity: 5 })}
                avgRaw="180"
                quantityRaw="5"
            />
        );
        const pnlValue = getByText('-$150.00');
        expect(pnlValue.className).toContain('text-ui-danger-text');

        const returnValue = getByText('-16.7%');
        expect(returnValue.className).toContain('text-ui-danger-text');
    });

    it('범위 내 위치·고점/저점까지 거리는 손익 색상 토큰을 쓰지 않는다(중립적 사실)', () => {
        const { getByText } = render(
            <PositionStatusSummary
                status={status()}
                avgRaw="150"
                quantityRaw="10"
            />
        );
        const rangeValue = getByText('80% 지점');
        expect(rangeValue.className).not.toContain('text-ui-success-text');
        expect(rangeValue.className).not.toContain('text-ui-danger-text');

        const highDistance = getByText('+11.1%');
        expect(highDistance.className).not.toContain('text-ui-success-text');
        expect(highDistance.className).not.toContain('text-ui-danger-text');
    });

    it('sub-$1 자산(평단 $0.0001)도 dynamicDecimals로 0으로 뭉개지지 않고 손익이 정확히 표시된다', () => {
        // avg=0.0001, current=0.0002, quantity=1000 → pnl=(0.0002-0.0001)*1000=0.1
        const { getByText } = render(
            <PositionStatusSummary
                status={status({
                    low52w: 0.00005,
                    high52w: 0.0003,
                    avg: 0.0001,
                    current: 0.0002,
                    quantity: 1000,
                })}
                avgRaw="0.00010000"
                quantityRaw="1000"
            />
        );
        expect(getByText('$0.0001 · 1000주')).toBeInTheDocument();
        expect(getByText('+$0.10000')).toBeInTheDocument();
    });

    it('aria-label에 평가손익·수익률·범위·거리 요약이 담긴다', () => {
        const { getByRole } = render(
            <PositionStatusSummary
                status={status()}
                avgRaw="150"
                quantityRaw="10"
            />
        );
        const section = getByRole('region', { name: /평가손익 \+\$300\.00/ });
        expect(section).toBeInTheDocument();
    });
});
