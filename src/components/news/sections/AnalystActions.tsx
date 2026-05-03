import type { GradesAction, GradesEvent } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

// ─── Action label + styling ───────────────────────────────────────────────────

const ACTION_LABEL: Record<GradesAction, string> = {
    upgrade: '상향',
    downgrade: '하향',
    maintained: '유지',
    initiated: '신규',
    other: '기타',
};

const ACTION_CLASS: Record<GradesAction, string> = {
    upgrade: 'bg-ui-success/10 text-chart-bullish',
    downgrade: 'bg-ui-danger/10 text-chart-bearish',
    maintained: 'bg-muted text-muted-foreground',
    initiated: 'bg-ui-warning/10 text-ui-warning',
    other: 'bg-muted text-muted-foreground',
};

// ─── Grade row ────────────────────────────────────────────────────────────────

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
        <li className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm">
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
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.previousGrade}
                        <span aria-hidden="true"> → </span>
                        <span className="sr-only">에서 </span>
                        <span className="font-medium text-foreground">
                            {event.newGrade}
                        </span>
                    </p>
                ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                            {event.newGrade}
                        </span>
                    </p>
                )}
            </div>
            <time
                dateTime={event.date}
                className="shrink-0 text-xs tabular-nums text-muted-foreground"
            >
                {dateFormatted}
            </time>
        </li>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface AnalystActionsProps {
    events: GradesEvent[];
}

/**
 * RSC section: recent analyst grade change events.
 *
 * Data is fetched by the parent section wrapper in `page.tsx` and passed as
 * a typed prop — this component never touches infrastructure directly.
 */
export function AnalystActions({ events }: AnalystActionsProps) {
    if (events.length === 0) {
        return null;
    }

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
                {events.map((event, index) => (
                    <GradeRow key={`${event.date}-${event.gradingCompany}-${index}`} event={event} />
                ))}
            </ul>
        </section>
    );
}
