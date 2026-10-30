/**
 * 점수 창 문구 — "최근 N일(시작 ~ 끝)".
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsWindow } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatInteger } from '../../utils/flowFormat';

interface WindowRangeTextProps {
    readonly window: InvestorFlowsWindow;
    /** 창의 양 끝을 모를 때 대신 보일 문구. */
    readonly noneText: string;
}

/** 점수 창 문구. 양 끝을 모르면 `noneText`를 보인다. */
export function WindowRangeText({ window, noneText }: WindowRangeTextProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const { from, to, days } = window;
    if (from === null || to === null) return <>{noneText}</>;
    return (
        <>
            {t('asOf.insiderWindow', {
                days: formatInteger(days, locale),
                from,
                to,
            })}
        </>
    );
}
