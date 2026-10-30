/**
 * 수급 화면의 용어 풀이 툴팁.
 */
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { TooltipParagraphs } from '@/shared/ui/TooltipParagraphs';

/**
 * 수급 화면의 용어 풀이 키(`widgets.investor-flows.tooltip.*`). 문구는 카탈로그 배열이고, 단락 수는
 * 로케일마다 달라도 된다. 하우스 스타일: `~이에요`체, 1–2문장, 쉬운 말, 투자 권유 표현 금지.
 */
export type FlowTerm =
    | 'thirteenF'
    | 'institutionalHolding'
    | 'newExited'
    | 'increasedDecreased'
    | 'netBuySell'
    | 'form4'
    | 'insiderCluster'
    | 'largeHolder13dg'
    | 'shortInterest'
    | 'pctOfFloat'
    | 'daysToCover'
    | 'shortSqueeze'
    | 'offExchangeShortRatio'
    | 'settlementDate'
    | 'partialAggregation'
    | 'flowScore'
    | 'optionsNotional'
    | 'form144'
    | 'dilution'
    | 'failsToDeliver'
    | 'thresholdList'
    | 'squeezeScore'
    | 'krFlowScore'
    | 'krMajorHolder'
    | 'krInsider';

/** 용어 옆 (i) 풀이. 기존 `InfoTooltip` 패턴(펀더멘털·옵션 탭)을 그대로 쓴다. */
export function FlowTooltip({ term }: { readonly term: FlowTerm }) {
    return (
        <InfoTooltip>
            <TooltipParagraphs
                namespace="widgets.investor-flows"
                tooltipKey={term}
            />
        </InfoTooltip>
    );
}
