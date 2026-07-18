import { fireEvent, render, screen, within } from '@testing-library/react';
import {
    BAND_COUNT,
    computePosition,
    type PositionModel,
} from '../lib/positionGeometry';
import { PositionBuilding } from '../ui/PositionBuilding';
import {
    AVG_LABEL_PREFIX,
    CURRENT_LABEL_PREFIX,
    describeAvgFloor,
    estimateSvgLabelWidth,
    formatUsdCompactForSvgLabel,
    SVG_LABEL_AVAILABLE_WIDTH,
} from '../lib/positionBuildingNotes';

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
    m: PositionModel = model(input),
    volumeByBand?: readonly number[] | null
) {
    return render(
        <PositionBuilding
            symbol="AAPL"
            model={m}
            low52w={input.low52w ?? 100}
            high52w={input.high52w ?? 200}
            current={input.current ?? 180}
            avg={input.avg ?? 150}
            volumeByBand={volumeByBand}
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

    it('avg가 최근 고점보다 높으면(clamped=above) 시각 노트는 메타포 phrase(옥상 위)만 — 설명 절은 폭 초과로 좌측이 잘리므로 aria-label로 옮겨 담는다', () => {
        const { getByTestId, queryByTestId, container } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 250,
            current: 180,
        });
        // 시각 노트(SVG <text>)는 폭 제약(SVG_LABEL_AVAILABLE_WIDTH=118px)을 받아
        // 메타포 phrase만 — 설명 절("최근 고점보다 높은 곳")까지 붙으면 좌측이 잘린다.
        expect(getByTestId('avg-floor-note').textContent).toContain('옥상 위');
        expect(getByTestId('avg-floor-note').textContent).not.toContain(
            '최근 고점보다 높은'
        );
        // 폭 제약이 없는 aria-label은 설명 절까지 전체 문구를 그대로 담는다(AT 정보량 유지).
        expect(
            container
                .querySelector('svg[role="img"]')
                ?.getAttribute('aria-label')
        ).toContain('최근 고점보다 높은');
        expect(queryByTestId('current-out-of-range-note')).toBeNull();
    });

    it('avg가 최근 저점보다 낮으면(clamped=below) 시각 노트는 지하 세대만 — 설명 절은 aria-label로', () => {
        const { getByTestId, container } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 50,
            current: 120,
        });
        expect(getByTestId('avg-floor-note').textContent).toContain(
            '지하 세대'
        );
        expect(getByTestId('avg-floor-note').textContent).not.toContain(
            '최근 저점보다 낮은'
        );
        expect(
            container
                .querySelector('svg[role="img"]')
                ?.getAttribute('aria-label')
        ).toContain('최근 저점보다 낮은');
    });

    it('current가 최근 고점보다 높으면(clamped=above) — avg는 정상 범위여도 별도로 옥상 위 안내를 노출하고, ★평단은 (범위 안이므로) 옥상/지하 문구 없이 층 정보만 보여준다', () => {
        const { getByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 150,
            current: 250,
        });
        expect(getByTestId('current-out-of-range-note').textContent).toContain(
            '최근 고점보다 높은'
        );
        const avgFloorNoteText = getByTestId('avg-floor-note').textContent;
        expect(avgFloorNoteText).toContain('층');
        expect(avgFloorNoteText).not.toContain('옥상');
        expect(avgFloorNoteText).not.toContain('지하');
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

    it('avg·current 둘 다 범위 안이면(clamped=null) current out-of-range 안내는 없지만, ★평단은 층 안내를 보여준다(avgPos 0.5 → 3층 · 중층)', () => {
        const { getByTestId, queryByTestId } = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 150, // avgPos 0.5 → floorIndex 2 (of 5) → 3층 · 중층
            current: 180,
        });
        expect(queryByTestId('current-out-of-range-note')).toBeNull();
        expect(getByTestId('avg-floor-note').textContent).toBe('3층 · 중층');
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

    describe('★평단 층 안내(avg-floor-note)는 위치 서술만 — 매수/매도·진입 퀄리티 평가 언어 금지', () => {
        // "잘 사셨어요", "좋은 진입", "성공적인 저점 매수", "고점 물림" 등으로 새는지
        // below/above/in-range 세 상태 모두에서 확인한다(scope fence 회귀 방지).
        const EVALUATIVE_WORDS = /잘\s?사|좋은|성공|물림|추천|타이밍|진입/;

        it.each([
            { name: 'below(지하)', avg: 50, current: 120 },
            { name: 'above(옥상 위)', avg: 250, current: 180 },
            { name: 'in-range(중층)', avg: 150, current: 180 },
        ])('$name 상태에서 평가 언어가 없다', ({ avg, current }) => {
            const { getByTestId } = renderBuilding({
                low52w: 100,
                high52w: 200,
                avg,
                current,
            });
            const note = getByTestId('avg-floor-note').textContent ?? '';
            expect(note).not.toMatch(EVALUATIVE_WORDS);
        });
    });

    it('aria-label에 평단/현재가/수익률/범위 위치%/★평단 층 안내가 모두 포함된다(스크린리더가 층 정보도 받는다)', () => {
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
        expect(label).toContain('3층 · 중층');
    });

    it('aria-label의 ★평단 층 안내는 avgClamped가 above/below일 때 옥상 위/지하 문구로 바뀐다', () => {
        const above = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 250,
            current: 180,
        });
        expect(
            above.container
                .querySelector('svg[role="img"]')
                ?.getAttribute('aria-label')
        ).toContain('옥상 위');
        above.unmount();

        const below = renderBuilding({
            low52w: 100,
            high52w: 200,
            avg: 50,
            current: 120,
        });
        expect(
            below.container
                .querySelector('svg[role="img"]')
                ?.getAttribute('aria-label')
        ).toContain('지하 세대');
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

    it.each([
        { name: 'above(옥상 위)', avg: 250, current: 180, prefix: '☁ ' },
        { name: 'below(지하 세대)', avg: 50, current: 120, prefix: '▽B1 ' },
    ])(
        '범위 밖($name) avg-floor-note 시각 노트는 SVG_LABEL_AVAILABLE_WIDTH를 넘지 않는다(좌측 클리핑 방지, design audit)',
        ({ avg, current, prefix }) => {
            const { getByTestId } = renderBuilding({
                low52w: 100,
                high52w: 200,
                avg,
                current,
            });
            // 렌더된 시각 노트 텍스트(prefix + phrase)의 보수적 추정 폭이 end-anchored
            // 여유 폭 이내여야 좌측(메타포 phrase)이 잘리지 않는다. 설명 절까지 붙었던
            // 이전 문구(예: "☁ 옥상 위 · 최근 고점보다 높은 곳" ≈ 153px)는 이 한계를
            // 넘겨 phrase가 잘렸다 — 시각 노트를 phrase만으로 축약해 회귀를 막는다.
            const noteText = getByTestId('avg-floor-note').textContent ?? '';
            expect(noteText.startsWith(prefix)).toBe(true);
            expect(estimateSvgLabelWidth(noteText)).toBeLessThanOrEqual(
                SVG_LABEL_AVAILABLE_WIDTH
            );
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

    // Mobile stays 280px unchanged (already right-sized); sm/lg caps are raised
    // to match PositionTabMemberContent's wrapper widths (340px/440px) so this
    // svg's own max-w isn't the bottleneck once the wrapper grows.
    it('raises the desktop max-width caps (sm/lg) while keeping the mobile base cap at 280px', () => {
        const { container } = renderBuilding();
        const svg = container.querySelector('svg[role="img"]');
        expect(svg?.getAttribute('class')).toContain('max-w-[280px]');
        expect(svg?.getAttribute('class')).toContain('sm:max-w-[340px]');
        expect(svg?.getAttribute('class')).toContain('lg:max-w-[440px]');
    });

    describe('floor hover — volume-by-price (design §floor-hover)', () => {
        // low52w=100, high52w=200, bandCount=5 → width=20 → bands
        // [100,120) [120,140) [140,160) [160,180) [180,200]
        const VOLUME_BY_BAND = [10, 20, 30, 25, 15];

        // buildFloorTooltipContent/formatFloorTooltipText의 apartment-metaphor
        // 문구("거주율 N% (최근 52주 거래량 기준)")를 테스트에서 재계산하지 않고
        // 이 배열 하나로 못박아 소스와 동일하게 유지한다.
        const EXPECTED = [
            '$100–$120 · 거주율 10% (최근 52주 거래량 기준)',
            '$120–$140 · 거주율 20% (최근 52주 거래량 기준)',
            '$140–$160 · 거주율 30% (최근 52주 거래량 기준)',
            '$160–$180 · 거주율 25% (최근 52주 거래량 기준)',
            '$180–$200 · 거주율 15% (최근 52주 거래량 기준)',
        ];

        it('without volumeByBand, floors are non-interactive (no tabIndex/aria-label/role/onClick) and no tooltip infra renders — DOM unchanged', () => {
            const { container, queryByTestId } = renderBuilding();
            const floors = container.querySelectorAll(
                '[data-testid="building-floor"]'
            );
            expect(floors).toHaveLength(5);
            floors.forEach(floor => {
                expect(floor.hasAttribute('tabindex')).toBe(false);
                expect(floor.hasAttribute('aria-label')).toBe(false);
                expect(floor.hasAttribute('role')).toBe(false);
                expect(floor.querySelector('title')).toBeNull();
                // 클릭해도 pinnedFloor가 절대 set되지 않는다(onClick 핸들러 자체가
                // 붙지 않음) — floating 툴팁 DOM이 전혀 나타나지 않는다.
                fireEvent.click(floor);
            });
            expect(queryByTestId('floor-volume-readout')).toBeNull();
            expect(screen.queryByTestId('floor-tooltip')).toBeNull();
            expect(screen.queryByRole('tooltip')).toBeNull();
        });

        it('with volumeByBand, floors stay visual-only under svg role="img" — no role/tabIndex/aria-label (WAI-ARIA forbids focusable descendants inside role="img"), and the native <title> is gone', () => {
            const { container } = renderBuilding({}, undefined, VOLUME_BY_BAND);
            const floors = Array.from(
                container.querySelectorAll('[data-testid="building-floor"]')
            );
            expect(floors).toHaveLength(5);

            floors.forEach(floor => {
                // Floors are a pointer-only visual enhancement (design decision,
                // round-2 review): the parent <svg role="img"> flattens any
                // focusable/interactive descendant out of the accessibility tree,
                // so exposing role="button"/tabIndex/aria-label here would be
                // dead-for-AT and misleading. Essential info (avg/current/return%/
                // range%/floor note) already lives in the svg's own aria-label.
                expect(floor.hasAttribute('tabindex')).toBe(false);
                expect(floor.hasAttribute('role')).toBe(false);
                expect(floor.hasAttribute('aria-label')).toBe(false);
                // PRIMARY requirement: native <title> (unstyled OS hover box +
                // ~1s browser delay) is removed, replaced by the styled tooltip.
                expect(floor.querySelector('title')).toBeNull();
                // Pointer affordances stay: pointer cursor + touch-friendly tap target.
                expect(floor.getAttribute('class')).toContain('cursor-pointer');
                expect(floor.getAttribute('class')).toContain(
                    'touch-manipulation'
                );
            });
        });

        it('the essential position summary remains on the svg role="img" aria-label regardless of floor hover state', () => {
            const { container } = renderBuilding({}, undefined, VOLUME_BY_BAND);
            const svg = container.querySelector('svg[role="img"]');
            const label = svg?.getAttribute('aria-label') ?? '';
            expect(label).toContain('AAPL');
            expect(label).toContain('수익률');
            expect(label).toContain('최근 범위의');
        });

        it('hovering (mouseEnter) a floor reveals its band info in the below-building readout AND the styled floating tooltip immediately (no native delay); mouseLeave clears both', () => {
            const { container, getByTestId } = renderBuilding(
                {},
                undefined,
                VOLUME_BY_BAND
            );
            const floors = container.querySelectorAll(
                '[data-testid="building-floor"]'
            );
            const readout = getByTestId('floor-volume-readout');
            expect(readout.textContent?.trim()).toBe('');
            expect(screen.queryByTestId('floor-tooltip')).toBeNull();

            fireEvent.mouseEnter(floors[2]); // band index 2 → [140,160), 30%
            expect(readout.textContent).toBe(EXPECTED[2]);

            // The floating tooltip is a pointer-only visual enhancement portaled
            // outside the svg's role="img" subtree — it has no accessible role
            // (aria-hidden, no aria-describedby trigger) so it never double-announces
            // alongside the svg's own aria-label (MISTAKES a11y #3).
            const tooltip = screen.getByTestId('floor-tooltip');
            expect(tooltip.hasAttribute('role')).toBe(false);
            expect(tooltip.getAttribute('aria-hidden')).toBe('true');
            expect(
                within(tooltip).getByText('$140–$160 · 거주율 30%')
            ).toBeInTheDocument();
            expect(
                within(tooltip).getByText('최근 52주 거래량 기준')
            ).toBeInTheDocument();

            fireEvent.mouseLeave(floors[2]);
            expect(readout.textContent?.trim()).toBe('');
            expect(screen.queryByTestId('floor-tooltip')).toBeNull();
        });

        it('the below-building readout is aria-hidden (band info is already exposed per-floor via aria-label, avoiding double-announce)', () => {
            const { getByTestId } = renderBuilding(
                {},
                undefined,
                VOLUME_BY_BAND
            );
            expect(
                getByTestId('floor-volume-readout').getAttribute('aria-hidden')
            ).toBe('true');
        });

        it('clicking (tap-to-toggle, mobile parity) a floor shows the styled tooltip without any prior hover; clicking it again dismisses it', () => {
            const { container } = renderBuilding({}, undefined, VOLUME_BY_BAND);
            const floors = container.querySelectorAll(
                '[data-testid="building-floor"]'
            );
            expect(screen.queryByTestId('floor-tooltip')).toBeNull();

            fireEvent.click(floors[3]); // band index 3 → [160,180), 25%
            expect(
                within(screen.getByTestId('floor-tooltip')).getByText(
                    '$160–$180 · 거주율 25%'
                )
            ).toBeInTheDocument();

            fireEvent.click(floors[3]);
            expect(screen.queryByTestId('floor-tooltip')).toBeNull();
        });

        it('floors do not respond to keyboard activation (Enter/Space/Tab) — they are visual-only, not focusable controls (role="img" forbids interactive descendants)', () => {
            const { container } = renderBuilding({}, undefined, VOLUME_BY_BAND);
            const floors = container.querySelectorAll(
                '[data-testid="building-floor"]'
            );
            fireEvent.keyDown(floors[0], { key: 'Enter' });
            fireEvent.keyDown(floors[0], { key: ' ' });
            fireEvent.keyDown(floors[0], { key: 'Tab' });
            expect(screen.queryByTestId('floor-tooltip')).toBeNull();
        });

        it('clicking outside the building dismisses a click-pinned tooltip (pointerdown path)', () => {
            const { container } = renderBuilding({}, undefined, VOLUME_BY_BAND);
            const floors = container.querySelectorAll(
                '[data-testid="building-floor"]'
            );

            fireEvent.click(floors[1]);
            expect(screen.getByTestId('floor-tooltip')).toBeInTheDocument();

            // useOnClickOutside listens on pointerdown, not click.
            fireEvent.pointerDown(document.body);
            expect(screen.queryByTestId('floor-tooltip')).toBeNull();
        });

        it('Escape dismisses a click-pinned tooltip (WCAG 1.4.13 keyboard-dismiss path, same idiom as InfoTooltip)', () => {
            const { container } = renderBuilding({}, undefined, VOLUME_BY_BAND);
            const floors = container.querySelectorAll(
                '[data-testid="building-floor"]'
            );

            fireEvent.click(floors[3]); // band index 3 → [160,180), 25%
            expect(
                within(screen.getByTestId('floor-tooltip')).getByText(
                    '$160–$180 · 거주율 25%'
                )
            ).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(screen.queryByTestId('floor-tooltip')).toBeNull();
        });

        it('deactivate false-path: mouseLeave on a floor that is NOT the active one leaves the active floor untouched (prev.index !== i branch)', () => {
            const { container, getByTestId } = renderBuilding(
                {},
                undefined,
                VOLUME_BY_BAND
            );
            const floors = container.querySelectorAll(
                '[data-testid="building-floor"]'
            );
            const readout = getByTestId('floor-volume-readout');

            fireEvent.mouseEnter(floors[2]); // activates floor 2
            expect(readout.textContent).toBe(EXPECTED[2]);

            // floor 0 was never activated — its mouseLeave must be a no-op for
            // floor 2's still-active state (setHoverFloor's `prev?.index === i
            // ? null : prev` false branch).
            fireEvent.mouseLeave(floors[0]);
            expect(readout.textContent).toBe(EXPECTED[2]);
            expect(screen.getByTestId('floor-tooltip')).toBeInTheDocument();

            fireEvent.mouseLeave(floors[2]);
            expect(readout.textContent?.trim()).toBe('');
        });
    });
});

describe('describeAvgFloor', () => {
    it('avgClamped=below면 지하 문구(옥상/층 계산과 무관, avgPos 값은 쓰이지 않는다)', () => {
        expect(describeAvgFloor(0, 'below', BAND_COUNT)).toBe(
            '지하 세대 · 최근 저점보다 낮은 곳'
        );
        expect(describeAvgFloor(0.99, 'below', BAND_COUNT)).toBe(
            '지하 세대 · 최근 저점보다 낮은 곳'
        );
    });

    it('avgClamped=above면 옥상 위 문구(옥상/층 계산과 무관, avgPos 값은 쓰이지 않는다)', () => {
        expect(describeAvgFloor(0, 'above', BAND_COUNT)).toBe(
            '옥상 위 · 최근 고점보다 높은 곳'
        );
        expect(describeAvgFloor(1, 'above', BAND_COUNT)).toBe(
            '옥상 위 · 최근 고점보다 높은 곳'
        );
    });

    it.each([
        // avgPos, expected — BAND_COUNT=5: floorIndex = clamp(floor(avgPos*5), 0, 4)
        { avgPos: 0, expected: '1층 · 저층' }, // 경계: 정확히 0
        { avgPos: 0.05, expected: '1층 · 저층' },
        { avgPos: 0.2, expected: '2층 · 중층' }, // floorIndex 1
        { avgPos: 0.4, expected: '3층 · 중층' }, // floorIndex 2
        { avgPos: 0.59, expected: '3층 · 중층' }, // 스펙 예시: 59% → 3층/중층
        { avgPos: 0.6, expected: '4층 · 고층' }, // floorIndex 3
        { avgPos: 0.8, expected: '5층 · 펜트하우스' }, // floorIndex 4 (최상층)
        { avgPos: 1, expected: '5층 · 펜트하우스' }, // 경계: 정확히 1
    ])(
        'avgClamped=null, avgPos=$avgPos → $expected',
        ({ avgPos, expected }) => {
            expect(describeAvgFloor(avgPos, null, BAND_COUNT)).toBe(expected);
        }
    );

    it('bandCount이 달라져도(테스트용 임의 값) 최하층=저층, 최상층=펜트하우스 경계를 지킨다', () => {
        expect(describeAvgFloor(0, null, 3)).toBe('1층 · 저층');
        expect(describeAvgFloor(1, null, 3)).toBe('3층 · 펜트하우스');
        expect(describeAvgFloor(0.5, null, 3)).toBe('2층 · 중층');
    });
});
