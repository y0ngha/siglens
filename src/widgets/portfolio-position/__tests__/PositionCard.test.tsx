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
    m: PositionModel = model(input),
    symbol = 'AAPL'
) {
    return render(
        <PositionCard
            symbol={symbol}
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

    it('미국 종목(symbol=AAPL)은 가격 리드아웃을 $ 표기로 렌더한다', () => {
        const { getByText } = renderCard(
            { low52w: 100, high52w: 200, avg: 150, current: 180 },
            undefined,
            'AAPL'
        );
        expect(getByText('$200')).toBeInTheDocument(); // 최근 고점
        expect(getByText('$100')).toBeInTheDocument(); // 최근 저점
        expect(getByText('$180')).toBeInTheDocument(); // 현재가
        expect(getByText('$150')).toBeInTheDocument(); // 내 평단
    });

    it('한국 상장 종목(symbol=005930.KS)은 가격 리드아웃을 $가 아니라 ₩ 표기로 렌더한다', () => {
        const { getByText, queryByText } = renderCard(
            {
                low52w: 50_900,
                high52w: 88_800,
                avg: 274_500,
                current: 80_000,
            },
            undefined,
            '005930.KS'
        );
        expect(getByText('₩88,800')).toBeInTheDocument(); // 최근 고점
        expect(getByText('₩50,900')).toBeInTheDocument(); // 최근 저점
        expect(getByText('₩80,000')).toBeInTheDocument(); // 현재가
        expect(getByText('₩274,500')).toBeInTheDocument(); // 내 평단
        expect(queryByText(/\$/)).not.toBeInTheDocument();
    });

    it('sub-$1 crypto 평단(예: avg=0.0006)은 "$0"으로 뭉개지지 않는다(회귀 방지 — PositionBuilding.test.tsx와 동일 케이스)', () => {
        const { getByText, queryByText } = renderCard(
            {
                low52w: 0.0004,
                high52w: 0.0009,
                avg: 0.0006,
                current: 0.0007,
            },
            undefined,
            'SHIB'
        );
        expect(getByText(/^\$0\.0006/)).toBeInTheDocument(); // 내 평단
        expect(getByText(/^\$0\.0007/)).toBeInTheDocument(); // 현재가
        expect(queryByText(/^\$0$/)).not.toBeInTheDocument();
    });

    it('원화 종목의 sub-1원 평단(예: avg=0.6)은 소수점 없이 정수로 반올림된다(원화는 소수 단위가 없다)', () => {
        const { getByText } = renderCard(
            {
                low52w: 0.3,
                high52w: 0.9,
                avg: 0.6,
                current: 0.6,
            },
            undefined,
            '005930.KS'
        );
        const avgValue = getByText('내 평단').nextElementSibling;
        expect(avgValue?.textContent).toBe('₩1');
        expect(avgValue?.textContent).not.toContain('.');
    });
});
