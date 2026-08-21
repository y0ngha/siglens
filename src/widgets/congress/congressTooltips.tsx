/**
 * Shared tooltip JSX for congress-trades page metrics.
 *
 * House style: `~이에요`체, 2–3문장, fits `max-w-xs`.
 *
 * These are pure JSX fragments (no time-dependent logic), so they are safe
 * as module-level constants — no `'use client'` directive needed here.
 * The `InfoTooltip` wrapper passed in each usage is already `'use client'`.
 */

import { TooltipParagraphs } from '@/shared/ui/TooltipParagraphs';

export const AmountRangeTooltip = (
    <TooltipParagraphs namespace="widgets.congress" tooltipKey="amountRange" />
);

export const DisclosureLagTooltip = (
    <TooltipParagraphs
        namespace="widgets.congress"
        tooltipKey="disclosureLag"
    />
);

export const SenateChamberTooltip = (
    <TooltipParagraphs
        namespace="widgets.congress"
        tooltipKey="senateChamber"
    />
);

export const HouseChamberTooltip = (
    <TooltipParagraphs namespace="widgets.congress" tooltipKey="houseChamber" />
);

export const ChamberColumnTooltip = (
    <TooltipParagraphs
        namespace="widgets.congress"
        tooltipKey="chamberColumn"
    />
);

export const SenateDisclosureTooltip = (
    <TooltipParagraphs
        namespace="widgets.congress"
        tooltipKey="senateDisclosure"
    />
);
