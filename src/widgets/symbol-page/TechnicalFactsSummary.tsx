import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { RSI_OVERBOUGHT_LEVEL, RSI_OVERSOLD_LEVEL } from '@y0ngha/siglens-core';
import { formatUsdCurrency, formatPriceChange } from '@/shared/lib/priceFormat';
import { buildTechnicalFacts } from './utils/technicalFacts';

function rsiZone(rsi: number): string {
    if (rsi >= RSI_OVERBOUGHT_LEVEL) return '과매수';
    if (rsi <= RSI_OVERSOLD_LEVEL) return '과매도';
    return '중립';
}

interface TechnicalFactsSummaryProps {
    symbol: string;
    bars: readonly Bar[];
    indicators: IndicatorResult;
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
}: TechnicalFactsSummaryProps) {
    const facts = buildTechnicalFacts(bars, indicators);
    if (!facts) return null;

    const change = formatPriceChange(facts.changePercent);

    return (
        <section
            aria-labelledby="tech-facts-heading"
            className="bg-secondary-800 flex flex-col gap-3 rounded-lg p-4"
        >
            <h2
                id="tech-facts-heading"
                className="text-secondary-200 text-sm font-semibold"
            >
                {symbol} 기술적 지표 요약
            </h2>
            <dl className="text-secondary-300 grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">현재가</dt>
                    <dd>
                        {formatUsdCurrency(facts.lastClose)}{' '}
                        <span className={change.colorClass}>
                            {change.arrow} {change.sign}
                            {Math.abs(facts.changePercent).toFixed(2)}%
                        </span>
                    </dd>
                </div>
                {facts.rsi !== null && (
                    <div className="flex justify-between gap-4">
                        <dt className="text-secondary-400">RSI</dt>
                        <dd>
                            {facts.rsi.toFixed(1)} ({rsiZone(facts.rsi)})
                        </dd>
                    </div>
                )}
                {facts.macdHistogram !== null && (
                    <div className="flex justify-between gap-4">
                        <dt className="text-secondary-400">MACD 모멘텀</dt>
                        <dd>{facts.macdHistogram >= 0 ? '상승' : '하락'}</dd>
                    </div>
                )}
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">52주 위치</dt>
                    <dd>
                        고점 대비 {facts.pctFrom52wHigh.toFixed(1)}%, 저점 대비
                        +{facts.pctAbove52wLow.toFixed(1)}%
                    </dd>
                </div>
            </dl>
            <p className="text-secondary-500 text-xs">
                AI 종합 분석은 곧 생성됩니다. 위 지표는 실시간 시세 기반 자동
                계산값입니다.
            </p>
        </section>
    );
}
