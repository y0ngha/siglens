/**
 * AI 요약의 감성 배지 — 전체 결론 헤더와 축별 행이 크기만 달리 공유한다.
 */
import { useTranslations } from 'next-intl';
import type { FinancialsSentiment } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import {
    SENTIMENT_CLASS,
    SENTIMENT_LABEL_KEY,
} from '@/shared/lib/sentimentDisplay';

interface SentimentBadgeProps {
    sentiment: FinancialsSentiment;
    /** 배지 크기(패딩) 클래스 — 헤더와 행이 다르다. */
    sizeClassName: string;
}

/**
 * 감성 값을 색과 라벨로 보여 주는 배지.
 *
 * `tLabel(SENTIMENT_LABEL_KEY[...])`는 이 파일에서 번역자를 직접 호출해야 한다 — extract.mjs의
 * 동적 키 탐지는 번역자를 호출하는 파일만 보므로, 이 호출이 있어야 `shared.enumLabel`이 이
 * 라우트의 클라이언트 번들에 실린다.
 */
export function SentimentBadge({
    sentiment,
    sizeClassName,
}: SentimentBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <span
            className={cn(
                'rounded text-xs font-medium',
                sizeClassName,
                SENTIMENT_CLASS[sentiment]
            )}
        >
            {tLabel(SENTIMENT_LABEL_KEY[sentiment])}
        </span>
    );
}
