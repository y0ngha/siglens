import { render } from '@testing-library/react';
import { computePosition, type PositionModel } from '../lib/positionGeometry';
import {
    AVG_LABEL_PREFIX,
    CURRENT_LABEL_PREFIX,
    estimateSvgLabelWidth,
    formatUsdCompactForSvgLabel,
    PositionBuilding,
    SVG_LABEL_AVAILABLE_WIDTH,
} from '../ui/PositionBuilding';

function model(overrides: Partial<Parameters<typeof computePosition>[0]> = {}) {
    return computePosition({
        low52w: 100,
        high52w: 200,
        current: 180,
        avg: 150,
        ...overrides,
    }) as PositionModel;
}

function renderBuilding(
    input: Partial<Parameters<typeof computePosition>[0]> = {},
    m: PositionModel = model(input)
) {
    return render(
        <PositionBuilding
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

describe('PositionBuilding', () => {
    it('층 볼륨이 정확히 5개 렌더된다', () => {
        const { container } = renderBuilding();
        expect(
            container.querySelectorAll('[data-testid="building-floor"]')
        ).toHaveLength(5);
    });

    it('★ 평단 마커와 ● 현재가 마커가 렌더되고, pos가 높을수록(고점에 가까울수록) y가 작다', () => {
        const { container } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 150, // avgPos 0.5
            current: 180, // currentPos 0.8
        });
        const avg = container.querySelector('[data-testid="avg-marker"]');
        const current = container.querySelector(
            '[data-testid="current-marker"]'
        );
        expect(avg).toBeInTheDocument();
        expect(current).toBeInTheDocument();
        const avgXY = transformXY(avg);
        const currentXY = transformXY(current);
        expect(currentXY.y).toBeLessThan(avgXY.y);
    });

    it('avg가 최근 고점보다 높으면(clamped=above) 옥상 위(하늘) 안내를 노출한다', () => {
        const { getByTestId, queryByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 250,
            current: 180,
        });
        expect(getByTestId('avg-out-of-range-note').textContent).toContain(
            '최근 고점보다 높은'
        );
        expect(queryByTestId('current-out-of-range-note')).toBeNull();
    });

    it('avg가 최근 저점보다 낮으면(clamped=below) 지하 안내를 노출한다', () => {
        const { getByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 50,
            current: 120,
        });
        expect(getByTestId('avg-out-of-range-note').textContent).toContain(
            '최근 저점보다 낮은'
        );
    });

    it('current가 최근 고점보다 높으면(clamped=above) — avg는 정상 범위여도 별도로 옥상 위 안내를 노출한다', () => {
        const { getByTestId, queryByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 250,
        });
        expect(getByTestId('current-out-of-range-note').textContent).toContain(
            '최근 고점보다 높은'
        );
        expect(queryByTestId('avg-out-of-range-note')).toBeNull();
    });

    it('current가 최근 저점보다 낮으면(clamped=below) 별도로 지하 안내를 노출한다', () => {
        const { getByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 40,
        });
        expect(getByTestId('current-out-of-range-note').textContent).toContain(
            '최근 저점보다 낮은'
        );
    });

    it('avg·current 둘 다 범위 안이면(clamped=null) out-of-range 안내가 없다', () => {
        const { queryByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 180,
        });
        expect(queryByTestId('avg-out-of-range-note')).toBeNull();
        expect(queryByTestId('current-out-of-range-note')).toBeNull();
    });

    it('avg≈current(임계값 미만 차이)면 마커를 좌우로 dodge한다', () => {
        const { container } = renderBuilding({
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
    });

    it('avg/current 분리가 6~12px 사이(구 epsilon 0.04 미만에서는 dodge 미적용이었던 구간)여도 dodge가 적용된다(audit finding #6)', () => {
        const { container } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 150, // avgPos 0.5
            current: 156, // currentPos 0.56 → |Δpos| = 0.06 (9px) — 구 0.04 epsilon 미만이라 dodge 안 됐던 구간
        });
        const avg = transformXY(
            container.querySelector('[data-testid="avg-marker"]')
        );
        const current = transformXY(
            container.querySelector('[data-testid="current-marker"]')
        );
        expect(avg.x).not.toBe(current.x);
    });

    it('avg/current가 충분히 떨어져 있으면(dodge 미적용) 마커가 같은 x(건물 정면 모서리)에 정렬된다', () => {
        const { container } = renderBuilding({
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

    it('수익 상태(returnPct > 0)에는 상승 계열 토큰 + 텍스트 라벨을 렌더한다', () => {
        const { getByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 180, // returnPct +20%
        });
        const readout = getByTestId('return-readout');
        expect(readout.textContent).toContain('수익률 +20.0%');
        expect(readout.className).toContain('text-ui-success-text');
    });

    it('손실 상태(returnPct < 0)에는 하락 계열 토큰 + 텍스트 라벨을 렌더한다', () => {
        const { getByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 180,
            current: 150, // returnPct < 0
        });
        const readout = getByTestId('return-readout');
        expect(readout.textContent).toContain('수익률 -16.7%');
        expect(readout.className).toContain('text-ui-danger-text');
    });

    it('break-even(avg===current, returnPct===0)에는 중립(secondary) 토큰을 렌더하고 크래시하지 않는다', () => {
        const { getByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 150,
        });
        const readout = getByTestId('return-readout');
        expect(readout.textContent).toContain('수익률 +0.0%');
        expect(readout.className).not.toContain('text-ui-success-text');
        expect(readout.className).not.toContain('text-ui-danger-text');
    });

    it('평가/추천 문구를 렌더하지 않는다(스코프 펜스 — 위치 서술만)', () => {
        const { container } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 120,
            current: 180,
        });
        const text = container.textContent ?? '';
        expect(text).not.toMatch(/좋은|잘함|추천|매수 타이밍/);
    });

    it('aria-label에 평단/현재가/수익률/범위 위치%가 모두 포함된다', () => {
        const { container } = renderBuilding({
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

    it('고가 종목(예: BRK.A대) in-SVG 라벨은 축약 표기($XXXK)를 쓴다 — aria-label은 전체 값 유지', () => {
        const { container } = renderBuilding({
            low52w: 400_000,
            high52w: 700_000,
            avg: 600_000,
            current: 650_000,
        });
        const svg = container.querySelector('svg[role="img"]');
        expect(svg?.textContent).toContain('$600K');
        expect(svg?.textContent).toContain('$650K');
        expect(svg?.textContent).not.toContain('$600,000');
        expect(svg?.getAttribute('aria-label')).toContain('$600,000');
        expect(svg?.getAttribute('aria-label')).toContain('$650,000');
    });

    it('sub-$1 crypto 정밀도 값은 "$0"으로 뭉개지지 않는다', () => {
        const { container } = renderBuilding({
            low52w: 0.0004,
            high52w: 0.0009,
            avg: 0.0006,
            current: 0.0007,
        });
        const svg = container.querySelector('svg[role="img"]');
        expect(svg?.textContent).not.toMatch(/\$0(?!\.\d)/);
        expect(svg?.getAttribute('aria-label')).not.toMatch(/\$0(?!\.\d)/);
    });

    it.each([
        { name: '$1,234.56', avg: 1234.56, current: 4321.09 },
        { name: '~$4,000', avg: 3987.65, current: 3500 },
    ])(
        '4자리 가격($name)에서 in-SVG 라벨이 축약 없이 전체 정밀도로 렌더되면서도 viewBox를 벗어나지 않는다(클리핑 방지, audit finding #1)',
        ({ avg, current }) => {
            const { container } = renderBuilding({
                low52w: 1000,
                high52w: 5000,
                avg,
                current,
            });
            const svg = container.querySelector('svg[role="img"]');

            // 라벨이 (축약 없이) 렌더돼 있다.
            const avgPrice = formatUsdCompactForSvgLabel(avg);
            const currentPrice = formatUsdCompactForSvgLabel(current);
            expect(avgPrice).not.toContain('K'); // IN_SVG_COMPACT_THRESHOLD(100,000) 미만
            expect(svg?.textContent).toContain(avgPrice);
            expect(svg?.textContent).toContain(currentPrice);

            // jsdom에는 실제 텍스트 레이아웃이 없어(getBBox 미구현) 컴포넌트와 동일한
            // 보수적 폭 추정치로 "라벨 시작 x가 viewBox(0) 안쪽인가"를 검증한다 —
            // 여유 폭(SVG_LABEL_AVAILABLE_WIDTH)보다 라벨 폭이 좁아야 클리핑이 없다.
            const avgLabelWidth = estimateSvgLabelWidth(
                AVG_LABEL_PREFIX + avgPrice
            );
            const currentLabelWidth = estimateSvgLabelWidth(
                CURRENT_LABEL_PREFIX + currentPrice
            );
            const avgXStart = SVG_LABEL_AVAILABLE_WIDTH - avgLabelWidth;
            const currentXEnd = SVG_LABEL_AVAILABLE_WIDTH - currentLabelWidth;
            expect(avgXStart).toBeGreaterThanOrEqual(0);
            expect(currentXEnd).toBeGreaterThanOrEqual(0);
        }
    );

    it('crash 없이 렌더된다(break-even 모델)', () => {
        expect(() =>
            renderBuilding({
                low52w: 100,
                high52w: 200,
                avg: 150,
                current: 150,
            })
        ).not.toThrow();
    });
});
