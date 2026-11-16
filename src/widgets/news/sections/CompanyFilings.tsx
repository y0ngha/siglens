'use client';

/**
 * 최근 공시 섹션 — 회사가 SEC에 낸 현재보고서(8-K·6-K) 목록. 5건씩 "더보기"로 펼친다. 목록이 비면 섹션 자체를
 * 그리지 않는다(호출부가 걸러 넘긴다) — SEC에 공시하지 않는 종목에 빈 카드를 보이지 않기 위해서다.
 */
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { CompanyFiling } from '@/entities/company-filings/model';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { ShowMoreButton } from '../ui/ShowMoreButton';
import { FilingRow } from '../ui/company-filings/FilingRow';

const PAGE_SIZE = 5;

interface CompanyFilingsProps {
    filings: CompanyFiling[];
}

export function CompanyFilings({ filings }: CompanyFilingsProps) {
    const t = useTranslations('widgets.news');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    return (
        <section
            aria-labelledby="company-filings-heading"
            className="space-y-3"
        >
            <h2 id="company-filings-heading" className={HEADING_SECTION}>
                {t('CompanyFilings.title')}
            </h2>
            <p className="text-xs text-secondary-400">
                {t('CompanyFilings.caption')}
            </p>
            <ul
                className="space-y-2"
                aria-label={t('CompanyFilings.listLabel')}
            >
                {filings.slice(0, visibleCount).map(filing => (
                    <FilingRow key={filing.accession} filing={filing} />
                ))}
            </ul>
            {visibleCount < filings.length && (
                <ShowMoreButton
                    label={t('CompanyFilings.more', {
                        count: filings.length - visibleCount,
                    })}
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                />
            )}
        </section>
    );
}
