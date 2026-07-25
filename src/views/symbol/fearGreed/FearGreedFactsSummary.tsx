import { useId } from 'react';
import {
    computeFearGreedIndex,
    type Bar,
    type BuySellVolumeResult,
} from '@y0ngha/siglens-core';
import {
    SENTIMENT_LABEL_TEXT,
    formatConfidenceFooter,
} from '@/shared/lib/fearGreedLabels';
import { buildFearGreedFactorLines } from './utils/fearGreedFacts';

interface FearGreedFactsSummaryProps {
    symbol: string;
    bars: Bar[];
    buySellVolume: BuySellVolumeResult[];
}

/**
 * 서버 계산 공포 탐욕 요약 — 크롤러가 JS 없이도 점수와 5-factor 수치를 받는다.
 * `computeFearGreedIndex`는 `@y0ngha/siglens-core`의 순수 함수(AI 없음,
 * deterministic)라 RSC 본문에서 직접 호출 가능하다. 클라 게이지(`FearGreedPage`)와
 * 상호보완적으로 공존한다 — 사용자에게도 동일한 수치가 보이므로 클로킹이 아니다.
 * `TechnicalFactsSummary`와 동일한 결정적 사실 층 패턴(bars/indicators props →
 * 순수 계산 → null이면 생략).
 */
export function FearGreedFactsSummary({
    symbol,
    bars,
    buySellVolume,
}: FearGreedFactsSummaryProps) {
    const headingId = useId();
    const snapshot = computeFearGreedIndex(bars, buySellVolume);
    if (!snapshot) return null;

    const score = Math.round(snapshot.score);
    const factorLines = buildFearGreedFactorLines(snapshot);

    return (
        <section
            aria-labelledby={headingId}
            className="bg-secondary-800 flex flex-col gap-3 rounded-lg p-4"
        >
            <h2
                id={headingId}
                className="text-secondary-200 text-sm font-semibold"
            >
                {symbol} 공포 탐욕 지수 요약
            </h2>
            <dl className="text-secondary-300 grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">현재 점수</dt>
                    <dd>
                        {score} / 100 ({SENTIMENT_LABEL_TEXT[snapshot.label]})
                    </dd>
                </div>
            </dl>
            <div className="text-secondary-300 space-y-1 text-sm leading-6">
                {factorLines.map(line => (
                    <p key={line}>{line}</p>
                ))}
            </div>
            <p className="text-secondary-400 text-xs">
                {formatConfidenceFooter(
                    snapshot.sampleSize,
                    snapshot.confidence
                )}
            </p>
        </section>
    );
}
