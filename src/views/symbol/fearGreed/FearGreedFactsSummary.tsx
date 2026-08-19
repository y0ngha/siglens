import { useId } from 'react';
import {
    computeFearGreedIndex,
    computeFearGreedHistory,
    type Bar,
    type BuySellVolumeResult,
} from '@y0ngha/siglens-core';
import {
    SENTIMENT_LABEL_TEXT,
    WARNING_TEXT,
    formatConfidenceFooter,
} from '@/shared/lib/fearGreedLabels';
import {
    buildFearGreedFactorLines,
    buildFearGreedGroupComparisonLine,
    buildFearGreedFactorRankingLine,
    buildFearGreedPeriodComparisonLine,
    buildFearGreedYearRangeLine,
    buildFearGreedRegimeDistributionLine,
    scoredHistory,
} from './utils/fearGreedFacts';

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
    // audit fix FIX 6 (option b): genuinely per-symbol narrative sentences
    // built from group scores / factor ranking (numbers that already exist
    // in `snapshot` but were unused) — materially improves the
    // unique:boilerplate ratio over the fixed-template factor lines alone.
    const groupComparisonLine = buildFearGreedGroupComparisonLine(snapshot);
    const factorRankingLine = buildFearGreedFactorRankingLine(snapshot);

    // 시계열 문장 3종. `useFearGreed`가 **매 클라이언트 로드마다** 이미 부르는 계산이라,
    // ISR 재생성(24h)당 한 번 서버에서 도는 건 총량으로는 오히려 싸다. 새 fetch도,
    // 새 의존성도 없다 — 같은 `bars`/`buySellVolume`을 그대로 쓴다.
    //
    // 왜 필요한가: 이 페이지는 283개 URL이 서로 76.7% 겹치는 준중복 상태였고(5-gram
    // Jaccard 실측, 형제 탭은 21~27%), 심볼별로 실제 달라지는 텍스트가 페이지의 4%뿐이었다.
    // 아래 세 문장은 날짜·점수·체류일이 들어가 그 비율을 실질적으로 끌어올린다.
    // 전부 로그인 없이 보이는 클라이언트 화면의 부분집합이라 클로킹이 아니다.
    const points = scoredHistory(computeFearGreedHistory(bars, buySellVolume));
    const timeSeriesLines = [
        buildFearGreedPeriodComparisonLine(points),
        buildFearGreedYearRangeLine(points),
        buildFearGreedRegimeDistributionLine(points),
    ].filter((line): line is string => line !== null);

    return (
        <section
            aria-labelledby={headingId}
            className="flex flex-col gap-3 rounded-lg bg-secondary-800 p-4"
        >
            <h2
                id={headingId}
                className="text-sm font-semibold text-secondary-200"
            >
                {symbol} 공포 탐욕 지수 요약
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm text-secondary-300">
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">현재 점수</dt>
                    <dd>
                        {score} / 100 ({SENTIMENT_LABEL_TEXT[snapshot.label]})
                    </dd>
                </div>
            </dl>
            <div className="space-y-1 text-sm leading-6 text-secondary-300">
                {timeSeriesLines.map(line => (
                    <p key={line}>{line}</p>
                ))}
                {snapshot.warning !== null && (
                    <p>{WARNING_TEXT[snapshot.warning]}</p>
                )}
                {groupComparisonLine !== null && <p>{groupComparisonLine}</p>}
                {factorRankingLine !== null && <p>{factorRankingLine}</p>}
                {factorLines.map((line, i) => (
                    <p key={`line-${i}-${line}`}>{line}</p>
                ))}
            </div>
            <p className="text-xs text-secondary-400">
                {formatConfidenceFooter(
                    snapshot.sampleSize,
                    snapshot.confidence
                )}
            </p>
        </section>
    );
}
