/**
 * 마켓 뉴스 카드의 감성 배지.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import {
    SENTIMENT_LABEL_KEY,
    SENTIMENT_CLASS,
    isNewsSentiment,
} from '@/shared/lib/sentimentDisplay';

interface SentimentBadgeProps {
    value: string;
}

/** 알 수 없는 값이면 아무것도 그리지 않는다. */
export function SentimentBadge({ value }: SentimentBadgeProps) {
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는
    // 패턴"만 본다 — `SENTIMENT_LABEL_KEY[value]`를 그대로 번역자에 넣어야
    // `shared.enumLabel`이 이 파일이 속한 라우트의 클라이언트 번들에 실린다
    // (sentimentDisplay.ts의 SENTIMENT_LABEL_KEY export 주석 참고).
    const tLabel = useTranslations('shared.enumLabel');
    if (!isNewsSentiment(value)) return null;
    return (
        <span
            data-testid="sentiment-badge"
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                SENTIMENT_CLASS[value]
            )}
        >
            {tLabel(SENTIMENT_LABEL_KEY[value])}
        </span>
    );
}
