import { renderHook } from '@testing-library/react';
import {
    EMPTY_INDICATOR_RESULT,
    MA_DEFAULT_PERIODS,
} from '@y0ngha/siglens-core';
import { usePriceOverlayIndicators } from '@/widgets/chart/hooks/usePriceOverlayIndicators';

function render() {
    return renderHook(() =>
        usePriceOverlayIndicators(
            {
                chartRef: { current: null },
                bars: [],
                indicators: EMPTY_INDICATOR_RESULT,
                lineWidth: 1,
            },
            undefined
        )
    );
}

describe('usePriceOverlayIndicators — 이동평균 옵션', () => {
    it('MA 옵션에서 50일선을 고를 수 있다', () => {
        const { result } = render();

        expect(result.current.bindingOverrides.ma?.availablePeriods).toEqual([
            5, 20, 50, 60, 120, 200,
        ]);
    });

    it('core 기본 기간은 모두 그대로 남는다', () => {
        const { result } = render();

        for (const period of MA_DEFAULT_PERIODS) {
            expect(
                result.current.bindingOverrides.ma?.availablePeriods
            ).toContain(period);
        }
    });

    it('기본 선택은 바뀌지 않는다(아무 기간도 켜져 있지 않다)', () => {
        const { result } = render();

        expect(result.current.bindingOverrides.ma?.visiblePeriods).toEqual([]);
        expect(result.current.bindingOverrides.ma?.active).toBe(false);
        expect(result.current.labelConfigs).toEqual([]);
    });
});
