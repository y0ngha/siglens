/**
 * Reg SHO 과열 목록 상태 블록.
 */
import { useTranslations } from 'next-intl';
import type { ThresholdListStatus } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';

interface ThresholdListBadgeProps {
    /** `null` = 첫 목록을 아직 받지 못했다(수집 중일 때만 부모가 넘긴다). */
    readonly status: ThresholdListStatus | null;
}

function ThresholdLine({ status }: ThresholdListBadgeProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (status === null) {
        return (
            <p className="text-sm text-secondary-300">
                {t('threshold.collecting')}
            </p>
        );
    }
    if (!status.listed) {
        return (
            <p className="text-sm text-secondary-300">
                {t('threshold.notListed')}
            </p>
        );
    }
    return (
        <p className="flex flex-wrap items-center gap-2 text-sm text-secondary-200">
            <span className="inline-flex items-center gap-1 rounded bg-ui-warning/10 px-2 py-0.5 text-xs font-medium text-ui-warning-text">
                <span aria-hidden="true">⚠</span>
                {t('threshold.listedBadge')}
            </span>
            <span className="tabular-nums">
                {t('threshold.listedDetail', {
                    days: formatInteger(status.consecutiveDays, locale),
                    markets: status.markets.join(', '),
                })}
            </span>
        </p>
    );
}

/**
 * Reg SHO 과열 목록(threshold securities) 상태 한 줄 — **부모가 `regShoEnabled`일 때만** 부른다(거래소 데이터 비상업 라이선스:
 * 플래그를 끄면 배지·출처 모두 사라져야 한다). 등재면 경고 톤 배지(연속 거래일·시장), 미등재면 담담하게 적는다. 첫 목록을 받기
 * 전이면 "모으는 중"이라고만 말한다. 출처(Nasdaq·NYSE·Cboe)와 목록 날짜를 함께 적는다.
 */
export function ThresholdListBadge({ status }: ThresholdListBadgeProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <div data-testid="flows-threshold">
            <p className="mb-1 text-xs font-medium text-secondary-300">
                {t('threshold.title')}
                <FlowTooltip term="thresholdList" />
            </p>
            <ThresholdLine status={status} />
            {status !== null && (
                <p className="mt-1 text-xs text-secondary-400">
                    {status.asOf === undefined
                        ? t('threshold.source')
                        : t('threshold.sourceWithDate', { date: status.asOf })}
                </p>
            )}
        </div>
    );
}
