/**
 * 전망과 목표가 카드의 실적 추정치 변화 섹션(Yahoo 집계). 기간마다 지금 EPS 추정치와, 30·90일 전보다 얼마나
 * 올랐거나 내렸는지, 최근 30일 동안 추정치를 올린·내린 애널리스트 수를 보여 준다.
 */
import { useTranslations } from 'next-intl';
import type { AnalystEstimatePeriod } from '@/entities/analyst-views/model';
import type { Locale } from '@/shared/i18n/locales';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { formatMoney } from '@/widgets/fundamental/utils/moneyFormat';
import {
    estimateChangeDirection,
    revisionShare,
    type EstimateChangeDirection,
} from '@/widgets/fundamental/utils/estimateTrend';

interface EstimateTrendSectionProps {
    /** 보여 줄 기간(`visibleEstimatePeriods`로 거른 것). 비어 있지 않다 — 호출부가 비면 섹션을 그리지 않는다. */
    periods: readonly AnalystEstimatePeriod[];
    symbol: string;
    locale: Locale;
}

const CHANGE_TONE: Record<EstimateChangeDirection, string> = {
    up: 'text-ui-success-text',
    down: 'text-ui-danger-text',
    flat: 'text-secondary-300',
};

/** 기간 코드(`0q`·`+1q`·`0y`·`+1y`)를 화면 라벨로. */
function usePeriodLabel() {
    const t = useTranslations('widgets.fundamental');
    return (period: string): string =>
        period === '0q'
            ? t('EstimateTrend.periodThisQuarter')
            : period === '+1q'
              ? t('EstimateTrend.periodNextQuarter')
              : period === '0y'
                ? t('EstimateTrend.periodThisYear')
                : t('EstimateTrend.periodNextYear');
}

interface ChangeProps {
    label: string;
    value: number | null;
    symbol: string;
    locale: Locale;
}

/**
 * "30일 전보다 ▲ $0.05". 방향은 기호와 색 둘 다로 말한다(색만으로 구분하지 않는다). 표시 단위(달러 센트, 원)로
 * 반올림해 0이 되는 변화는 "변동 없음"이다 — `▼ US$0.00`처럼 방향과 값이 어긋나 보이지 않게.
 */
function Change({ label, value, symbol, locale }: ChangeProps) {
    const t = useTranslations('widgets.fundamental');
    if (value === null) return null;
    const amount = formatMoney(Math.abs(value), symbol, locale);
    const direction =
        amount === formatMoney(0, symbol, locale)
            ? 'flat'
            : estimateChangeDirection(value);
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

/** 기간별 추정치 변화 목록. */
export function EstimateTrendSection({
    periods,
    symbol,
    locale,
}: EstimateTrendSectionProps) {
    const t = useTranslations('widgets.fundamental');
    const periodLabel = usePeriodLabel();

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
                                    {periodLabel(row.period)}
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
