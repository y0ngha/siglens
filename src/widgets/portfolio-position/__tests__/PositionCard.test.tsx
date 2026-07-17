import { render } from '@testing-library/react';
import { computePosition, type PositionModel } from '../lib/positionGeometry';
import { PositionCard } from '../ui/PositionCard';

function model(overrides: Partial<Parameters<typeof computePosition>[0]> = {}) {
    return computePosition({
        low52w: 100,
        high52w: 200,
        current: 180,
        avg: 150,
        ...overrides,
    }) as PositionModel;
}

function renderCard(
    input: Partial<Parameters<typeof computePosition>[0]> = {},
    m: PositionModel = model(input)
) {
    return render(
        <PositionCard
            symbol="AAPL"
            model={m}
            low52w={input.low52w ?? 100}
            high52w={input.high52w ?? 200}
            current={input.current ?? 180}
            avg={input.avg ?? 150}
        />
    );
}

describe('PositionCard', () => {
    it('수익률이 양수면(returnPct >= 0) 수익률 리드아웃이 ui-success-text, 최근 고점 대비(음수)는 ui-danger-text를 사용한다', () => {
        // avg=150, current=180 → returnPct=+20 (양수), pctFromHigh=(150-200)/200*100=-25 (음수)
        const { getByText } = renderCard({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 180,
        });

        const returnValue = getByText('+20.0%');
        expect(returnValue.className).toContain('text-ui-success-text');
        expect(returnValue.className).not.toContain('text-ui-danger-text');

        const pctFromHighValue = getByText('-25.0%');
        expect(pctFromHighValue.className).toContain('text-ui-danger-text');
        expect(pctFromHighValue.className).not.toContain(
            'text-ui-success-text'
        );
    });

    it('수익률이 음수면(returnPct < 0) 수익률 리드아웃이 ui-danger-text를 사용한다', () => {
        // avg=180, current=150 → returnPct=(150-180)/180*100≈-16.7 (음수)
        const { getByText } = renderCard({
            low52w: 100,
            high52w: 200,
            avg: 180,
            current: 150,
        });

        const returnValue = getByText('-16.7%');
        expect(returnValue.className).toContain('text-ui-danger-text');
        expect(returnValue.className).not.toContain('text-ui-success-text');
    });

    it('텍스트 리드아웃에는 chart-bullish/chart-bearish 클래스를 사용하지 않는다(그래픽 전용, DESIGN.md §AA)', () => {
        const { container } = renderCard({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 180,
        });

        expect(container.querySelector('.chart-bullish')).toBeNull();
        expect(container.querySelector('.chart-bearish')).toBeNull();
    });
});
