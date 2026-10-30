/**
 * 한국 거래계획 보고서 섹션(DART D005).
 */
import { useTranslations } from 'next-intl';
import type { KrTradingPlan } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { formatInteger } from '../utils/flowFormat';
import { newestKrRows } from '../utils/krDisclosures';
import { OmittedNote } from '../ui/notes/OmittedNote';
import { TradingPlanList } from '../ui/kr/TradingPlanList';
import { CollectingNotice } from './CollectingNotice';

const HEADING_ID = 'flows-kr-trading-plans-heading';

interface KrTradingPlansSectionProps {
    readonly plans: readonly KrTradingPlan[];
    /** DART 초기 수집이 끝나지 않았고 이 종목 공시가 비어 있다. */
    readonly collecting: boolean;
}

/** 수집 중 → 보고 없음 → 목록 순으로 첫 해당 분기만 그린다. */
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
            <TradingPlanList plans={rows} />
            {omittedCount > 0 && (
                <OmittedNote>
                    {t('kr.omitted', {
                        count: formatInteger(omittedCount, locale),
                    })}
                </OmittedNote>
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
