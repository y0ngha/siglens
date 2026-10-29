'use client';

/**
 * Registry mapping each ShareableKind to its read-only presentational panel.
 *
 * Each entry renders the tab's AI summary view from snapshot data (no raw data
 * tables). The `satisfies` constraint enforces exhaustiveness at compile time:
 * adding a kind to ShareableKind without a matching entry here is a type error.
 */

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { ShareableKind } from '@/shared/db/constants';
import { PlainAnalysisSwitch } from '@/shared/ui/PlainAnalysisSwitch';
import type { SharePanelProps } from './types';
import { shareHasOptionsTab } from './lib/shareHasOptionsTab';
import { ChartSharePanel } from './ui/chart/ChartSharePanel';

/*
 * 패널 위젯은 kind별로 따로 받는다(`next/dynamic`). 공유 링크 하나는 kind 하나만
 * 보여 주므로, 정적 import면 모든 패널이 모든 공유 페이지의 first-load에 실린다.
 * SSR은 그대로라(`ssr` 기본값) 서버 HTML에는 패널 본문이 들어가고, 클라이언트는
 * 렌더된 kind의 청크만 받는다. 차트 kind의 위젯은 `ChartSharePanel`이 같은 방식으로 받는다.
 */
const OverallView = dynamic(() =>
    import('@/widgets/overall/OverallView').then(m => m.OverallView)
);
const NewsAiSummaryView = dynamic(() =>
    import('@/widgets/news/NewsAiSummary').then(m => m.NewsAiSummaryView)
);
const FundamentalAiSummaryView = dynamic(() =>
    import('@/widgets/fundamental/FundamentalAiSummary').then(
        m => m.FundamentalAiSummaryView
    )
);
const FinancialsAiSummaryView = dynamic(() =>
    import('@/widgets/financials/FinancialsAiSummary').then(
        m => m.FinancialsAiSummaryView
    )
);
const CongressTrendSummaryView = dynamic(() =>
    import('@/widgets/congress/CongressTrendSummaryView').then(
        m => m.CongressTrendSummaryView
    )
);
const OptionsAiAnalysisView = dynamic(() =>
    import('@/widgets/options/OptionsAiAnalysis').then(
        m => m.OptionsAiAnalysisView
    )
);
const FearGreedShareView = dynamic(() =>
    import('@/widgets/fear-greed/FearGreedShareView').then(
        m => m.FearGreedShareView
    )
);

/** kind `K`의 registry 엔트리 형태. */
type PanelComponent<K extends ShareableKind> = (
    props: SharePanelProps<K>
) => ReactNode;

/**
 * kind → 공유 패널. `ShareKindPanel`이 스냅샷의 kind로 엔트리를 골라 렌더한다.
 *
 * AI 산문 kind는 라이브 위젯들이 `*AiSummary`/`*Content`에서 하는 것과 같은 자리에
 * `PlainAnalysisSwitch`를 둔다 — 각 `*View`를 통째로 감싸고, 쉽게보기일 때 원문 트리를
 * 마운트하지 않는다. `plain`이 없는 스냅샷에서는 스위치가 토글을 그리지 않고 원문만
 * 통과시킨다. 차트 kind는 `AnalysisPanel`이 스위치를 직접 갖고 있어 감싸지 않는다.
 */
export const SHARE_KIND_PANEL_REGISTRY = {
    chart: props => <ChartSharePanel {...props} />,
    // `OverallView.hasOptions`는 required — 판정 근거는 `shareHasOptionsTab` JSDoc.
    overall: ({ result, assetClass, symbol, plain }) => (
        <PlainAnalysisSwitch plain={plain}>
            <OverallView
                result={result}
                assetClass={assetClass}
                hasOptions={shareHasOptionsTab(symbol)}
            />
        </PlainAnalysisSwitch>
    ),
    news: ({ result, plain }) => (
        <PlainAnalysisSwitch plain={plain}>
            <NewsAiSummaryView result={result} />
        </PlainAnalysisSwitch>
    ),
    fundamental: ({ result, plain }) => (
        <PlainAnalysisSwitch plain={plain}>
            <FundamentalAiSummaryView result={result} />
        </PlainAnalysisSwitch>
    ),
    financials: ({ result, plain }) => (
        <PlainAnalysisSwitch plain={plain}>
            <FinancialsAiSummaryView result={result} />
        </PlainAnalysisSwitch>
    ),
    congress: ({ result, plain }) => (
        <PlainAnalysisSwitch plain={plain}>
            <CongressTrendSummaryView result={result} />
        </PlainAnalysisSwitch>
    ),
    options: ({ result, plain }) => (
        <PlainAnalysisSwitch plain={plain}>
            <OptionsAiAnalysisView result={result} />
        </PlainAnalysisSwitch>
    ),
    // fear-greed 점수는 클라이언트에서 결정적으로 계산된다 — AI 산문이 없으므로
    // `useRegisterShareable`도 `plain`을 절대 채우지 않는다. 스위치를 감싸 봐야
    // 영구히 눌리지 않는 죽은 토글이라, 다른 kind들과 달리 여기엔 두지 않는다.
    'fear-greed': ({ result }) => <FearGreedShareView snapshot={result} />,
} satisfies { [K in ShareableKind]: PanelComponent<K> };
