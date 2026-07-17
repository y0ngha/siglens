import { render } from '@testing-library/react';
import { computePosition, type PositionModel } from '../lib/positionGeometry';
import { PositionGauge } from '../ui/PositionGauge';

function model(overrides: Partial<Parameters<typeof computePosition>[0]> = {}) {
    return computePosition({
        low52w: 100,
        high52w: 200,
        current: 180,
        avg: 150,
        ...overrides,
    }) as PositionModel;
}

function renderGauge(
    input: Partial<Parameters<typeof computePosition>[0]> = {},
    m: PositionModel = model(input)
) {
    return render(
        <PositionGauge
            symbol="AAPL"
            model={m}
            low52w={input.low52w ?? 100}
            high52w={input.high52w ?? 200}
            current={input.current ?? 180}
            avg={input.avg ?? 150}
        />
    );
}

function transformXY(el: Element | null): { x: number; y: number } {
    const transform = el?.getAttribute('transform') ?? '';
    const match = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(transform);
    if (!match) throw new Error(`no transform on ${el?.outerHTML}`);
    return { x: Number(match[1]), y: Number(match[2]) };
}

describe('PositionGauge', () => {
    it('marker 위치가 avgPos/currentPos를 반영한다 (avgPos < currentPos → avg가 더 아래)', () => {
        const { container } = renderGauge({
            low52w: 100,
            high52w: 200,
            avg: 150, // avgPos 0.5
            current: 180, // currentPos 0.8
        });
        const avg = transformXY(
            container.querySelector('[data-testid="avg-marker"]')
        );
        const current = transformXY(
            container.querySelector('[data-testid="current-marker"]')
        );
        // pos가 높을수록(고점에 가까울수록) y가 작다(SVG는 위가 0) — currentPos(0.8) >
        // avgPos(0.5)이므로 current marker의 y가 avg marker보다 작아야 한다.
        expect(current.y).toBeLessThan(avg.y);
    });

    it('aria-label에 평단/현재가/수익률/범위 위치%가 모두 포함된다', () => {
        const { container } = renderGauge({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 180,
        });
        const svg = container.querySelector('svg[role="img"]');
        const label = svg?.getAttribute('aria-label') ?? '';
        expect(label).toContain('AAPL');
        expect(label).toContain('$150');
        expect(label).toContain('$180');
        expect(label).toContain('수익률 +20.0%');
        expect(label).toContain('최근 범위의 50% 지점');
    });

    it('avg가 최근 고점보다 높으면(clamped=above) 고점 초과 안내를 노출한다', () => {
        const { getByText } = renderGauge({
            low52w: 100,
            high52w: 200,
            avg: 250,
            current: 220,
        });
        expect(getByText('최근 고점보다 높은 곳에서 매수')).toBeInTheDocument();
    });

    it('avg가 최근 저점보다 낮으면(clamped=below) 저점 미달 안내를 노출한다', () => {
        const { getByText } = renderGauge({
            low52w: 100,
            high52w: 200,
            avg: 50,
            current: 60,
        });
        expect(getByText('최근 저점보다 낮은 곳에서 매수')).toBeInTheDocument();
    });

    it('clamp되지 않으면(avgClamped=null) out-of-range 안내가 없다', () => {
        const { queryByText } = renderGauge({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 180,
        });
        expect(queryByText(/고점보다 높은/)).toBeNull();
        expect(queryByText(/저점보다 낮은/)).toBeNull();
    });

    it('밴드가 정확히 5개 렌더된다', () => {
        const { container } = renderGauge();
        expect(
            container.querySelectorAll('[data-testid="position-band"]')
        ).toHaveLength(5);
    });

    it('avg≈current(임계값 미만 차이)면 마커를 좌우로 dodge한다', () => {
        const { container } = renderGauge({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 151, // |avgPos - currentPos| = 0.01 < 0.04 epsilon
        });
        const avg = transformXY(
            container.querySelector('[data-testid="avg-marker"]')
        );
        const current = transformXY(
            container.querySelector('[data-testid="current-marker"]')
        );
        expect(avg.x).not.toBe(current.x);
        expect(avg.x).toBeLessThan(current.x);
    });

    it('avg/current가 충분히 떨어져 있으면(dodge 미적용) 마커가 같은 x(중앙)에 정렬된다', () => {
        const { container } = renderGauge({
            low52w: 100,
            high52w: 200,
            avg: 120,
            current: 180, // |avgPos - currentPos| = 0.6, dodge 미적용
        });
        const avg = transformXY(
            container.querySelector('[data-testid="avg-marker"]')
        );
        const current = transformXY(
            container.querySelector('[data-testid="current-marker"]')
        );
        expect(avg.x).toBe(current.x);
    });

    // 수익률 색상 토큰(ui-success-text/ui-danger-text)의 리드아웃은 PositionCard
    // 쪽 dl row 하나로 단일화됐다(중복 제거) — 색상 단언은 PositionCard.test.tsx가
    // 담당하고, 여기서는 Gauge가 더 이상 수익률 캡션을 렌더하지 않음을 확인한다.
    it('수익률 캡션을 중복 렌더하지 않는다(PositionCard의 dl row가 유일한 소스)', () => {
        const { container, queryByText } = renderGauge({
            avg: 150,
            current: 180,
        });
        expect(queryByText(/^수익률/)).toBeNull();
        expect(container.querySelector('.text-ui-success-text')).toBeNull();
        expect(container.querySelector('.text-ui-danger-text')).toBeNull();
    });

    it('아리아 레이블의 수익률 정밀도가 화면 표시(0.1 단위)와 동일하다(toFixed(1))', () => {
        const { container } = renderGauge({
            low52w: 100,
            high52w: 200,
            avg: 180,
            current: 150, // returnPct = (150-180)/180*100 ≈ -16.666...
        });
        const svg = container.querySelector('svg[role="img"]');
        const label = svg?.getAttribute('aria-label') ?? '';
        expect(label).toContain('수익률 -16.7%');
    });

    it('고가 종목(예: BRK.A대) in-SVG 마커 라벨은 축약 표기($XXXk)를 쓴다 — dl/aria-label은 전체 값 유지', () => {
        const { container } = renderGauge({
            low52w: 400_000,
            high52w: 700_000,
            avg: 600_000,
            current: 650_000,
        });
        const svg = container.querySelector('svg[role="img"]');
        // in-SVG 마커 라벨: 축약
        expect(svg?.textContent).toContain('$600K');
        expect(svg?.textContent).toContain('$650K');
        expect(svg?.textContent).not.toContain('$600,000');
        // aria-label: 정밀도 유지(전체 값)
        expect(svg?.getAttribute('aria-label')).toContain('$600,000');
        expect(svg?.getAttribute('aria-label')).toContain('$650,000');
    });
});
