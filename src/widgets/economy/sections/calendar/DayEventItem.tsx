'use client';

/**
 * 상세 패널의 이벤트 한 줄 — 시각·이름·값 줄·중요도 배지와 (분석이 있으면) 심리 배지·요약·해석.
 */
import { useTranslations } from 'next-intl';
import type { CalendarImpact } from '@y0ngha/siglens-core';
import {
    resolveCalendarInterpretation,
    resolveCalendarSummary,
} from '@/entities/economy/model';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { cn } from '@/shared/lib/cn';
import {
    SENTIMENT_CLASS,
    SENTIMENT_LABEL_KEY,
} from '@/shared/lib/sentimentDisplay';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { KstEvent } from '../../model/calendarTypes';
import { displayEventLabel } from '../../utils/calendarLabels';
import {
    buildValueParts,
    VALUE_PART_SEPARATOR,
} from '../../utils/calendarValueParts';
import { IMPACT_LABEL_KEY } from '../../utils/impactMeta';

const IMPACT_BADGE: Record<CalendarImpact, string> = {
    High: 'bg-ui-danger/20 text-ui-danger-text',
    Medium: 'bg-ui-warning/20 text-ui-warning-text',
    Low: 'bg-secondary-700 text-secondary-200',
};

interface DayEventItemProps {
    event: KstEvent;
    /** 비활성 중요도 — `hidden`으로 숨기되 DOM에는 남긴다(크롤러 색인). */
    hidden: boolean;
    labels: Record<string, string>;
}

/** 이벤트 한 건을 카드로 그린다 — 분석 요약은 심리가 있고 보일 문구가 있을 때만. */
export function DayEventItem({ event, hidden, labels }: DayEventItemProps) {
    const t = useTranslations('widgets.economy');
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는 패턴"만 본다 —
    // `SENTIMENT_LABEL_KEY[...]`를 그대로 `tLabel(...)`에 넣어야 `shared.enumLabel`이 이
    // 라우트의 클라이언트 번들에 실린다(sentimentDisplay.ts의 SENTIMENT_LABEL_KEY export 주석).
    const tLabel = useTranslations('shared.enumLabel');
    const locale = useCurrentLocale();
    const { original } = event;
    // 보일 문구로 판정한다 — 한국어 원문이 비어도 사이드카 번역이 있으면 보인다.
    const summary = resolveCalendarSummary(original);
    const interpretation = resolveCalendarInterpretation(original);
    const hasSummary = (summary?.trim().length ?? 0) > 0;
    const valueParts = buildValueParts(
        original,
        (key, values) => t(key, values),
        locale
    );

    return (
        <li hidden={hidden} className={cn(SURFACE_CARD, 'p-3')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                        <time
                            dateTime={event.iso}
                            className="shrink-0 text-xs text-secondary-300 tabular-nums"
                        >
                            {event.kstTimeLabel}
                        </time>
                    </div>
                    <p className="text-sm font-medium text-secondary-100">
                        {displayEventLabel(original.event, labels)}
                    </p>
                    {valueParts.length > 0 && (
                        <p className="mt-0.5 text-xs text-secondary-400">
                            {valueParts.join(VALUE_PART_SEPARATOR)}
                        </p>
                    )}
                </div>
                <span
                    className={cn(
                        'shrink-0 rounded px-2 py-0.5 text-xs font-medium',
                        IMPACT_BADGE[original.impact]
                    )}
                >
                    {tLabel(IMPACT_LABEL_KEY[original.impact])}
                </span>
            </div>
            {original.sentiment != null && hasSummary && (
                <div className="mt-2 space-y-1 border-t border-secondary-700/60 pt-2">
                    <span
                        className={cn(
                            'inline-block rounded px-2 py-0.5 text-xs font-medium',
                            SENTIMENT_CLASS[original.sentiment]
                        )}
                    >
                        {tLabel(SENTIMENT_LABEL_KEY[original.sentiment])}
                    </span>
                    <p className="text-sm text-secondary-200">{summary}</p>
                    {interpretation !== null && (
                        <p className="text-xs leading-relaxed text-secondary-400">
                            {interpretation}
                        </p>
                    )}
                </div>
            )}
        </li>
    );
}
