'use client';

/**
 * Read-only `chart` kind panel for the share page: the snapshot-time candlestick
 * chart (when the snapshot carries bars) above the AI analysis panel.
 */

import dynamic from 'next/dynamic';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import type { SharePanelProps } from '../../types';
import { toShareKeyLevels } from '../../lib/shareKeyLevels';

/*
 * Both widgets load per kind (`next/dynamic`) so non-chart share pages never
 * download `AnalysisPanel` or `lightweight-charts`. SSR is unchanged (`ssr`
 * default), so the server HTML still carries the panel body.
 */
const AnalysisPanel = dynamic(() =>
    import('@/widgets/analysis/AnalysisPanel').then(m => m.AnalysisPanel)
);
const ShareCandlestickChart = dynamic(() =>
    import('@/widgets/chart/ShareCandlestickChart').then(
        m => m.ShareCandlestickChart
    )
);

/** `AnalysisPanel` stale-banner timeframe: 1Day has the longest threshold, so it never fires. */
const SHARE_ANALYSIS_TIMEFRAME = '1Day';

/**
 * Renders a chart snapshot read-only. `AnalysisPanel`'s live-data props are
 * filled from the snapshot:
 *
 * - `symbol`: the snapshot ticker, so the copy-report text and link name the
 *   real ticker (`AAPL 기술적 분석 리포트`, `siglens.io/AAPL`). Empty when absent.
 * - `keyLevels`: clustered from `result.keyLevels` (`toShareKeyLevels`).
 * - `timeframe`: `SHARE_ANALYSIS_TIMEFRAME`, a non-triggering stale-banner default.
 * - Interaction handlers (`onReanalyze`, `onActionPricesVisibilityChange`) are
 *   omitted — `AnalysisPanel` hides the reanalyze button and the price-line
 *   toggle when no handler is passed (the price lines it would toggle are drawn
 *   by `StockChart`, which this page does not render).
 *
 * `chartBars` is absent on snapshots created before bars were stored; then only
 * the analysis panel renders.
 */
export function ChartSharePanel({
    result,
    chartBars,
    symbol,
    krxTickTable,
    plain,
}: SharePanelProps<'chart'>) {
    const themeVersion = useThemeVersion();
    const ticker = symbol ?? '';
    const hasBars = chartBars !== undefined && chartBars.length > 0;
    return (
        <div className="flex flex-col gap-6">
            {hasBars && (
                <div className="overflow-hidden rounded-lg border border-secondary-700">
                    <ShareCandlestickChart
                        key={themeVersion}
                        bars={chartBars}
                        ticker={ticker}
                    />
                </div>
            )}
            {/* 차트 kind는 `AnalysisPanel`이 쉽게보기 스위치를 자기 안에 갖고 있다 —
                밖에서 한 번 더 감싸면 쉽게보기일 때 캔들 차트까지 사라진다
                (라이브 화면과 다른 동작이 된다). */}
            <AnalysisPanel
                symbol={ticker}
                krxTickTable={krxTickTable}
                analysis={result}
                keyLevels={toShareKeyLevels(result.keyLevels)}
                timeframe={SHARE_ANALYSIS_TIMEFRAME}
                isFreeUser={false}
                plain={plain}
            />
        </div>
    );
}
