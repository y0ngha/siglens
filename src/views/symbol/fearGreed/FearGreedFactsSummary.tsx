import { useTranslations } from 'next-intl';
import { useId } from 'react';
import type { Bar, BuySellVolumeResult } from '@y0ngha/siglens-core';
import {
    SENTIMENT_LABEL_KEY,
    WARNING_TEXT_KEY,
} from '@/shared/lib/fearGreedLabels';
import {
    buildFearGreedSummaryModel,
    type FearGreedMarketReading,
} from './utils/fearGreedSummaryModel';
import { FearGreedExtremeZoneRecord } from './FearGreedExtremeZoneRecord';
import { FearGreedFactorTable } from './FearGreedFactorTable';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SampleFooterText } from '@/shared/ui/SampleFooterText';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { AnalysisProvenanceNote } from '../snapshot/AnalysisProvenanceNote';

interface FearGreedFactsSummaryProps {
    symbol: string;
    /** 출처 고지(`AnalysisProvenanceNote`)가 시장별 데이터 출처를 고르는 데 쓴다. */
    marketProfile: MarketProfileId;
    /** 페이지가 `symbolFearGreedInputs`로 넘긴 5년 일봉. */
    bars: Bar[];
    buySellVolume: BuySellVolumeResult[];
    /**
     * 이 종목이 속한 시장의 최신 공포·탐욕 판독과 그 시장 이름(예: `미국 증시`).
     * 둘은 한 문장에 함께 쓰이므로 묶어서 받는다 — 판독만 있고 이름이 빈 문장이
     * 생길 수 없다. 같은 날짜 점수가 있을 때만 차이 문장을 낸다. 조회 실패·미제공은 `null`.
     */
    market?: FearGreedMarketReading | null;
}

/**
 * 서버 계산 공포 탐욕 요약 — 크롤러가 JS 없이도 점수와 5-factor 수치를 받는다.
 * 계산은 `@y0ngha/siglens-core`의 결정적 순수 함수(AI 없음)라 RSC 본문에서 직접 호출한다.
 * 클라 게이지(`FearGreedPage`)와 같은 수치를 보이므로 클로킹이 아니다. `TechnicalFactsSummary`와
 * 같은 결정적 사실 층 패턴이다(입력 → 순수 계산 → null이면 생략).
 */
export function FearGreedFactsSummary({
    symbol,
    marketProfile,
    bars,
    buySellVolume,
    market = null,
}: FearGreedFactsSummaryProps) {
    const t = useTranslations('views.symbol');
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는
    // 패턴"만 본다 — `SENTIMENT_LABEL_KEY[...]`를 그대로 `tLabel(...)`에
    // 넣어야 `shared.enumLabel`이 이 라우트의 클라이언트 번들에 실린다
    // (fearGreedLabels.ts의 SENTIMENT_LABEL_KEY export 주석 참고).
    const tLabel = useTranslations('shared.enumLabel');
    const tFacts = useTranslations('views.symbol.fearGreedFacts');
    const tFactor = useTranslations('shared.lib.fearGreedFactor');
    const tFearGreed = useTranslations('shared.lib.fearGreed');
    const locale = useResolvedLocale();
    const headingId = useId();
    const model = buildFearGreedSummaryModel(
        { bars, buySellVolume, market, locale },
        { tLabel, tFacts, tFactor }
    );
    if (model === null) return null;
    const { snapshot } = model;

    return (
        <section
            aria-labelledby={headingId}
            className="flex flex-col gap-3 rounded-lg bg-secondary-800 p-4"
        >
            {/* 기준 시점 앞의 공백은 실제 텍스트다 — 여백만 두면 제목의 textContent가
                `…요약(2026-10-28 종가 기준)`처럼 붙는다. */}
            <h2 id={headingId} className={HEADING_SECTION}>
                {symbol} {t('FearGreedFactsSummary.fabc11')}
                {model.asOfLabel !== null && (
                    <>
                        {' '}
                        <span className="ml-1 font-normal text-secondary-400">
                            {t('FearGreedFactsSummary.asOfClose', {
                                v0: model.asOfLabel,
                            })}
                        </span>
                    </>
                )}
            </h2>
            {/* 서술 문장이 점수 행(`<dl>`)보다 DOM에서 앞서야 한다 — 네이버가 본문
                첫 텍스트로 스니펫을 만든다(`TechnicalFactsSummary`와 같은 이유). */}
            <div className="space-y-1 text-sm leading-6 text-secondary-300">
                {model.timeSeriesLines.map(line => (
                    <p key={line}>{line}</p>
                ))}
                {snapshot.warning !== null && (
                    <p>{tFearGreed(WARNING_TEXT_KEY[snapshot.warning])}</p>
                )}
                {model.groupComparisonLine !== null && (
                    <p>{model.groupComparisonLine}</p>
                )}
                {model.factorRankingLine !== null && (
                    <p>{model.factorRankingLine}</p>
                )}
            </div>
            <FearGreedFactorTable table={model.factorTable} />
            <dl className="grid grid-cols-1 gap-2 text-sm text-secondary-300">
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">
                        {t('FearGreedFactsSummary.fa167e')}
                    </dt>
                    {/* 괄호를 메시지 안에 둔다 — 괄호 문자는 로케일이 정한다. */}
                    <dd>
                        {t('FearGreedFactsSummary.scoreValue', {
                            v0: model.score,
                            v1: tLabel(SENTIMENT_LABEL_KEY[snapshot.label]),
                        })}
                    </dd>
                </div>
            </dl>
            <p className="text-xs text-secondary-400">
                <SampleFooterText
                    confidence={snapshot.confidence}
                    sampleSize={snapshot.sampleSize}
                />
            </p>
            {model.extremeZoneRecord !== null && (
                <FearGreedExtremeZoneRecord record={model.extremeZoneRecord} />
            )}
            {/* AI 서술 없이 규칙으로만 계산한 점수라는 고지. 요약 문장 전부 아래에 둔다. */}
            <AnalysisProvenanceNote
                marketProfile={marketProfile}
                variant="rule-based"
            />
        </section>
    );
}
