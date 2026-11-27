'use client';

/**
 * 최근 공시 한 행 — 양식 배지, 종류(항목 라벨, 6-K는 해외 발행인 보고), 회사가 낸 제목(영어 원문), 접수일, SEC 원문 링크.
 */
import { useTranslations } from 'next-intl';
import type { CompanyFiling } from '@/entities/company-filings/model';
import type { Locale } from '@/shared/i18n/locales';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FILING_ITEM_KEY } from '../../utils/filingLabels';
import { formatGradeDate } from '../../utils/gradeRows';

interface FilingRowProps {
    filing: CompanyFiling;
}

/**
 * 종류 라벨을 잇는 구분자. ja/zh는 나열에 쉼표 대신 「、」를 쓴다.
 * `Intl.ListFormat`의 unit 형식은 ICU 버전마다 공백만 남기거나 붙여 써서 쓰지 않는다.
 */
const KIND_SEPARATOR: Record<Locale, string> = {
    ko: ', ',
    en: ', ',
    ja: '、',
    zh: '、',
};

export function FilingRow({ filing }: FilingRowProps) {
    const t = useTranslations('widgets.news');
    const tItem = useTranslations('widgets.news.CompanyFilings');
    const locale = useResolvedLocale();
    const kinds =
        filing.form === '6-K'
            ? [t('CompanyFilings.form6k')]
            : filing.items.map(item =>
                  // 추출기는 이 파일에서 `tItem(FILING_ITEM_KEY[...])`를 직접 부르는 형태만 동적 키로 알아본다.
                  Object.hasOwn(FILING_ITEM_KEY, item.code)
                      ? tItem(FILING_ITEM_KEY[item.code])
                      : t('CompanyFilings.itemCode', { code: item.code })
              );

    return (
        <li
            className={cn(SURFACE_CARD, 'flex flex-wrap items-start gap-3 p-3')}
        >
            <span
                className="shrink-0 rounded bg-secondary-700 px-2 py-0.5 font-mono text-xs font-medium text-secondary-200"
                translate="no"
            >
                {filing.form}
            </span>
            <div className="min-w-0 flex-1 text-sm">
                {kinds.length > 0 && (
                    <p className="font-medium break-words">
                        {kinds.join(KIND_SEPARATOR[locale])}
                    </p>
                )}
                {filing.headline !== null && (
                    // 회사가 낸 원문 제목이다 — 번역하지 않는다(오역 위험). 언어를 밝혀 스크린 리더가 영어로 읽게 한다.
                    <p
                        lang="en"
                        className="mt-0.5 text-sm break-words text-secondary-400"
                    >
                        {filing.headline}
                    </p>
                )}
                <a
                    href={filing.url}
                    target="_blank"
                    rel="noopener nofollow"
                    className="mt-1 inline-block text-xs text-primary-400 underline-offset-2 hover:text-primary-300 hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('CompanyFilings.secLink')}
                    <span className="sr-only">
                        {' '}
                        {t('CompanyFilings.newTab')}
                    </span>
                </a>
            </div>
            <time
                dateTime={filing.filedAt}
                className="shrink-0 text-xs text-secondary-400 tabular-nums"
            >
                {formatGradeDate(filing.filedAt, locale)}
            </time>
        </li>
    );
}
