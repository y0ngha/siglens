import type { ChartOverlay } from '@y0ngha/siglens-core';
import { BREAKOUT_LEVEL_LABEL } from '../model/chartOverlayCategories';
import { formatFibLevelLabel, type FibLevelTexts } from './fibLevelLabel';
import {
    formatOutcomeLevelLabel,
    type OutcomeLevelTexts,
} from './outcomeLevelLabel';

export interface LevelTitleContext {
    /** 이 작도가 속한 카드(패턴) 이름 — 모르면 `undefined`. */
    cardName: string | undefined;
    breakoutTitle: (cardName: string | undefined) => string;
    outcomeTexts: OutcomeLevelTexts;
    fibTexts: FibLevelTexts;
}

/**
 * 레벨선 제목 결정: 돌파선 → 결과선(무효화·목표) → 피보나치 → 원문.
 *
 * 라벨끼리 겹칠 때 무엇을 숨길지는 여기서 정하지 않는다 — 겹침은 지금 화면의 좌표로만
 * 알 수 있어 `useChartOverlays`가 그릴 때 판정한다(`visibleLevelLabels`).
 */
export function levelTitleFor(
    label: string,
    overlay: ChartOverlay,
    ctx: LevelTitleContext
): string {
    if (label === BREAKOUT_LEVEL_LABEL) return ctx.breakoutTitle(ctx.cardName);
    const outcome = formatOutcomeLevelLabel(
        label,
        overlay,
        ctx.cardName,
        ctx.outcomeTexts
    );
    if (outcome !== null) return outcome;
    return formatFibLevelLabel(label, overlay, ctx.fibTexts) ?? label;
}
