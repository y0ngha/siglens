/**
 * Shared tooltip JSX for financials-page metrics.
 *
 * Tooltip copy for financial statement terms used across
 * IncomeStatementSection, BalanceSheetSection, CashFlowSection, and
 * GrowthAnalysisSection. Centralising here prevents silent drift when a term
 * appears in multiple sections and one site is reworded while the others are
 * forgotten.
 *
 * House style: `~이에요`체, 정의→해석→임계값, 2–4문장, fits `max-w-xs`.
 *
 * These are pure JSX fragments (no DST / time-dependent logic), so they
 * are safe as module-level constants — no `'use client'` directive needed here.
 * The `InfoTooltip` wrapper each section passes them into is already
 * `'use client'`.
 */

import { TooltipParagraphs } from '@/shared/ui/TooltipParagraphs';

export const FcfTooltip = (
    <TooltipParagraphs namespace="widgets.financials" tooltipKey="fcf" />
);

export const NetDebtTooltip = (
    <TooltipParagraphs namespace="widgets.financials" tooltipKey="netDebt" />
);

export const AccrualsTooltip = (
    <TooltipParagraphs namespace="widgets.financials" tooltipKey="accruals" />
);

export const CapExTooltip = (
    <TooltipParagraphs namespace="widgets.financials" tooltipKey="capex" />
);

export const FcfMarginTooltip = (
    <TooltipParagraphs namespace="widgets.financials" tooltipKey="fcfMargin" />
);

export const GrossMarginTooltip = (
    <TooltipParagraphs
        namespace="widgets.financials"
        tooltipKey="grossMargin"
    />
);
