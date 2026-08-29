'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import type { AssetClass } from '@/shared/config/marketProfile';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface OverallTriggerCtaProps {
    onTrigger: () => void;
    /**
     * `true`면 버튼 비활성. 보통 개별 뉴스 카드 분석이 진행 중이라 종합 분석이
     * 새 뉴스 누락 부분 결과로 진행되는 걸 막을 때 사용한다(/news와 동일 게이트).
     */
    disabled?: boolean;
    /**
     * Asset class of the symbol being analysed.
     * Controls the subtitle copy:
     * - Crypto shows a subtitle listing 차트·뉴스·시장 분위기.
     * - Equity shows a subtitle listing 차트·옵션·펀더멘털·뉴스·시장 분위기.
     * (These are the subtitle's emphasis items, not the analysis-axis count.)
     */
    assetClass?: AssetClass;
}

export function OverallTriggerCta({
    onTrigger,
    disabled = false,
    assetClass = 'equity',
}: OverallTriggerCtaProps) {
    const t = useTranslations('widgets.overall');
    const subtitle =
        assetClass === 'crypto'
            ? t('OverallTriggerCta.ec0085')
            : t('OverallTriggerCta.2a1422');

    return (
        <section
            aria-labelledby="overall-cta-heading"
            aria-busy={disabled}
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-12 text-center"
        >
            <h2
                id="overall-cta-heading"
                className={cn(HEADING_SECTION, 'text-balance')}
            >
                {t('OverallTriggerCta.8b7ae7')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-secondary-400">
                {subtitle}
            </p>
            <button
                type="button"
                onClick={onTrigger}
                disabled={disabled}
                className={cn(
                    'mt-6 inline-flex items-center rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    disabled
                        ? 'bg-secondary-600 text-secondary-50 focus-visible:ring-secondary-500 cursor-not-allowed opacity-60'
                        : 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500'
                )}
            >
                {disabled
                    ? t('OverallTriggerCta.ff9889')
                    : t('OverallTriggerCta.51480a')}
            </button>
            {disabled && (
                <p
                    className="mt-3 text-xs text-secondary-500"
                    aria-live="polite"
                >
                    {t('OverallTriggerCta.5f4a34')}
                </p>
            )}
        </section>
    );
}
