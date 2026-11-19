import { CHART_COLORS } from '@/shared/lib/chartColors';

/**
 * 비교 선 색 — 패턴 작도 팔레트 5색(`overlayPattern1..5`, 두 테마 모두 3:1 이상으로 맞춘 범주색)을 쓴다. 호출 시점의
 * 테마 값을 읽으므로(`CHART_COLORS` 게터) 차트를 테마 버전 `key`로 다시 만들 때마다 새 팔레트가 들어간다.
 */
export function compareSeriesColors(): readonly string[] {
    return [
        CHART_COLORS.overlayPattern1,
        CHART_COLORS.overlayPattern2,
        CHART_COLORS.overlayPattern3,
        CHART_COLORS.overlayPattern4,
        CHART_COLORS.overlayPattern5,
    ];
}
