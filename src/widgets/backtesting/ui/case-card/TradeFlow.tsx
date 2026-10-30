import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { EntryChip } from './EntryChip';
import { ExitChip } from './ExitChip';

interface TradeFlowProps {
    case_: BacktestCase;
}

function FlowArrow() {
    return (
        <span className="shrink-0 text-secondary-500" aria-hidden="true">
            →
        </span>
    );
}

/** 진입 → 보유일 → 청산 흐름 한 줄. */
export function TradeFlow({ case_: c }: TradeFlowProps) {
    const t = useTranslations('widgets.backtesting');
    return (
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs">
            <EntryChip case_={c} />
            <FlowArrow />
            <span className="shrink-0 text-xs whitespace-nowrap text-secondary-500">
                {t.rich('BacktestCaseCard.06cf3e', {
                    v0: c.holdingDays,
                    n: chunks => <span className="tabular-nums">{chunks}</span>,
                })}
            </span>
            <FlowArrow />
            <ExitChip case_={c} />
        </div>
    );
}
