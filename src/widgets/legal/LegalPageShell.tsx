import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { LOCALE_HREFLANG, type Locale } from '@/shared/i18n/locales';
import type { TocItem } from '@/shared/lib/legal-toc';
import { LegalBreadcrumb } from './LegalBreadcrumb';
import { LegalPageFrame } from './ui/layout/LegalPageFrame';
import { LegalToc } from './ui/toc/LegalToc';

interface LegalPageShellProps {
    /** 브레드크럼 마지막 마디. `BreadcrumbList` JSON-LD의 이름과 같아야 한다. */
    readonly breadcrumbTitle: string;
    readonly eyebrow: string;
    readonly title: string;
    readonly intro: ReactNode;
    /** 로케일 형식으로 이미 포맷한 시행일. */
    readonly effectiveDate: string;
    readonly toc: readonly TocItem[];
    /**
     * 본문(그리고 본문 제목에서 뽑은 목차)이 실제로 쓰인 언어. 번역이 없어 다른
     * 언어 원문을 낼 때 페이지 언어와 달라지므로, 스크린 리더가 그 언어로 읽고
     * 검색엔진이 언어를 오인하지 않도록 `lang`으로 표시한다.
     */
    readonly bodyLocale: Locale;
    readonly topNotice?: ReactNode;
    readonly bottomNotice?: ReactNode;
    readonly children: ReactNode;
}

/**
 * `/terms`·`/privacy` 본문 페이지 셸: 머리말(소개·시행일), 안내 슬롯, 목차, 본문.
 */
export function LegalPageShell({
    breadcrumbTitle,
    eyebrow,
    title,
    intro,
    effectiveDate,
    toc,
    bodyLocale,
    topNotice,
    bottomNotice,
    children,
}: LegalPageShellProps) {
    const t = useTranslations('widgets.legal');
    const bodyLang = LOCALE_HREFLANG[bodyLocale];
    return (
        <LegalPageFrame
            breadcrumb={<LegalBreadcrumb pageTitle={breadcrumbTitle} />}
            eyebrow={eyebrow}
            title={title}
            headerExtra={
                <>
                    <p className="mt-4 text-sm leading-relaxed text-secondary-400 sm:text-base">
                        {intro}
                    </p>
                    <p className="mt-4 text-xs text-secondary-500">
                        {t('LegalPageShell.4ea5e2', { v0: effectiveDate })}
                    </p>
                </>
            }
        >
            {topNotice}

            <LegalToc items={toc} lang={bodyLang} withTopMargin={!topNotice} />

            <div lang={bodyLang} className="space-y-8">
                {children}
            </div>

            {bottomNotice}
        </LegalPageFrame>
    );
}
