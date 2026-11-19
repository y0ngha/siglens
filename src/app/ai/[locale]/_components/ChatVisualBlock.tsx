'use client';

import type { ChatVisualBlock as ChatVisualBlockData } from '@/entities/chat-conversation/types';
import { CompareBlockView } from '@/widgets/chart/visual/CompareBlockView';
import { FlowsKrBlockView } from '@/widgets/chart/visual/FlowsKrBlockView';
import { HeatmapBlockView } from '@/widgets/chart/visual/HeatmapBlockView';
import { PortfolioBlockView } from '@/widgets/chart/visual/PortfolioBlockView';
import { useDividendsBlockModel } from '@/widgets/chart/visual/useDividendsBlockModel';
import { useFinancialsBlockModel } from '@/widgets/chart/visual/useFinancialsBlockModel';
import { FlowsUsBlock } from './FlowsUsBlock';
import { OptionsBlock } from './OptionsBlock';
import { TrendTableBlock } from './TrendTableBlock';

function FinancialsBlock({
    block,
}: {
    readonly block: Extract<ChatVisualBlockData, { kind: 'financials' }>;
}) {
    return <TrendTableBlock model={useFinancialsBlockModel(block)} />;
}

function DividendsBlock({
    block,
}: {
    readonly block: Extract<ChatVisualBlockData, { kind: 'dividends' }>;
}) {
    return <TrendTableBlock model={useDividendsBlockModel(block)} />;
}

/**
 * SIGLENS AI 답변 안 시각화 블록 한 장 — `kind`로 그릴 컴포넌트를 고른다. 시그렌즈가 이미 그리는 것은 그 위젯을
 * 가져다 쓰고(실적·배당·옵션·미국 수급의 기관 분기), 목록형(히트맵·보유종목)은 표로 보이며, 대응하는 화면이 없는
 * 것(비교 선·한국 수급·내부자 월별)만 `widgets/chart/visual`에서 새로 그린다. 위젯끼리는 import하지 못해(`noCrossWidgetImports`)
 * 이 조립은 app 레이어가 맡는다. 이 모듈은 `ChatChartProvider`가 `next/dynamic`으로만 열고, core를 값으로 가져오지 않는다
 * (`aiChatCoreFree`).
 */
export function ChatVisualBlock({
    block,
}: {
    readonly block: ChatVisualBlockData;
}) {
    switch (block.kind) {
        case 'compare':
            return <CompareBlockView block={block} />;
        case 'financials':
            return <FinancialsBlock block={block} />;
        case 'dividends':
            return <DividendsBlock block={block} />;
        case 'options':
            return <OptionsBlock block={block} />;
        case 'flows':
            return block.market === 'kr' ? (
                <FlowsKrBlockView block={block} />
            ) : (
                <FlowsUsBlock block={block} />
            );
        case 'portfolio':
            return <PortfolioBlockView block={block} />;
        case 'heatmap':
            return <HeatmapBlockView block={block} />;
    }
}
