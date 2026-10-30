'use client';

import { useTranslations } from 'next-intl';

/** 옵션 OI가 직전 세션 기준(정규장 외 수집 스냅샷)일 때 옵션 섹션 제목 옆에 다는 배지. */
export function OptionsOiStaleBadge() {
    const t = useTranslations('widgets.overall');
    return (
        <span
            className="rounded-lg bg-ui-warning/10 px-2 py-0.5 text-xs text-ui-warning-text"
            title={t('OptionsSummary.dac637')}
        >
            {t('OptionsSummary.e55475')}
        </span>
    );
}
