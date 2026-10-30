'use client';

/**
 * 애널리스트 등급 변경 섹션 — 5건씩 "더보기"로 펼치는 목록을 조립한다. 행·표기는 `ui/analyst-actions/`·`utils/`.
 */
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { GradesEvent } from '@y0ngha/siglens-core';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { AnalystActionsEmpty } from '../ui/analyst-actions/AnalystActionsEmpty';
import { GradeRow } from '../ui/analyst-actions/GradeRow';
import { gradeRowKey } from '../utils/gradeRows';

const PAGE_SIZE = 5;

interface AnalystActionsProps {
    events: GradesEvent[];
}

/** 이벤트가 없으면 빈 상태, 있으면 최신순 목록과 "더보기" 버튼. */
export function AnalystActions({ events }: AnalystActionsProps) {
    const t = useTranslations('widgets.news');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    if (events.length === 0) return <AnalystActionsEmpty />;

    return (
        <section
            aria-labelledby="analyst-actions-heading"
            className="space-y-3"
        >
            <h2 id="analyst-actions-heading" className={HEADING_SECTION}>
                {t('AnalystActions.b2cd1a')}
            </h2>
            <ul className="space-y-2" aria-label={t('AnalystActions.b37a23')}>
                {events.slice(0, visibleCount).map((event, index) => (
                    <GradeRow key={gradeRowKey(event, index)} event={event} />
                ))}
            </ul>
            {visibleCount < events.length && (
                <button
                    type="button"
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    className="w-full rounded-lg border border-border-control py-2 text-sm text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
                >
                    {t('AnalystActions.8e5a3a', {
                        v0: events.length - visibleCount,
                    })}
                </button>
            )}
        </section>
    );
}
