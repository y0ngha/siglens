/**
 * 한국 거래계획 보고서 목록 — 접수일·보고자·보고서명·원문 링크.
 */
import type { KrTradingPlan } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { krDisclosureKey } from '../../utils/krDisclosures';
import { DartFilingLink } from '../filings/DartFilingLink';

/** 목록 행이 원천이라 카드 한 가지로 모든 폭을 처리한다. */
export function TradingPlanList({
    plans,
}: {
    readonly plans: readonly KrTradingPlan[];
}) {
    return (
        <ul className="space-y-2">
            {plans.map(plan => (
                <li
                    key={krDisclosureKey(plan)}
                    className={cn(
                        SURFACE_NESTED,
                        'flex flex-wrap items-start justify-between gap-2 p-3'
                    )}
                >
                    <div className="min-w-0">
                        <p className="text-sm font-medium break-words text-secondary-100">
                            {plan.reporter}
                        </p>
                        <p className="text-xs break-words text-secondary-300">
                            {plan.title}
                        </p>
                        <p className="mt-1 font-mono text-xs text-secondary-400 tabular-nums">
                            {plan.receiptDate}
                        </p>
                    </div>
                    <DartFilingLink url={plan.url} reporter={plan.reporter} />
                </li>
            ))}
        </ul>
    );
}
