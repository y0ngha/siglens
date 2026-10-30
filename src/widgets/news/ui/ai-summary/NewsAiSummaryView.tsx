'use client';

/**
 * 집계 AI 분석 결과 카드 — 전체 감성 배지, 현재 동인, 핵심·예정 사건 목록.
 */
import { useTranslations } from 'next-intl';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import {
    SENTIMENT_CLASS,
    SENTIMENT_LABEL_KEY,
} from '@/shared/lib/sentimentDisplay';
import { EventBulletList } from './EventBulletList';
import { SummaryTitle } from './SummaryTitle';

interface NewsAiSummaryViewProps {
    result: NewsAnalysisResponse;
}

/** 감성 배지 색은 공유 `SENTIMENT_CLASS`를 쓴다(AA 대비 보정 포함). */
export function NewsAiSummaryView({ result }: NewsAiSummaryViewProps) {
    const t = useTranslations('widgets.news');
    // 추출기의 동적 키 탐지는 이 파일 안에서 번역자를 직접 호출하는 패턴만 본다 —
    // `SENTIMENT_LABEL_KEY[...]`를 그대로 `tLabel(...)`에 넣어야 `shared.enumLabel`이 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <section
            aria-labelledby="news-ai-summary-heading"
            className={cn(
                SURFACE_CARD,
                'w-full max-w-full min-w-0 overflow-hidden p-6 motion-safe:animate-[fade-in_200ms_ease-out]'
            )}
        >
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <SummaryTitle headingId="news-ai-summary-heading" />
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        SENTIMENT_CLASS[result.overallSentiment]
                    )}
                >
                    {tLabel(SENTIMENT_LABEL_KEY[result.overallSentiment])}
                </span>
            </div>

            <p className="mb-4 text-sm leading-relaxed wrap-break-word text-secondary-400">
                {result.currentDriverKo}
            </p>

            {result.keyEventsKo.length > 0 && (
                <div className="mb-4">
                    <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                        {t('NewsAiSummary.d65c2f')}
                    </h3>
                    <EventBulletList
                        events={result.keyEventsKo}
                        marker="•"
                        ariaLabel={t('NewsAiSummary.3cad3e')}
                    />
                </div>
            )}

            {result.upcomingEventsKo.length > 0 && (
                <div>
                    <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                        {t('NewsAiSummary.1244e3')}
                    </h3>
                    <EventBulletList
                        events={result.upcomingEventsKo}
                        marker="⚠"
                        markerClassName="text-ui-warning-text"
                        ariaLabel={t('NewsAiSummary.a96ba1')}
                    />
                </div>
            )}
        </section>
    );
}
