import { formatPriceChange, formatPrice } from '@/shared/lib/priceFormat';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useId } from 'react';
import {
    buildTechnicalFacts,
    buildTechnicalFactsNarrative,
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
    const headingId = useId();
    const facts = buildTechnicalFacts(bars, indicators);
    if (!facts) return null;

    const change = formatVisibleChange(facts.changePercent);
    const narrative = buildTechnicalFactsNarrative(
        symbol,
        facts,
        marketProfile
    );

    return (
        <section
            aria-labelledby={headingId}
            className="bg-secondary-800 flex flex-col gap-3 rounded-lg p-4"
        >
            <h2
                id={headingId}
                className="text-secondary-200 text-sm font-semibold"
            >
                {symbol} 기술적 지표 요약
            </h2>
            <dl className="text-secondary-300 grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">현재가</dt>
                    <dd>
                        {formatPrice(
                            facts.lastClose,
                            getDescriptor(marketProfile).priceFormat
                        )}{' '}
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
                        <dt className="text-secondary-400">MACD 모멘텀</dt>
                        <dd>
                            {technicalFactsMacdMomentumLabel(
                                facts.macdHistogram
                            )}
                        </dd>
                    </div>
                )}
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">최근 252개 봉 위치</dt>
                    <dd>
                        고점 대비 {facts.pctFrom52wHigh.toFixed(1)}%, 저점 대비
                        +{facts.pctAbove52wLow.toFixed(1)}%
                    </dd>
                </div>
            </dl>
            <div className="text-secondary-300 space-y-1 text-sm leading-6">
                {narrative.map(line => (
                    <p key={line}>{line}</p>
                ))}
            </div>
            <p className="text-secondary-400 text-xs">
                위 지표는 표시된 차트 데이터 기반 자동 계산값입니다.
            </p>
        </section>
    );
}
