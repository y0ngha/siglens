import { useTranslations } from 'next-intl';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface IntegratedConclusionProps {
    text: string;
}

// 통합 결론은 네 axis(technical/options/fundamental/news)를 묶어 한 페이지의
// 최종 결론을 제시하는 focal section이다. 시각적으로도 sibling axis summary와
// 구분되도록 primary tone의 border + 배경을 사용한다.
export function IntegratedConclusion({ text }: IntegratedConclusionProps) {
    const t = useTranslations('widgets.overall');
    if (!text) return null;
    return (
        <section
            aria-labelledby="overall-integrated-conclusion-heading"
            className="rounded-lg border border-primary-500/30 bg-primary-600/5 p-6"
        >
            <h2
                id="overall-integrated-conclusion-heading"
                className={cn(HEADING_SECTION, 'mb-3 text-balance')}
            >
                {t('IntegratedConclusion.85f201')}
            </h2>
            <MarkdownText className="text-sm">{text}</MarkdownText>
        </section>
    );
}
