/**
 * Unit tests for `strikeChartGeometry` — 순수 기하학 헬퍼.
 *
 * 순수 함수라 DOM 렌더링 없이 수치만 검증한다.
 */
import {
    slotWidth,
    barCenterX,
    barPixelHeight,
} from '@/widgets/options/lib/strikeChartGeometry';

describe('slotWidth', () => {
    it('chartWidth를 count로 균등 분할해 반환한다', () => {
        expect(slotWidth(5, 600)).toBe(120);
    });

    it('count가 1이면 chartWidth 전체를 반환한다', () => {
        expect(slotWidth(1, 400)).toBe(400);
    });

    it('count가 정확히 나누어 떨어지지 않으면 소수점 결과를 반환한다', () => {
        // 600 / 7 ≈ 85.714...
        expect(slotWidth(7, 600)).toBeCloseTo(85.714, 2);
    });
});

describe('barCenterX', () => {
    // 예: chartWidth=600, count=4 → slotWidth=150
    // index=0 → padLeft + 0 + 75 = padLeft + 75
    // index=3 → padLeft + 450 + 75 = padLeft + 525

    it('첫 번째 인덱스(0)일 때 padLeft + slotWidth/2를 반환한다', () => {
        // slotWidth = 600/4 = 150, center = 0*150 + 75 = 75 → 12 + 75 = 87
        expect(barCenterX(0, 4, 12, 600)).toBe(87);
    });

    it('마지막 인덱스일 때 올바른 중앙 x를 반환한다', () => {
        // slotWidth=150, center = 3*150 + 75 = 525 → 12 + 525 = 537
        expect(barCenterX(3, 4, 12, 600)).toBe(537);
    });

    it('중간 인덱스(1)일 때 올바른 중앙 x를 반환한다', () => {
        // slotWidth=150, center = 1*150 + 75 = 225 → 12 + 225 = 237
        expect(barCenterX(1, 4, 12, 600)).toBe(237);
    });

    it('padLeft가 0이면 SVG 원점부터 계산한다', () => {
        // slotWidth=200, center = 2*200 + 100 = 500
        expect(barCenterX(2, 3, 0, 600)).toBe(500);
    });
});

describe('barPixelHeight', () => {
    it('maxValue가 0이면 0-division 없이 0을 반환한다', () => {
        expect(barPixelHeight(500, 0, 120)).toBe(0);
    });

    it('value가 maxValue와 같으면 halfHeight를 반환한다', () => {
        expect(barPixelHeight(1000, 1000, 120)).toBe(120);
    });

    it('value가 maxValue보다 크면 halfHeight로 클램핑한다', () => {
        // Math.min 클램핑 경로
        expect(barPixelHeight(2000, 1000, 120)).toBe(120);
    });

    it('value가 maxValue의 절반이면 halfHeight의 절반을 반환한다', () => {
        expect(barPixelHeight(500, 1000, 120)).toBe(60);
    });

    it('value가 0이면 높이 0을 반환한다', () => {
        expect(barPixelHeight(0, 1000, 120)).toBe(0);
    });
});
