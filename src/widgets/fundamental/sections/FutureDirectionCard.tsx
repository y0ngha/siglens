import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { Locale } from '@/shared/i18n/locales';
import { formatCurrencyForSymbol } from '@/shared/lib/priceFormat';
import { EmptySectionCard } from './EmptySectionCard';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { formatCompactCurrency } from '@/shared/lib/priceFormat';
import type {
    FundamentalAnalystEstimateInput,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';
import type { CSSProperties, ReactNode } from 'react';

const HEADING_ID = 'future-heading';
const HEADING_CLASS_NAME = 'mb-4 text-lg font-semibold tracking-tight';

interface FutureDirectionCardProps {
    /** 표기 통화를 정하기 위해 필요하다 — 국내 종목은 원화다. */
    symbol: string;
    estimates: FundamentalAnalystEstimateInput | null;
    grades: FundamentalGradesConsensusInput | null;
    ptConsensus: FundamentalPriceTargetConsensusInput | null;
    ptSummary: FundamentalPriceTargetSummaryInput | null;
}

interface GradesBarProps {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
}

function pct(value: number, total: number): string {
    return ((value / total) * 100).toFixed(1);
}

// 통화 판정은 `formatCurrencyForSymbol`이 한다 — 예전에는 이 파일이 `'ko-KR'`
// 고정 포매터 테이블을 따로 갖고 있어서, 비-ko 로케일에서도 한국어 표기 규칙이
// 적용됐다. 국내 종목의 원화 금액에 `US$`를 붙이던 결함도 같은 자리였다
// (`목표 주가 US$450,000`은 같은 사이트가 차트 탭에서 `₩274,500`으로 쓰는 값이다).
function fmtMoney(v: number | null, symbol: string, locale: Locale): string {
    if (v === null) return '—';
    return formatCurrencyForSymbol(v, symbol, locale);
}

function fmtBig(v: number | null, symbol: string, locale: Locale): string {
    return v !== null ? formatCompactCurrency(v, symbol, locale) : '—';
}

function GradesBar({ strongBuy, buy, hold, sell, strongSell }: GradesBarProps) {
    const t = useTranslations('widgets.fundamental');
    const tRating = useTranslations('widgets.fundamental.analystRating');
    const total = strongBuy + buy + hold + sell + strongSell;
    if (total === 0) return null;

    return (
        <div className="mt-3">
            <div className="flex overflow-hidden rounded-md" aria-hidden="true">
                {strongBuy > 0 && (
                    <div
                        title={tRating('strongBuy', { v0: strongBuy })}
                        className="h-3 w-(--bar-w) bg-ui-success"
                        style={
                            {
                                '--bar-w': `${pct(strongBuy, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
                {buy > 0 && (
                    <div
                        title={tRating('buy', { v0: buy })}
                        className="h-3 w-(--bar-w) bg-ui-success/60"
                        style={
                            {
                                '--bar-w': `${pct(buy, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
                {hold > 0 && (
                    <div
                        title={tRating('hold', { v0: hold })}
                        className="h-3 w-(--bar-w) bg-ui-warning"
                        style={
                            {
                                '--bar-w': `${pct(hold, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
                {sell > 0 && (
                    <div
                        title={tRating('sell', { v0: sell })}
                        className="h-3 w-(--bar-w) bg-ui-danger/60"
                        style={
                            {
                                '--bar-w': `${pct(sell, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
                {strongSell > 0 && (
                    <div
                        title={tRating('strongSell', { v0: strongSell })}
                        className="h-3 w-(--bar-w) bg-ui-danger"
                        style={
                            {
                                '--bar-w': `${pct(strongSell, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
            </div>
            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-success"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">
                        {t('FutureDirectionCard.cb528c')}
                    </dt>
                    <dd className="font-mono font-medium">{strongBuy}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-success/60"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">
                        {t('FutureDirectionCard.31e4d3')}
                    </dt>
                    <dd className="font-mono font-medium">{buy}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-warning"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">
                        {t('FutureDirectionCard.6640f0')}
                    </dt>
                    <dd className="font-mono font-medium">{hold}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-danger/60"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">
                        {t('FutureDirectionCard.62a65c')}
                    </dt>
                    <dd className="font-mono font-medium">{sell}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-danger"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">
                        {t('FutureDirectionCard.00129a')}
                    </dt>
                    <dd className="font-mono font-medium">{strongSell}</dd>
                </div>
            </dl>
        </div>
    );
}

export function FutureDirectionCard({
    symbol,
    estimates,
    grades,
    ptConsensus,
    ptSummary,
}: FutureDirectionCardProps) {
    const t = useTranslations('widgets.fundamental');
    const locale = useResolvedLocale();
    if (estimates === null && grades === null && ptConsensus === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title={t('FutureDirectionCard.c629ac')}
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {t('FutureDirectionCard.2e31de')}
            </h2>

            {estimates !== null && (
                <div className="mb-5">
                    <h3 className="mb-2 text-xs font-medium tracking-widest text-secondary-400 uppercase">
                        {t('FutureDirectionCard.dba802')}
                    </h3>
                    <dl className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-secondary-800/40 px-4 py-3">
                            <dt className="text-xs text-secondary-400">
                                {t('FutureDirectionCard.bd4c6d')}
                                <InfoTooltip>
                                    <p>{t('FutureDirectionCard.b21bb3')}</p>
                                    <p>{t('FutureDirectionCard.973dba')}</p>
                                </InfoTooltip>
                            </dt>
                            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                                {fmtMoney(
                                    estimates.estimatedEpsAvg,
                                    symbol,
                                    locale
                                )}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-secondary-800/40 px-4 py-3">
                            <dt className="text-xs text-secondary-400">
                                {t('FutureDirectionCard.69de00')}
                                <InfoTooltip>
                                    <p>{t('FutureDirectionCard.f23e65')}</p>
                                    <p>{t('FutureDirectionCard.dea4fe')}</p>
                                </InfoTooltip>
                            </dt>
                            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                                {fmtBig(
                                    estimates.estimatedRevenueAvg,
                                    symbol,
                                    locale
                                )}
                            </dd>
                        </div>
                    </dl>
                </div>
            )}

            {ptConsensus !== null && (
                <div className="mb-5">
                    <h3 className="mb-2 text-xs font-medium tracking-widest text-secondary-400 uppercase">
                        {t('FutureDirectionCard.dbfbf1')}
                    </h3>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                        {
                            // TS infers (string | number | null)[][] from the entries array; the source
                            // data is structurally [string, number | null] per the priceTargetSummary shape.
                            (
                                [
                                    [
                                        t('FutureDirectionCard.b84f07'),
                                        ptConsensus.targetLow,
                                        undefined,
                                    ],
                                    [
                                        t('FutureDirectionCard.7e0ea3'),
                                        ptConsensus.targetMedian,
                                        undefined,
                                    ],
                                    [
                                        t('FutureDirectionCard.a06069'),
                                        ptConsensus.targetConsensus,
                                        <>
                                            <p>
                                                {t(
                                                    'FutureDirectionCard.2d8af0'
                                                )}
                                            </p>
                                            <p>
                                                {t(
                                                    'FutureDirectionCard.0b21ed'
                                                )}
                                            </p>
                                        </>,
                                    ],
                                    [
                                        t('FutureDirectionCard.5f23f6'),
                                        ptConsensus.targetHigh,
                                        undefined,
                                    ],
                                ] as [
                                    string,
                                    number | null,
                                    ReactNode | undefined,
                                ][]
                            ) // 위 리터럴 entries가 항상 [라벨, ptConsensus 필드, tooltip?] 튜플이므로 narrowing 안전.
                                .map(([label, val, tooltip]) => (
                                    <div key={label}>
                                        <dt className="text-xs text-secondary-400">
                                            {label}
                                            {tooltip !== undefined && (
                                                <InfoTooltip>
                                                    {tooltip}
                                                </InfoTooltip>
                                            )}
                                        </dt>
                                        <dd className="font-mono text-sm font-medium tabular-nums">
                                            {fmtMoney(val, symbol, locale)}
                                        </dd>
                                    </div>
                                ))
                        }
                    </dl>
                    {ptSummary !== null && (
                        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                            <div className="flex gap-1">
                                <dt className="text-secondary-400">
                                    {t('FutureDirectionCard.c1648d')}
                                </dt>
                                <dd className="font-mono">
                                    {fmtMoney(
                                        ptSummary.lastMonth.avgPriceTarget,
                                        symbol,
                                        locale
                                    )}
                                </dd>
                            </div>
                            <div className="flex gap-1">
                                <dt className="text-secondary-400">
                                    {t('FutureDirectionCard.f7b7b3')}
                                </dt>
                                <dd className="font-mono">
                                    {fmtMoney(
                                        ptSummary.lastQuarter.avgPriceTarget,
                                        symbol,
                                        locale
                                    )}
                                </dd>
                            </div>
                            <div className="flex gap-1">
                                <dt className="text-secondary-400">
                                    {t('FutureDirectionCard.49aace')}
                                </dt>
                                <dd className="font-mono">
                                    {fmtMoney(
                                        ptSummary.lastYear.avgPriceTarget,
                                        symbol,
                                        locale
                                    )}
                                </dd>
                            </div>
                        </dl>
                    )}
                </div>
            )}

            {grades !== null && (
                <div>
                    <h3 className="mb-1 text-xs font-medium tracking-widest text-secondary-400 uppercase">
                        {t('FutureDirectionCard.5039cb')}
                        <InfoTooltip>
                            <p>{t('FutureDirectionCard.b69220')}</p>
                            <p>{t('FutureDirectionCard.ebde29')}</p>
                        </InfoTooltip>
                    </h3>
                    <GradesBar
                        strongBuy={grades.strongBuy}
                        buy={grades.buy}
                        hold={grades.hold}
                        sell={grades.sell}
                        strongSell={grades.strongSell}
                    />
                </div>
            )}
        </section>
    );
}
