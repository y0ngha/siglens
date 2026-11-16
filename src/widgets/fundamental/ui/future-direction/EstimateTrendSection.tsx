/**
 * 전망과 목표가 카드의 실적 추정치 변화 섹션(Yahoo 집계). 기간마다 지금 EPS 추정치와, 30·90일 전보다 얼마나
 * 올랐거나 내렸는지, 최근 30일 동안 추정치를 올린·내린 애널리스트 수를 보여 준다.
 */
import { useTranslations } from 'next-intl';
import type { Locale } from '@/shared/i18n/locales';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { formatMoney } from '@/widgets/fundamental/utils/moneyFormat';
import {
    estimateChangeDirection,
    revisionShare,
    type EstimateChangeDirection,
    type EstimatePeriodCode,
    type VisibleEstimatePeriod,
} from '@/widgets/fundamental/utils/estimateTrend';

interface EstimateTrendSectionProps {
    /** 보여 줄 기간(`visibleEstimatePeriods`로 거른 것). 비어 있지 않다 — 호출부가 비면 섹션을 그리지 않는다. */
    periods: readonly VisibleEstimatePeriod[];
    symbol: string;
    locale: Locale;
}

const CHANGE_TONE: Record<EstimateChangeDirection, string> = {
    up: 'text-ui-success-text',
    down: 'text-ui-danger-text',
    flat: 'text-secondary-300',
};

interface ChangeProps {
    label: string;
    value: number | null;
    symbol: string;
    locale: Locale;
}

/**
 * "30일 전보다 ▲ $0.05". 방향은 기호·화면 낭독기 문구·색 셋으로 말한다(색만으로 구분하지 않는다). 표시 단위로
 * 반올림해 0이 되는 변화는 "변동 없음"이다(`estimateChangeDirection`의 단일 기준).
 */
function Change({ label, value, symbol, locale }: ChangeProps) {
    const t = useTranslations('widgets.fundamental');
    if (value === null) return null;
    const amount = formatMoney(Math.abs(value), symbol, locale);
    const direction = estimateChangeDirection(
        value,
        amount === formatMoney(0, symbol, locale)
    );
    return (
        <span className="whitespace-nowrap">
            {label}{' '}
            {direction === 'flat' ? (
                <span className={CHANGE_TONE.flat}>
                    {t('EstimateTrend.noChange')}
                </span>
            ) : (
                <span
                    className={cn(
                        'font-mono tabular-nums',
                        CHANGE_TONE[direction]
                    )}
                >
                    <span aria-hidden="true">
                        {direction === 'up' ? '▲ ' : '▼ '}
                    </span>
                    <span className="sr-only">
                        {direction === 'up'
                            ? t('EstimateTrend.srUp')
                            : t('EstimateTrend.srDown')}{' '}
                    </span>
                    {amount}
                </span>
            )}
        </span>
    );
}

/** Yahoo 집계 추정치 변화 목록. 호출부(`FutureDirectionCard`)가 보여 줄 기간이 있을 때만 그린다. */
export function EstimateTrendSection({
    periods,
    symbol,
    locale,
}: EstimateTrendSectionProps) {
    const t = useTranslations('widgets.fundamental');
    // 키는 호출 자리의 리터럴이어야 추출기가 본다(I18N.md#I18-16). 필수 키 객체라 기간 코드가 늘면 타입 오류가 난다.
    const periodLabels = {
        '0q': t('EstimateTrend.periodThisQuarter'),
        '+1q': t('EstimateTrend.periodNextQuarter'),
        '0y': t('EstimateTrend.periodThisYear'),
        '+1y': t('EstimateTrend.periodNextYear'),
    } satisfies Record<EstimatePeriodCode, string>;

    return (
        <div className="mb-5">
            <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                {t('EstimateTrend.heading')}
                <InfoTooltip>
                    <p>{t('EstimateTrend.tooltipWhat')}</p>
                    <p>{t('EstimateTrend.tooltipSource')}</p>
                </InfoTooltip>
            </h3>
            <ul className="divide-y divide-secondary-700/60 rounded-lg bg-secondary-800/40 px-4">
                {periods.map(row => {
                    const share = revisionShare(row);
                    return (
                        <li key={row.period} className="py-3">
                            <div className="flex items-baseline justify-between gap-3">
                                <p className="text-sm text-secondary-200">
                                    {periodLabels[row.period]}
                                    {row.eps.analysts !== null ? (
                                        <span className="ml-1.5 text-xs text-secondary-400">
                                            {t('EstimateTrend.analysts', {
                                                count: row.eps.analysts,
                                            })}
                                        </span>
                                    ) : null}
                                </p>
                                <p className="font-mono text-base font-semibold tabular-nums">
                                    {formatMoney(row.eps.avg, symbol, locale)}
                                </p>
                            </div>
                            {row.eps.change30d !== null ||
                            row.eps.change90d !== null ? (
                                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-secondary-400">
                                    <Change
                                        label={t('EstimateTrend.vs30d')}
                                        value={row.eps.change30d}
                                        symbol={symbol}
                                        locale={locale}
                                    />
                                    <Change
                                        label={t('EstimateTrend.vs90d')}
                                        value={row.eps.change90d}
                                        symbol={symbol}
                                        locale={locale}
                                    />
                                </p>
                            ) : null}
                            {share !== null ? (
                                <div className="mt-2 flex items-center gap-2 text-xs text-secondary-400">
                                    <span
                                        aria-hidden="true"
                                        className="flex h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-secondary-700"
                                    >
                                        <span
                                            className="bg-ui-success"
                                            style={{
                                                width: `${share.upPct}%`,
                                            }}
                                        />
                                        <span
                                            className="bg-ui-danger"
                                            style={{
                                                width: `${share.downPct}%`,
                                            }}
                                        />
                                    </span>
                                    <span>
                                        {t('EstimateTrend.revisions30d', {
                                            up: share.up,
                                            down: share.down,
                                        })}
                                    </span>
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
