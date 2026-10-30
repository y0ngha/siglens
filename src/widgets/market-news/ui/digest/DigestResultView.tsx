/**
 * 완성된 다이제스트 본문.
 */
import { useTranslations } from 'next-intl';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import {
    SENTIMENT_LABEL_KEY,
    SENTIMENT_CLASS,
    isNewsSentiment,
} from '@/shared/lib/sentimentDisplay';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { DigestEventList } from './DigestEventList';

interface DigestResultViewProps {
    result: NewsAnalysisResponse;
}

/** 제목(`market-news-digest-heading`) · 전체 감성 배지 · 현재 동인 · 핵심/예정 이벤트. */
export function DigestResultView({ result }: DigestResultViewProps) {
    const t = useTranslations('widgets.market-news');
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는
    // 패턴"만 본다 — `SENTIMENT_LABEL_KEY[...]`를 그대로 번역자에 넣어야
    // `shared.enumLabel`이 이 라우트의 클라이언트 번들에 실린다
    // (sentimentDisplay.ts의 SENTIMENT_LABEL_KEY export 주석 참고).
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <section
            aria-labelledby="market-news-digest-heading"
            className={cn(
                SURFACE_CARD,
                'w-full max-w-full min-w-0 overflow-hidden p-6 motion-safe:animate-[fade-in_200ms_ease-out]'
            )}
        >
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <h2 id="market-news-digest-heading" className={HEADING_SECTION}>
                    {t('MarketNewsDigest.69a497')}
                </h2>
                {isNewsSentiment(result.overallSentiment) && (
                    <span
                        className={cn(
                            'rounded px-2 py-0.5 text-xs font-medium',
                            SENTIMENT_CLASS[result.overallSentiment]
                        )}
                    >
                        {tLabel(SENTIMENT_LABEL_KEY[result.overallSentiment])}
                    </span>
                )}
            </div>

            <p className="mb-4 text-sm leading-relaxed wrap-break-word text-secondary-400">
                {result.currentDriverKo}
            </p>

            <DigestEventList
                events={result.keyEventsKo}
                heading={t('MarketNewsDigest.77f553')}
                listLabel={t('MarketNewsDigest.569722')}
                marker="•"
                markerClassName="mt-0.5 shrink-0"
                className="mb-4"
            />

            <DigestEventList
                events={result.upcomingEventsKo}
                heading={t('MarketNewsDigest.29339e')}
                listLabel={t('MarketNewsDigest.a404a6')}
                marker="⚠"
                markerClassName="mt-0.5 shrink-0 text-ui-warning-text"
            />
        </section>
    );
}
