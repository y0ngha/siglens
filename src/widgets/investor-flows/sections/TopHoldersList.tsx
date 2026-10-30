'use client';

/**
 * 상위 보유 기관 목록 — 필터 상태를 쥔 클라이언트 섹션.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { InstitutionalHolderChange } from '@y0ngha/siglens-core';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { filterHolders, type HolderFilter } from '../utils/institutional';
import { HolderFilterGroup } from '../ui/holders/HolderFilterGroup';
import { HolderRecords } from '../ui/holders/HolderRecords';

interface TopHoldersListProps {
    readonly holders: readonly InstitutionalHolderChange[];
    /** 보유 현황의 기준 분기(`topHoldersPeriod`). 모르면 `null`. */
    readonly period: string | null;
}

/**
 * 상위 보유 기관 — 기관명·보유 주식·직전 분기 대비 변화(주식 수·%)·상태 배지(신규/증가/감소/청산/유지).
 * "전체 / 신규 진입 / 완전 청산" 필터로 신규·청산 목록만 볼 수 있다.
 *
 * 넓은 화면은 표, 좁은 화면은 카드 목록이다(가로 스크롤 표를 쓰지 않는다).
 */
export function TopHoldersList({ holders, period }: TopHoldersListProps) {
    const t = useTranslations('widgets.investor-flows');
    const [filter, setFilter] = useState<HolderFilter>('all');
    const visible = filterHolders(holders, filter);
    const counts: Record<HolderFilter, number> = {
        all: holders.length,
        new: filterHolders(holders, 'new').length,
        exited: filterHolders(holders, 'exited').length,
    };
    return (
        <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className={HEADING_SUBSECTION}>
                    {t('holders.title')}
                    <FlowTooltip term="institutionalHolding" />
                </h3>
                <HolderFilterGroup
                    value={filter}
                    counts={counts}
                    onChange={setFilter}
                />
            </div>
            {period !== null && (
                <p className="mb-2 text-xs text-secondary-400">
                    {t('holders.basis', { period })}
                </p>
            )}
            {visible.length === 0 ? (
                <p className="text-sm text-secondary-400">
                    {t('holders.emptyFiltered')}
                </p>
            ) : (
                <HolderRecords holders={visible} />
            )}
        </div>
    );
}
