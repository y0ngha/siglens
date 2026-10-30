/**
 * Tooltip JSX for the congress-trades table column headers and senate disclosure cell.
 *
 * Kept as JSX (not `utils/`) because each constant is a rendered element. They
 * are static fragments, so module-level constants are safe and no `'use client'`
 * is needed; the `InfoTooltip` that receives them is the client boundary.
 * Copy lives in the catalog (`widgets.congress.tooltip.*`).
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
