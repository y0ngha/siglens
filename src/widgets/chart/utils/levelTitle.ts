import type { ChartOverlay } from '@y0ngha/siglens-core';
import { BREAKOUT_LEVEL_LABEL } from '../model/chartOverlayCategories';
import { overlayItemKey } from './chartOverlayUtils';
import { formatFibLevelLabel, type FibLevelTexts } from './fibLevelLabel';
import {
    formatOutcomeLevelLabel,
    type OutcomeLevelTexts,
} from './outcomeLevelLabel';

export interface LevelTitleContext {
    /** 이 작도가 속한 카드(패턴) 이름 — 모르면 `undefined`. */
    cardName: string | undefined;
    highlightedKey: string | null;
    /** 결과선 라벨이 몰려 겹치는 차트인가 — 강조된 항목만 문구를 남긴다. */
    crowded: boolean;
    breakoutTitle: (cardName: string | undefined) => string;
    outcomeTexts: OutcomeLevelTexts;
    fibTexts: FibLevelTexts;
}

/**
 * 레벨선 제목 결정: 돌파선 → 결과선(무효화·목표, 혼잡하면 강조된 항목만) → 피보나치 → 원문.
 * `''`는 "제목 숨김"이다.
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
    if (outcome !== null)
        return ctx.crowded && overlayItemKey(overlay) !== ctx.highlightedKey
            ? ''
            : outcome;
    return formatFibLevelLabel(label, overlay, ctx.fibTexts) ?? label;
}
