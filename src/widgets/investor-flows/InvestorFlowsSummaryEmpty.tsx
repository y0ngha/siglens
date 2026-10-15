import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/**
 * AI 해석의 `no_data` 분기 — core가 스냅샷이 없거나 모든 축이 데이터 부족이라고 판단해 LLM을 부르지 않았다.
 * 오류가 아니다. 성공 카드와 같은 껍데기·제목을 써서 자리가 흔들리지 않게 한다.
 */
export function InvestorFlowsSummaryEmpty() {
    const t = useTranslations('widgets.investor-flows');
    return (
        <section
            aria-labelledby="investor-flows-summary-empty-heading"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2
                id="investor-flows-summary-empty-heading"
                className={cn('mb-3', HEADING_SECTION)}
            >
                {t('ai.title')}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('ai.noData')}
            </p>
        </section>
    );
}
