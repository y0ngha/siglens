import { useTranslations } from 'next-intl';
import type { KrTradingPlan } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { formatInteger } from '../utils/flowFormat';
import { newestKrRows, tradingPlanKey } from '../utils/krDisclosures';
import { CollectingNotice } from './CollectingNotice';
import { DartFilingLink } from './DartFilingLink';

const HEADING_ID = 'flows-kr-trading-plans-heading';

interface KrTradingPlansSectionProps {
    readonly plans: readonly KrTradingPlan[];
    /** DART 초기 수집이 끝나지 않았고 이 종목 공시가 비어 있다. */
    readonly collecting: boolean;
}

function TradingPlansBody({ plans, collecting }: KrTradingPlansSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (collecting) return <CollectingNotice variant="dart" />;
    const { rows, omittedCount } = newestKrRows(plans);
    if (rows.length === 0) {
        return (
            <p className="text-sm text-secondary-300">
                {t('kr.tradingPlans.none')}
            </p>
        );
    }
    return (
        <>
            <ul className="space-y-2">
                {rows.map(plan => (
                    <li
                        key={tradingPlanKey(plan)}
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
                        <DartFilingLink
                            url={plan.url}
                            reporter={plan.reporter}
                        />
                    </li>
                ))}
            </ul>
            {omittedCount > 0 && (
                <p className="mt-2 text-xs text-secondary-400">
                    {t('kr.omitted', {
                        count: formatInteger(omittedCount, locale),
                    })}
                </p>
            )}
        </>
    );
}

/**
 * 거래계획 보고서(DART D005) — 임원·주요주주가 앞으로의 매매를 미리 알린 보고. 접수일·보고자·보고서명·원문 링크만 있다(목록 행이
 * 원천). 계획일 뿐 실제 거래가 아니라는 점을 캡션이 밝힌다.
 */
export function KrTradingPlansSection(props: KrTradingPlansSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <section
            aria-labelledby={HEADING_ID}
            data-testid="flows-kr-trading-plans"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-1', HEADING_SECTION)}>
                {t('kr.tradingPlans.title')}
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-secondary-400">
                {t('kr.tradingPlans.caption')}
            </p>
            <TradingPlansBody {...props} />
        </section>
    );
}
