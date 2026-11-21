'use client';

import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import dynamic from 'next/dynamic';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { FEAR_GREED_CHART_HEIGHT } from './constants';

/**
 * 추이 차트는 `lightweight-charts`(원본 ~177KB)를 쓴다. 정적으로 import하면 이 탭의 첫 JS에
 * 실리는데 차트는 하이드레이션 뒤에야 그려지고 첫 화면 아래에 있다. 차트 탭처럼 지연 로드한다.
 * 자리는 차트와 같은 높이로 미리 잡아 도착할 때 아래 내용이 밀리지 않게 한다.
 */
const FearGreedHistoricalChart = dynamic(
    () =>
        import('@/widgets/fear-greed/FearGreedHistoricalChart').then(
            m => m.FearGreedHistoricalChart
        ),
    {
        ssr: false,
        loading: () => (
            <div
                aria-hidden="true"
                className="w-full animate-pulse rounded bg-secondary-800/40 motion-reduce:animate-none"
                style={{ height: FEAR_GREED_CHART_HEIGHT }}
            />
        ),
    }
);

interface LazyFearGreedHistoricalChartProps {
    /** 차트가 그릴 점. 마지막 252점만 쓰므로 호출부는 그만큼만 넘겨도 된다. */
    history: FearGreedHistoryPoint[];
}

/**
 * 종목 탭(`FearGreedPage`)과 시장 허브가 함께 쓰는 지연 로드 추이 차트.
 *
 * 테마 전환 때 차트를 다시 만들도록 `key={themeVersion}`을 여기서 준다
 * (`chartThemeRemountGuard`). 호출부마다 `dynamic` 자리를 따로 두면 "같은 높이" 규칙이
 * 두 벌이 되므로 한 곳에 둔다.
 */
export function LazyFearGreedHistoricalChart({
    history,
}: LazyFearGreedHistoricalChartProps) {
    const themeVersion = useThemeVersion();
    return <FearGreedHistoricalChart key={themeVersion} history={history} />;
}
