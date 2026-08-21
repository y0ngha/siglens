'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { GradesAction, GradesEvent } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';

/**
 * GradesAction → `shared.enumLabel.gradesAction` 카탈로그 키. 값 자체는 더 이상
 * 한글이 아니다 — `GradeRow`가 `tLabel`로 조회한다.
 *
 * 예전에는 이 값이 `'상향'|'하향'|'등급 유지'|...` 한글 리터럴이었다 — `/en/AAPL/news`의
 * 등급 변경 행이 `Jefferies Hold → changed to Underperform`(영문) 옆에서
 * `하향`을 그대로 찍었다.
 */
const ACTION_LABEL_KEY: Record<GradesAction, string> = {
    upgrade: 'gradesAction.upgrade',
    downgrade: 'gradesAction.downgrade',
    maintained: 'gradesAction.maintained',
    initiated: 'gradesAction.initiated',
    other: 'gradesAction.other',
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

/**
 * 로케일별 포맷터 캐시. timeZone: 'UTC' 고정 — 공시일은 날짜만 있는 값이라
 * 로컬 TZ로 포맷하면 서버(UTC)와 클라이언트에서 하루가 어긋나 하이드레이션이
 * 깨진다. 예전에는 `'ko-KR'` 고정이라 `/en/AAPL/news`의 등급 변경일이
 * `2026년 8월 10일`을 찍었다.
 */
const GRADE_DATE_FORMATTER_CACHE = new Map<Locale, Intl.DateTimeFormat>();

function gradeDateFormatterFor(locale: Locale): Intl.DateTimeFormat {
    const cached = GRADE_DATE_FORMATTER_CACHE.get(locale);
    if (cached) return cached;
    const formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
    GRADE_DATE_FORMATTER_CACHE.set(locale, formatter);
    return formatter;
}

interface GradeRowProps {
    event: GradesEvent;
}

function GradeRow({ event }: GradeRowProps) {
    const t = useTranslations('widgets.news');
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는 패턴"만
    // 본다 — 아래 `tLabel(ACTION_LABEL_KEY[...])` 직접 호출이 있어야
    // `shared.enumLabel`이 이 라우트(client component)의 번들에 실린다
    // (fearGreedLabels.ts의 SENTIMENT_LABEL_KEY export 주석 참고).
    const tLabel = useTranslations('shared.enumLabel');
    const locale = useResolvedLocale();
    const dateFormatted = gradeDateFormatterFor(locale).format(
        new Date(event.date)
    );

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
                {tLabel(ACTION_LABEL_KEY[event.action])}
            </span>
            <div className="min-w-0 flex-1">
                <p className="font-medium">{event.gradingCompany}</p>
                {event.previousGrade !== null ? (
                    <p className="mt-0.5 text-sm text-secondary-400">
                        {event.previousGrade}
                        <span aria-hidden="true"> → </span>
                        {/* 이 연결어는 **이전 등급 뒤, 새 등급 앞**에 놓인다.
                            한국어 `에서`·일본어 `から`는 앞 단어에 붙는 조사라
                            그 자리가 맞지만, 영어·중국어는 전치사라 같은 자리에
                            "from"을 두면 방향이 뒤집혀 읽힌다("Buy from Hold").
                            그래서 로케일마다 방향이 맞는 연결어를 쓴다. */}
                        <span className="sr-only">
                            {t('AnalystActions.81b8e2')}{' '}
                        </span>
                        <span className="font-medium text-secondary-100">
                            {event.newGrade}
                        </span>
                    </p>
                ) : (
                    <p className="mt-0.5 text-sm text-secondary-400">
                        <span className="font-medium text-secondary-100">
                            {event.newGrade}
                        </span>
                    </p>
                )}
            </div>
            <time
                dateTime={event.date}
                className="shrink-0 text-xs text-secondary-400 tabular-nums"
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
    const t = useTranslations('widgets.news');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    if (events.length === 0) {
        return (
            <section
                aria-labelledby="analyst-actions-heading"
                className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
            >
                <h2
                    id="analyst-actions-heading"
                    className="mb-3 text-lg font-semibold tracking-tight"
                >
                    {t('AnalystActions.b2cd1a')}
                </h2>
                <p className="text-sm text-secondary-400">
                    {t('AnalystActions.dc2ffb')}
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
                {t('AnalystActions.b2cd1a')}
            </h2>
            <ul className="space-y-2" aria-label={t('AnalystActions.b37a23')}>
                {visible.map(event => (
                    <GradeRow
                        key={`${event.date}-${event.gradingCompany}-${event.newGrade}`}
                        event={event}
                    />
                ))}
            </ul>
            {hasMore && (
                <button
                    type="button"
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    className="w-full rounded-lg border border-secondary-700 py-2 text-sm text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
                >
                    {t('AnalystActions.8e5a3a', {
                        v0: events.length - visibleCount,
                    })}
                </button>
            )}
        </section>
    );
}
