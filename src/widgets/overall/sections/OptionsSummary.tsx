import { useTranslations } from 'next-intl';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface OptionsSummaryProps {
    bullets: string[];
    oiStale: boolean;
}

/**
 * 4번째 axis인 옵션 시장 요약 section. bullet이 하나 이상일 때만 렌더된다 —
 * 비어 있으면 호출부(`OverallView`)가 섹션을 뺀다. 정규장 외에 수집된 스냅샷이라
 * OI가 직전 세션 기준일 때만 stale 배지를 표시한다.
 */
export function OptionsSummary({ bullets, oiStale }: OptionsSummaryProps) {
    const t = useTranslations('widgets.overall');
    return (
        <section
            aria-labelledby="overall-options-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <div className="mb-3 flex items-center gap-2">
                <h2
                    id="overall-options-heading"
                    className={cn(HEADING_SECTION, 'text-balance')}
                >
                    {t('OptionsSummary.859330')}
                </h2>
                {oiStale && (
                    <span
                        className="rounded-lg bg-ui-warning/10 px-2 py-0.5 text-xs text-ui-warning-text"
                        title={t('OptionsSummary.dac637')}
                    >
                        {t('OptionsSummary.e55475')}
                    </span>
                )}
            </div>
            <ul aria-label={t('OptionsSummary.56f3e5')} className="space-y-2">
                {bullets.map(bullet => (
                    <li key={bullet} className="flex gap-2 text-sm">
                        <span
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-secondary-400"
                        >
                            •
                        </span>
                        <MarkdownText className="min-w-0 text-secondary-400">
                            {bullet}
                        </MarkdownText>
                    </li>
                ))}
            </ul>
        </section>
    );
}
