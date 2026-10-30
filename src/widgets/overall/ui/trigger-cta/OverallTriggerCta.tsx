'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import type { AssetClass } from '@/shared/config/marketProfile/types';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

type SubtitleKey = 'crypto' | 'equity' | 'equityNoOptions';

/**
 * 자산군과 옵션 탭 유무 → 부제 카탈로그 키(`widgets.overall.ctaSubtitle`). 옵션 탭이
 * 없는 한국 개별주식에 옵션을 약속하는 문구를 보이면 안 된다. 암호화폐는 옵션 유무와
 * 무관하다.
 */
const SUBTITLE_KEY: Record<
    AssetClass,
    Record<'withOptions' | 'withoutOptions', SubtitleKey>
> = {
    crypto: { withOptions: 'crypto', withoutOptions: 'crypto' },
    equity: { withOptions: 'equity', withoutOptions: 'equityNoOptions' },
};

interface OverallTriggerCtaProps {
    onTrigger: () => void;
    /**
     * `true`면 버튼 비활성. 보통 개별 뉴스 카드 분석이 진행 중이라 종합 분석이
     * 새 뉴스 누락 부분 결과로 진행되는 걸 막을 때 사용한다(/news와 동일 게이트).
     */
    disabled?: boolean;
    /** 분석 대상 자산군. 부제가 나열하는 강조 항목이 자산군마다 다르다. */
    assetClass?: AssetClass;
    /** 옵션 탭이 실제로 존재하는지. 없으면 부제에서 옵션을 뺀다. */
    hasOptions: boolean;
}

/** 종합 분석 시작 CTA. 개별 뉴스 카드 분석이 끝날 때까지 버튼을 잠근다. */
export function OverallTriggerCta({
    onTrigger,
    disabled = false,
    assetClass = 'equity',
    hasOptions,
}: OverallTriggerCtaProps) {
    const t = useTranslations('widgets.overall');
    // extract.mjs의 동적 키 탐지는 번역자를 직접 호출하는 파일 안의 조회만 본다 —
    // 부제 키를 전용 네임스페이스로 분리해 조회 테이블 전체가 아니라 이 세 키만 싣는다.
    const tSubtitle = useTranslations('widgets.overall.ctaSubtitle');
    const subtitle = tSubtitle(
        SUBTITLE_KEY[assetClass][hasOptions ? 'withOptions' : 'withoutOptions']
    );

    return (
        <section
            aria-labelledby="overall-cta-heading"
            aria-busy={disabled}
            className={cn(SURFACE_CARD, 'p-12 text-center')}
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
