import { describe, expect, it } from 'vitest';
import {
    BAND_COUNT,
    computePosition,
    type PositionModel,
} from '@/widgets/portfolio-position/utils/positionGeometry';
import {
    CENTER_X,
    computeFloorFaces,
    computeMarkerLayout,
    estimateSvgLabelWidth,
    FLOOR_H,
    floorShading,
    frontY,
    GROUND_FRONT_Y,
    ROOF_BACK_Y,
    ROOF_FRONT_Y,
} from '@/widgets/portfolio-position/utils/buildingGeometry';

function model(avg: number, current: number): PositionModel {
    const m = computePosition({ low52w: 100, high52w: 200, current, avg });
    if (m === null) throw new Error('fixture must produce a model');
    return m;
}

describe('buildingGeometry', () => {
    describe('frontY', () => {
        it("'above'는 pos와 무관하게 옥상 위 고정 좌표(지붕 뒤 꼭짓점보다 위)다", () => {
            expect(frontY(1, 'above')).toBe(frontY(0.2, 'above'));
            expect(frontY(1, 'above')).toBeLessThan(ROOF_BACK_Y);
        });

        it("'below'는 pos와 무관하게 지하 고정 좌표(바닥보다 아래)다", () => {
            expect(frontY(0, 'below')).toBe(frontY(0.7, 'below'));
            expect(frontY(0, 'below')).toBeGreaterThan(GROUND_FRONT_Y);
        });

        it('범위 안에서 high(pos=1)는 지붕 정면 꼭짓점, low(pos=0)는 바닥이다', () => {
            expect(frontY(1, null)).toBe(ROOF_FRONT_Y);
            expect(frontY(0, null)).toBe(GROUND_FRONT_Y);
        });

        it('범위 안에서는 선형으로 매핑한다', () => {
            expect(frontY(0.5, null)).toBe((ROOF_FRONT_Y + GROUND_FRONT_Y) / 2);
        });
    });

    describe('computeFloorFaces', () => {
        it('index 0(최저층)이 가장 아래(y가 가장 큼)에 있다', () => {
            const lowestFrontBottomY = Number(
                computeFloorFaces(0).left.split(' ')[2].split(',')[1]
            );
            const highestFrontBottomY = Number(
                computeFloorFaces(BAND_COUNT - 1)
                    .left.split(' ')[2]
                    .split(',')[1]
            );
            expect(lowestFrontBottomY).toBe(GROUND_FRONT_Y);
            expect(highestFrontBottomY).toBe(ROOF_FRONT_Y + FLOOR_H);
        });

        it('왼쪽 면은 CENTER_X보다 왼쪽 외곽, 오른쪽 면은 오른쪽 외곽에서 시작한다', () => {
            const faces = computeFloorFaces(2);
            const startX = (s: string) => Number(s.split(' ')[0].split(',')[0]);
            expect(startX(faces.left)).toBeLessThan(CENTER_X);
            expect(startX(faces.right)).toBeGreaterThan(CENTER_X);
        });

        it('층마다 창문 2개를 좌우 면에 각각 만든다', () => {
            const faces = computeFloorFaces(1);
            expect(faces.windowsLeft).toHaveLength(2);
            expect(faces.windowsRight).toHaveLength(2);
        });
    });

    describe('floorShading', () => {
        it('index 0은 위→아래 순번 마지막(BAND_COUNT - 1)이다', () => {
            expect(floorShading(0).fromTop).toBe(BAND_COUNT - 1);
            expect(floorShading(BAND_COUNT - 1).fromTop).toBe(0);
        });

        it('모든 층이 lit/shadow 토큰을 가지며 두 토큰은 서로 다르다', () => {
            for (let i = 0; i < BAND_COUNT; i++) {
                const { lit, shadow } = floorShading(i);
                expect(lit).toMatch(/^text-secondary-/);
                expect(shadow).toMatch(/^text-secondary-/);
                expect(lit).not.toBe(shadow);
            }
        });
    });

    describe('computeMarkerLayout', () => {
        it('두 마커의 그려지는 y가 12px 안이면 평단은 왼쪽, 현재가는 오른쪽으로 벌린다', () => {
            const layout = computeMarkerLayout(model(150, 150.5), true);
            expect(layout.avgX).toBeLessThan(CENTER_X);
            expect(layout.currentX).toBeGreaterThan(CENTER_X);
        });

        it('같은 가격이어도 y가 같아 벌린다', () => {
            const layout = computeMarkerLayout(model(150, 150), true);
            expect(layout.avgX).toBeLessThan(layout.currentX);
        });

        it('평단이 옥상 위로 clamp되고 현재가가 범위의 95%여도 그려진 y가 멀면 벌리지 않는다', () => {
            // avg=250 → 'above'(고정 좌표), current=195 → pos 0.95. pos 차이는 작지만 화면 y는 ~90px 떨어진다.
            const m = model(250, 195);
            expect(m.avgClamped).toBe('above');
            expect(m.currentClamped).toBeNull();
            const layout = computeMarkerLayout(m, true);
            expect(Math.abs(layout.avgY - layout.currentY)).toBeGreaterThan(60);
            expect(layout.avgX).toBe(CENTER_X);
            expect(layout.currentX).toBe(CENTER_X);
        });

        it('평단이 없으면(hasAvg=false) y가 같아도 벌리지 않는다', () => {
            const layout = computeMarkerLayout(model(150, 150), false);
            expect(layout.avgX).toBe(CENTER_X);
            expect(layout.currentX).toBe(CENTER_X);
        });

        it('y는 frontY와 같은 값을 쓴다', () => {
            const m = model(120, 180);
            const layout = computeMarkerLayout(m, true);
            expect(layout.avgY).toBe(frontY(m.avgPos, m.avgClamped));
            expect(layout.currentY).toBe(
                frontY(m.currentPos, m.currentClamped)
            );
        });
    });

    describe('estimateSvgLabelWidth', () => {
        it('빈 문자열은 0이다', () => {
            expect(estimateSvgLabelWidth('')).toBe(0);
        });

        it('숫자·구두점은 6, 공백은 3, 한글·마커 심볼은 10으로 합산한다', () => {
            expect(estimateSvgLabelWidth('$1,2')).toBe(24);
            expect(estimateSvgLabelWidth(' ')).toBe(3);
            expect(estimateSvgLabelWidth('평단★')).toBe(30);
            expect(estimateSvgLabelWidth('★ 1')).toBe(19);
        });
    });
});
