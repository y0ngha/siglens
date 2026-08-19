import { useTranslations } from 'next-intl';
import { formatPriceChange, formatPrice } from '@/shared/lib/priceFormat';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useId } from 'react';
import {
    buildTechnicalFacts,
    buildTechnicalFactsNarrative,
    RECENT_BARS_WINDOW,
    technicalFactsMacdMomentumLabel,
    technicalFactsRsiZone,
} from './utils/technicalFacts';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';

interface ChangeDisplay {
    colorClass: string;
    text: string;
}

function formatVisibleChange(changePercent: number): ChangeDisplay {
    if (changePercent === 0) {
        return {
            colorClass: 'text-secondary-300',
            text: '0.00% 보합',
        };
    }

    const change = formatPriceChange(changePercent);
    return {
        colorClass: change.colorClass,
        text: `${change.arrow} ${change.sign}${Math.abs(changePercent).toFixed(2)}%`,
    };
}

interface TechnicalFactsSummaryProps {
    symbol: string;
    bars: readonly Bar[];
    indicators: IndicatorResult;
    /**
     * Market profile id — drives price formatting.
     * Defaults to 'us-equity' (fixed 2dp) for backward compatibility.
     * Pass 'crypto' to enable dynamic-by-magnitude precision for sub-cent tokens.
     */
    marketProfile?: MarketProfileId;
}

/**
 * AI 서사가 없을 때(cold-miss) AI 패널 슬롯을 채우는 결정적 사실 층.
 * 차트가 시각화하는 것과 동일한 실측 데이터를 크롤 가능한 텍스트로 노출한다
 * (클로킹 아님 — 사용자에게도 동일하게 보임). LLM 비용 0.
 */
export function TechnicalFactsSummary({
    symbol,
    bars,
    indicators,
    marketProfile = 'us-equity',
}: TechnicalFactsSummaryProps) {
    const t = useTranslations('views.symbol');
    const headingId = useId();
    const facts = buildTechnicalFacts(bars, indicators);
    if (!facts) return null;

    const change = formatVisibleChange(facts.changePercent);
    const { quoteDelayMinutes, priceFormat } = getDescriptor(marketProfile);
    const narrative = buildTechnicalFactsNarrative(
        symbol,
        facts,
        marketProfile
    );

    return (
        <section
            aria-labelledby={headingId}
            className="flex flex-col gap-3 rounded-lg bg-secondary-800 p-4"
        >
            <h2
                id={headingId}
                className="text-sm font-semibold text-secondary-200"
            >
                {t('TechnicalFactsSummary.170a59', { v0: symbol })}
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm text-secondary-300">
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">
                        {t('TechnicalFactsSummary.497d1e')}
                        {/* 지연 시세를 실시간으로 오독하지 않도록 라벨에 바로 붙인다.
                            값 옆이 아니라 라벨에 두는 이유: 가격·등락률과 한 줄에 섞이면
                            숫자의 일부처럼 읽힌다. */}
                        {quoteDelayMinutes > 0 && (
                            <span className="ml-1 text-xs font-normal text-secondary-500">
                                (
                                {t('TechnicalFactsSummary.e532e4', {
                                    v0: quoteDelayMinutes,
                                })}
                            </span>
                        )}
                    </dt>
                    <dd>
                        {formatPrice(facts.lastClose, priceFormat)}{' '}
                        <span className={change.colorClass}>{change.text}</span>
                    </dd>
                </div>
                {facts.rsi !== null && (
                    <div className="flex justify-between gap-4">
                        <dt className="text-secondary-400">RSI</dt>
                        <dd>
                            {`${facts.rsi.toFixed(1)} (${technicalFactsRsiZone(facts.rsi)})`}
                        </dd>
                    </div>
                )}
                {facts.macdHistogram !== null && (
                    <div className="flex justify-between gap-4">
                        <dt className="text-secondary-400">
                            {t('TechnicalFactsSummary.d8446c')}
                        </dt>
                        <dd>
                            {technicalFactsMacdMomentumLabel(
                                facts.macdHistogram
                            )}
                        </dd>
                    </div>
                )}
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">
                        {`최근 ${RECENT_BARS_WINDOW}개 봉 위치`}
                    </dt>
                    <dd>
                        {t('TechnicalFactsSummary.269f7b', {
                            v0: facts.pctFrom52wHigh.toFixed(1),
                            v1: facts.pctAbove52wLow.toFixed(1),
                        })}
                        %
                    </dd>
                </div>
            </dl>
            <div className="space-y-1 text-sm leading-6 text-secondary-300">
                {narrative.map(line => (
                    <p key={line}>{line}</p>
                ))}
            </div>
            <p className="text-xs text-secondary-400">
                {t('TechnicalFactsSummary.beae1d')}
            </p>
        </section>
    );
}
