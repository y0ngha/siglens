import { render, screen } from '@testing-library/react';
import { PositionCta } from '../ui/PositionCta';

describe('PositionCta', () => {
    it('미국 종목(symbol=AAPL)은 최근 범위를 $ 표기로 렌더한다', () => {
        render(<PositionCta symbol="AAPL" low52w={100} high52w={200} />);
        expect(screen.getByTestId('position-cta-range').textContent).toBe(
            '최근 범위 $100 ~ $200'
        );
    });

    it('한국 상장 종목(symbol=005930.KS)은 최근 범위를 $가 아니라 ₩ 표기로 렌더한다', () => {
        render(
            <PositionCta symbol="005930.KS" low52w={50_900} high52w={88_800} />
        );
        expect(screen.getByTestId('position-cta-range').textContent).toBe(
            '최근 범위 ₩50,900 ~ ₩88,800'
        );
    });

    it('sub-$1 crypto 범위(예: low52w=0.0004, high52w=0.0009)는 "$0"으로 뭉개지지 않는다(회귀 방지 — PositionBuilding.test.tsx와 동일 케이스)', () => {
        render(<PositionCta symbol="SHIB" low52w={0.0004} high52w={0.0009} />);
        expect(screen.getByTestId('position-cta-range').textContent).toBe(
            '최근 범위 $0.0004000 ~ $0.0009000'
        );
    });

    it('low52w/high52w가 null이면 심볼과 무관하게 범위 라인을 렌더하지 않는다', () => {
        render(<PositionCta symbol="005930.KS" low52w={null} high52w={null} />);
        expect(
            screen.queryByTestId('position-cta-range')
        ).not.toBeInTheDocument();
    });
});
