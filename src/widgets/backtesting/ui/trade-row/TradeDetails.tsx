'use client';

import { useTranslations } from 'next-intl';
import type { BacktestTrade } from '@y0ngha/siglens-core';
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { LEG_REASON_KEY } from '../../utils/tradeLabels';

interface TradeDetailsProps {
    trade: BacktestTrade;
}

const price = (value: number) => value.toFixed(2);

/** 펼친 매매 행의 본문: 판단일·매수, 절반별 청산, 진입 때 계획, AI 요약, 재분석 횟수, 아카이브 경로. */
export function TradeDetails({ trade }: TradeDetailsProps) {
    const t = useTranslations('widgets.backtesting.tradeRow');
    const plan = trade.initialPlan;

    return (
        <div className="space-y-2 border-t border-secondary-700/60 px-3 py-3 text-xs text-secondary-400">
            <p className="tabular-nums">
                {t('decision', {
                    v0: trade.decisionDate,
                    v1: trade.entryDate,
                    v2: price(trade.entryPrice),
                })}
            </p>
            <ul className="space-y-0.5 tabular-nums">
                {trade.legs.map(leg => (
                    <li key={leg.name}>
                        {t('leg', {
                            v0: leg.name,
                            v1: leg.exitDate,
                            v2: price(leg.exitPrice),
                            v3: t(LEG_REASON_KEY[leg.reason]),
                            v4: formatSignedPercent(leg.returnPct, 2),
                        })}
                    </li>
                ))}
            </ul>
            <p className="tabular-nums">
                {t('plan', {
                    v0: price(plan.tp1),
                    v1: price(plan.tpFinal),
                    v2: price(plan.sl1),
                    v3: price(plan.sl2),
                })}
            </p>
            <div>
                <p className="font-semibold text-secondary-300">
                    {t('summaryHeading')}
                </p>
                <p className="mt-0.5 leading-relaxed text-pretty">
                    {trade.summary}
                </p>
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
                <span>{t('reviews', { v0: trade.holdingReviews })}</span>
                <Link
                    href={`/${trade.ticker}`}
                    prefetch={false}
                    className="text-primary-400 underline-offset-2 hover:underline"
                >
                    {t('symbolLink', { v0: trade.ticker })}
                </Link>
            </p>
            {trade.promptFile !== undefined &&
                trade.responseFile !== undefined && (
                    <p className="font-mono text-[11px] break-all text-secondary-500">
                        {t('files', {
                            v0: trade.promptFile,
                            v1: trade.responseFile,
                        })}
                    </p>
                )}
        </div>
    );
}
