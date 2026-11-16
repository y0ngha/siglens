'use client';

/**
 * 애널리스트 등급 변경 섹션 — 5건씩 "더보기"로 펼치는 목록을 조립한다. 행·표기는 `ui/analyst-actions/`·`utils/`.
 */
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { ShowMoreButton } from '../ui/ShowMoreButton';
import { AnalystActionsEmpty } from '../ui/analyst-actions/AnalystActionsEmpty';
import { GradeRow } from '../ui/analyst-actions/GradeRow';
import type { AnalystActionItem } from '../utils/analystActionItems';
import { gradeRowKey } from '../utils/gradeRows';

const PAGE_SIZE = 5;

interface AnalystActionsProps {
    items: AnalystActionItem[];
}

/** 행이 없으면 빈 상태, 있으면 최신순 목록과 "더보기" 버튼. */
export function AnalystActions({ items }: AnalystActionsProps) {
    const t = useTranslations('widgets.news');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    if (items.length === 0) return <AnalystActionsEmpty />;

    return (
        <section
            aria-labelledby="analyst-actions-heading"
            className="space-y-3"
        >
            <h2 id="analyst-actions-heading" className={HEADING_SECTION}>
                {t('AnalystActions.heading')}
            </h2>
            <ul
                className="space-y-2"
                aria-label={t('AnalystActions.listLabel')}
            >
                {items.slice(0, visibleCount).map((item, index) => (
                    <GradeRow key={gradeRowKey(item, index)} item={item} />
                ))}
            </ul>
            {visibleCount < items.length && (
                <ShowMoreButton
                    label={t('AnalystActions.8e5a3a', {
                        v0: items.length - visibleCount,
                    })}
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                />
            )}
        </section>
    );
}
