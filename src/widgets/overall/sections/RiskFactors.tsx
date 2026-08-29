import { useTranslations } from 'next-intl';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface RiskFactorsProps {
    factors: string[];
}

export function RiskFactors({ factors }: RiskFactorsProps) {
    const t = useTranslations('widgets.overall');
    if (factors.length === 0) return null;
    return (
        <section
            aria-labelledby="risk-factors-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id="risk-factors-heading"
                className={cn(HEADING_SECTION, 'mb-3 text-balance')}
            >
                {t('RiskFactors.af0480')}
            </h2>
            <ul aria-label={t('RiskFactors.b6fcf8')} className="space-y-2">
                {factors.map(factor => (
                    <li key={factor} className="flex gap-2 text-sm">
                        <span
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-secondary-400"
                        >
                            •
                        </span>
                        <MarkdownText className="min-w-0 text-secondary-400">
                            {factor}
                        </MarkdownText>
                    </li>
                ))}
            </ul>
        </section>
    );
}
