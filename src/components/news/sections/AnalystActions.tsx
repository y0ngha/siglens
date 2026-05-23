'use client';

import { useState } from 'react';
import type { GradesAction, GradesEvent } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

const ACTION_LABEL: Record<GradesAction, string> = {
    upgrade: '상향',
    downgrade: '하향',
    maintained: '등급 유지',
    initiated: '신규 커버리지',
    other: '기타',
};

const ACTION_CLASS: Record<GradesAction, string> = {
    upgrade: 'bg-ui-success/10 text-chart-bullish',
    downgrade: 'bg-ui-danger/10 text-chart-bearish',
    maintained: 'bg-secondary-700 text-secondary-400',
    initiated: 'bg-ui-warning/10 text-ui-warning',
    other: 'bg-secondary-700 text-secondary-400',
};

const ROW_ACCENT_CLASS: Record<GradesAction, string> = {
    upgrade: 'border-l-[3px] border-l-chart-bullish',
    downgrade: 'border-l-[3px] border-l-chart-bearish',
    maintained: 'border-l-[3px] border-l-secondary-600',
    initiated: 'border-l-[3px] border-l-ui-warning',
    other: 'border-l-[3px] border-l-secondary-600',
};

const PAGE_SIZE = 5;

interface GradeRowProps {
    event: GradesEvent;
}

function GradeRow({ event }: GradeRowProps) {
    const dateFormatted = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(new Date(event.date));

    return (
        <li
            className={cn(
                'border-secondary-700 bg-secondary-800 flex flex-wrap items-start gap-3 rounded-lg border p-3 text-sm',
                ROW_ACCENT_CLASS[event.action]
            )}
        >
            <span
                className={cn(
                    'shrink-0 rounded px-2 py-0.5 text-xs font-medium',
                    ACTION_CLASS[event.action]
                )}
            >
                {ACTION_LABEL[event.action]}
            </span>
            <div className="min-w-0 flex-1">
                <p className="font-medium">{event.gradingCompany}</p>
                {event.previousGrade !== null ? (
                    <p className="text-secondary-400 mt-0.5 text-sm">
                        {event.previousGrade}
                        <span aria-hidden="true"> → </span>
                        <span className="sr-only">에서 </span>
                        <span className="text-secondary-100 font-medium">
                            {event.newGrade}
                        </span>
                    </p>
                ) : (
                    <p className="text-secondary-400 mt-0.5 text-sm">
                        <span className="text-secondary-100 font-medium">
                            {event.newGrade}
                        </span>
                    </p>
                )}
            </div>
            <time
                dateTime={event.date}
                className="text-secondary-400 shrink-0 text-xs tabular-nums"
            >
                {dateFormatted}
            </time>
        </li>
    );
}

interface AnalystActionsProps {
    events: GradesEvent[];
}

export function AnalystActions({ events }: AnalystActionsProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    if (events.length === 0) {
        return (
            <section
                aria-labelledby="analyst-actions-heading"
                className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
            >
                <h2
                    id="analyst-actions-heading"
                    className="mb-3 text-lg font-semibold tracking-tight"
                >
                    애널리스트 등급 변경
                </h2>
                <p className="text-secondary-400 text-sm">
                    최근 애널리스트 등급 변경이 없습니다.
                </p>
            </section>
        );
    }

    const visible = events.slice(0, visibleCount);
    const hasMore = visibleCount < events.length;

    return (
        <section
            aria-labelledby="analyst-actions-heading"
            className="space-y-3"
        >
            <h2
                id="analyst-actions-heading"
                className="text-lg font-semibold tracking-tight"
            >
                애널리스트 등급 변경
            </h2>
            <ul className="space-y-2" aria-label="애널리스트 등급 변경 목록">
                {visible.map((event, idx) => (
                    <GradeRow
                        key={`${event.date}-${event.gradingCompany}-${event.newGrade}-${idx}`}
                        event={event}
                    />
                ))}
            </ul>
            {hasMore && (
                <button
                    type="button"
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    className="border-secondary-700 text-secondary-400 hover:text-secondary-100 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-800 w-full rounded-lg border py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    더보기 ({events.length - visibleCount}개 남음)
                </button>
            )}
        </section>
    );
}
