/**
 * 마켓 뉴스 카드의 요약 섹션.
 */
import { useTranslations } from 'next-intl';

interface CardSummarySectionProps {
    summary: string;
}

/** 카드는 요약만 노출한다 — 전문 스크랩을 막는다. 원문은 "원문 보기" 링크로 간다. */
export function CardSummarySection({ summary }: CardSummarySectionProps) {
    const t = useTranslations('widgets.market-news');
    return (
        <section className="mt-3 border-t border-secondary-700/70 pt-3">
            <h4 className="mb-1 text-xs font-medium text-secondary-300">
                {t('MarketNewsCard.3ea27a')}
            </h4>
            <p className="text-sm leading-relaxed wrap-break-word text-secondary-400">
                {summary}
            </p>
        </section>
    );
}
