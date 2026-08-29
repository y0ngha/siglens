import { useTranslations } from 'next-intl';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface OptionsSummaryProps {
    bullets: string[];
    oiStale: boolean;
}

/**
 * 4번째 axis인 옵션 시장 요약 section. NoChains 종목 또는 옵션 데이터가
 * 없을 때는 빈 상태(분석 대상 옵션 없음)로 표시한다. 정규장 외에 수집된
 * 스냅샷이라 OI가 직전 세션 기준일 때만 stale 배지를 표시한다 — 빈 상태에서는
 * 배지를 노출하지 않는다 (분석 자체가 없으므로 stale 의미가 없음).
 */
export function OptionsSummary({ bullets, oiStale }: OptionsSummaryProps) {
    const t = useTranslations('widgets.overall');
    const isEmpty = bullets.length === 0;
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
                {!isEmpty && oiStale && (
                    <span
                        className="rounded-lg bg-ui-warning/10 px-2 py-0.5 text-xs text-ui-warning-text"
                        title={t('OptionsSummary.dac637')}
                    >
                        {t('OptionsSummary.e55475')}
                    </span>
                )}
            </div>
            {isEmpty ? (
                <p className="text-sm text-secondary-400">
                    {t('OptionsSummary.bf366f')}
                </p>
            ) : (
                <ul
                    aria-label={t('OptionsSummary.56f3e5')}
                    className="space-y-2"
                >
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
            )}
        </section>
    );
}
