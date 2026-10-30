'use client';

/**
 * 뉴스 감성 배지 — 색·라벨 키·가드는 시장 뉴스 카드와 같은 공유 테이블을 쓴다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import {
    SENTIMENT_CLASS,
    SENTIMENT_LABEL_KEY,
    isNewsSentiment,
} from '@/shared/lib/sentimentDisplay';

interface SentimentBadgeProps {
    value: string;
}

/** 알 수 없는 값이면 아무것도 그리지 않는다. */
export function SentimentBadge({ value }: SentimentBadgeProps) {
    // 추출기의 동적 키 탐지는 이 파일 안에서 번역자를 직접 호출하는 패턴만 본다 —
    // `SENTIMENT_LABEL_KEY[...]`를 그대로 `tLabel(...)`에 넣어야 `shared.enumLabel`이 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    if (!isNewsSentiment(value)) return null;
    return (
        <span
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                SENTIMENT_CLASS[value]
            )}
        >
            {tLabel(SENTIMENT_LABEL_KEY[value])}
        </span>
    );
}
