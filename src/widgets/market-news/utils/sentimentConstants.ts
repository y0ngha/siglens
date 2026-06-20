/**
 * 감정(sentiment) 표시 상수 — 실제 정의는 `@/shared/lib/sentimentDisplay`로 이전.
 * 기존 market-news 내부 소비자(`MarketNewsCard`, `MarketNewsDigest`)의 상대 경로
 * 임포트를 깨지 않도록 re-export만 유지한다.
 */
export {
    SENTIMENT_LABEL,
    SENTIMENT_CLASS,
    isNewsSentiment,
} from '@/shared/lib/sentimentDisplay';
