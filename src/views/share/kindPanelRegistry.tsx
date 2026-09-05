'use client';

/**
 * Registry mapping each ShareableKind to its read-only presentational panel.
 *
 * Each entry is a React component that accepts `{ result: SnapshotResultOf<K> }`
 * and renders the tab's AI summary view from snapshot data.
 * MVP = AI summary panels only (no raw data tables).
 *
 * The `satisfies` constraint enforces exhaustiveness at compile time:
 * adding a kind to ShareableKind without a matching entry here is a type error.
 */

import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { PlainAnalysisSwitch } from '@/shared/ui/PlainAnalysisSwitch';
import type { ReactNode } from 'react';
import type {
    ShareableKind,
    SnapshotResultOf,
} from '@/entities/shared-analysis';
import type { AssetClass } from '@/shared/config/marketProfile';
import {
    getDescriptor,
    profileIdForSymbol,
} from '@/shared/config/marketProfile';
import type { Bar } from '@y0ngha/siglens-core';
import { clusterKeyLevels, validateKeyLevels } from '@y0ngha/siglens-core';
import { AnalysisPanel } from '@/widgets/analysis';
import { ShareCandlestickChart } from '@/widgets/chart/ShareCandlestickChart';
import { OverallView } from '@/widgets/overall';
import { NewsAiSummaryView } from '@/widgets/news';
import { FundamentalAiSummaryView } from '@/widgets/fundamental';
import { FinancialsAiSummaryView } from '@/widgets/financials';
import { CongressTrendSummaryView } from '@/widgets/congress';
import { OptionsAiAnalysisView } from '@/widgets/options';
import { FearGreedShareView } from '@/widgets/fear-greed';

/**
 * AnalysisPanel has several required props that are interaction/live-data
 * concerns (symbol, keyLevels, timeframe). For the read-only share view:
 *
 * - `symbol`: threaded from the snapshot so the copy-report utility produces
 *   the correct ticker text and link (e.g. `AAPL 기술적 분석 리포트`,
 *   `siglens.io/AAPL`).
 * - `keyLevels`: derived from `result.keyLevels` (raw `KeyLevels`) via
 *   `validateKeyLevels` + `clusterKeyLevels`. We pass `currentPrice=0` because
 *   no live bar data is available; this sets epsilon=0 (no merging) but all
 *   valid levels still flow through. Falls back to the empty clustered structure
 *   when `result.keyLevels` is absent, so the panel degrades gracefully.
 * - `timeframe`: used only for stale-banner logic. We pass `'1Day'` as a
 *   safe, non-triggering default (stale threshold for 1Day is longest).
 * - All interaction props (`onReanalyze`, `onActionPricesVisibilityChange`)
 *   are intentionally omitted — the panel hides those UI elements when they
 *   are undefined.
 *
 *   이 문장은 한동안 사실이 아니었다. 차트 토글 버튼은 핸들러 유무와 무관하게
 *   렌더됐고 `onToggleChart?.()`가 아무것도 하지 않아, 눌러도 반응 없는
 *   컨트롤이 공유 화면에 남아 있었다(감사 실측: 클릭 2회 후 DOM 바이트 동일).
 *   게다가 그 버튼이 숨기겠다고 말하는 가격선은 `StockChart`가 그리는데
 *   이 페이지는 `ShareCandlestickChart`를 쓰므로 애초에 존재하지 않는다.
 *   `AnalysisPanel`이 이제 핸들러가 없으면 버튼을 렌더하지 않으며,
 *   `AnalysisPanel.test.tsx`의 "핸들러가 없으면 차트 토글을 렌더하지 않는다"가
 *   그 계약을 붙든다.
 *
 * `chartBars` is optional — old snapshots (created before this feature) will
 * not have bars. When present, a read-only candlestick chart is rendered ABOVE
 * the AnalysisPanel so the viewer sees the price context at analysis time.
 */
function ChartSharePanel({
    result,
    chartBars,
    symbol,
    plain,
}: {
    result: SnapshotResultOf<'chart'>;
    chartBars?: Bar[];
    symbol: string;
    plain?: string;
}) {
    const themeVersion = useThemeVersion();
    const rawKeyLevels = result.keyLevels ?? { support: [], resistance: [] };
    const clustered = clusterKeyLevels(validateKeyLevels(rawKeyLevels), 0);
    return (
        <div className="flex flex-col gap-6">
            {chartBars !== undefined && chartBars.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-secondary-700">
                    <ShareCandlestickChart
                        key={themeVersion}
                        bars={chartBars}
                        ticker={symbol}
                    />
                </div>
            )}
            {/* 차트 kind는 `AnalysisPanel`이 스위치를 자기 안에 갖고 있다 —
                밖에서 한 번 더 감싸면 쉽게보기일 때 캔들 차트까지 사라진다
                (라이브 화면과 다른 동작이 된다). */}
            <AnalysisPanel
                symbol={symbol}
                analysis={result}
                keyLevels={clustered}
                timeframe="1Day"
                isFreeUser={false}
                plain={plain}
            />
        </div>
    );
}

type PanelComponent<K extends ShareableKind> = (props: {
    result: SnapshotResultOf<K>;
    chartBars?: Bar[];
    assetClass?: AssetClass;
    symbol?: string;
    /** 스냅샷에 저장된 쉽게보기 산문. 없으면 토글이 렌더되지 않는다. */
    plain?: string;
}) => ReactNode;

interface WithPlainSwitchProps {
    plain?: string;
    children: ReactNode;
}

/**
 * 라이브 위젯들이 `*AiSummary`/`*Content`에서 하는 것과 **같은 자리**에 스위치를
 * 둔다 — 각 `*View`를 통째로 감싸고, 쉽게보기일 때 원문 트리를 마운트하지 않는다.
 * `plain`이 없는 스냅샷(이 필드 이전 또는 평이화 실패)에서는 스위치가 토글을
 * 그리지 않고 원문만 통과시키므로 기존 공유 링크의 동작이 그대로 유지된다.
 */
function WithPlainSwitch({ plain, children }: WithPlainSwitchProps) {
    return <PlainAnalysisSwitch plain={plain}>{children}</PlainAnalysisSwitch>;
}

export const SHARE_KIND_PANEL_REGISTRY = {
    chart: ({ result, chartBars, symbol, plain }) => (
        <ChartSharePanel
            result={result}
            chartBars={chartBars}
            symbol={symbol ?? ''}
            plain={plain}
        />
    ),
    /**
     * `OverallView.hasOptions`는 required — 호출부가 옵션 탭 존재 여부를
     * 직접 판정해 넘겨야 한다(그 이유는 OverallView.tsx JSDoc 참고).
     *
     * 판정은 `overall/page.tsx`·`OverallFactualFallback`과 **같은 소스**를 탄다 —
     * `getDescriptor(...).tabs`. 이 패널은 `marketProfile`을 갖고 있지 않지만
     * `symbol`(스냅샷에서 이미 threaded되어 `chart` 엔트리도 쓰는 canonical
     * ticker)로 프로필을 구할 수 있다. `isKrEquitySymbol`을 여기서 직접 부르면
     * "옵션 탭이 있는가"의 **세 번째 독립 파생**이 되어, 프로필의 `tabs`가 바뀌는
     * 순간 조용히 갈라진다(MISTAKES.md §6.6).
     *
     * **심볼이 없으면 `false`다.** 모르는 상태를 `true`로 열면 존재하지 않는
     * 옵션 섹션이 뜨는데, 그게 이 감사가 두 라운드 연속 잡아낸 실패 방향이다.
     * 숨기는 쪽이 틀려도 대가가 작다. 빈 문자열(`''`)도 "모르는 상태"와 같은
     * 실패 형태로 취급한다 — `profileIdForSymbol('')`은 `isKrEquitySymbol`이
     * false를 반환해 us-equity로 폴백하므로, 빈 문자열을 undefined와 다르게
     * 두면 hasOptions가 조용히 `true`로 열린다(뮤테이션 감사 2026-08-18).
     *
     * crypto는 `OverallView`가 `isEquity` 게이트로 이 값을 무시하므로,
     * `profileIdForSymbol`이 크립토를 us-equity로 떨어뜨리는 한계가 여기선
     * 영향을 주지 않는다.
     */
    overall: ({ result, assetClass, symbol, plain }) => (
        <WithPlainSwitch plain={plain}>
            <OverallView
                result={result}
                assetClass={assetClass}
                hasOptions={
                    symbol !== undefined &&
                    symbol !== '' &&
                    getDescriptor(profileIdForSymbol(symbol)).tabs.includes(
                        'options'
                    )
                }
            />
        </WithPlainSwitch>
    ),
    news: ({ result, plain }) => (
        <WithPlainSwitch plain={plain}>
            <NewsAiSummaryView result={result} />
        </WithPlainSwitch>
    ),
    fundamental: ({ result, plain }) => (
        <WithPlainSwitch plain={plain}>
            <FundamentalAiSummaryView result={result} />
        </WithPlainSwitch>
    ),
    financials: ({ result, plain }) => (
        <WithPlainSwitch plain={plain}>
            <FinancialsAiSummaryView result={result} />
        </WithPlainSwitch>
    ),
    congress: ({ result, plain }) => (
        <WithPlainSwitch plain={plain}>
            <CongressTrendSummaryView result={result} />
        </WithPlainSwitch>
    ),
    options: ({ result, plain }) => (
        <WithPlainSwitch plain={plain}>
            <OptionsAiAnalysisView result={result} />
        </WithPlainSwitch>
    ),
    'fear-greed': ({ result, plain }) => (
        <WithPlainSwitch plain={plain}>
            <FearGreedShareView snapshot={result} />
        </WithPlainSwitch>
    ),
} satisfies { [K in ShareableKind]: PanelComponent<K> };
