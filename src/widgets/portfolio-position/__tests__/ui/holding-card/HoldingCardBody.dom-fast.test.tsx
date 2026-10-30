import { render, screen } from '@testing-library/react';
import { HoldingCardBody } from '@/widgets/portfolio-position/ui/holding-card/HoldingCardBody';
import { computePosition } from '@/widgets/portfolio-position/utils/positionGeometry';

const facts = { low52w: 100, high52w: 200, lastClose: 180 };
const model = computePosition({ ...facts, current: facts.lastClose, avg: 150 });

function renderBody(
    overrides: Partial<Parameters<typeof HoldingCardBody>[0]> = {}
) {
    return render(
        <HoldingCardBody
            symbol="AAPL"
            avg={150}
            isPending={false}
            isError={false}
            facts={facts}
            model={model}
            {...overrides}
        />
    );
}

describe('HoldingCardBody', () => {
    it('평단이 무효면 다른 상태보다 먼저 평단 확인 안내를 보이고 평단 값은 찍지 않는다', () => {
        renderBody({ avg: null, isPending: true, isError: true });
        const degraded = screen.getByTestId('holding-card-degraded');
        expect(degraded).toHaveTextContent('평단을 확인해 주세요');
        expect(degraded.textContent).not.toMatch(/\$/);
        expect(screen.queryByTestId('holding-card-loading')).toBeNull();
    });

    it('대기 중이면 로딩 자리를 보인다', () => {
        renderBody({ isPending: true });
        expect(screen.getByTestId('holding-card-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('position-building')).toBeNull();
    });

    it.each([
        ['받기 실패', { isError: true }],
        ['범위 계산 불가', { model: null }],
        ['봉 없음', { facts: null, model: null }],
    ])('%s면 실패 안내와 평단을 보인다', (_label, overrides) => {
        renderBody(overrides);
        const degraded = screen.getByTestId('holding-card-degraded');
        expect(degraded).toHaveTextContent('$150');
        expect(screen.queryByTestId('position-building')).toBeNull();
    });

    it('정상이면 빌딩과 숫자 표를 그린다', () => {
        renderBody();
        expect(screen.getByTestId('position-building')).toBeInTheDocument();
        expect(screen.getByText('평단')).toBeInTheDocument();
        expect(screen.queryByTestId('holding-card-degraded')).toBeNull();
    });
});
