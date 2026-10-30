'use client';

/**
 * 애널리스트 등급 변경 한 행 — 액션 배지, 회사, 이전→새 등급, 공시일.
 */
import { useTranslations } from 'next-intl';
import type { GradesEvent } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import {
    ACTION_CLASS,
    ACTION_LABEL_KEY,
    ROW_ACCENT_CLASS,
} from '../../utils/analystActionStyles';
import { formatGradeDate } from '../../utils/gradeRows';

interface GradeRowProps {
    event: GradesEvent;
}

/** 이전 등급이 없으면(신규 커버리지 등) 새 등급만 보여 준다. */
export function GradeRow({ event }: GradeRowProps) {
    const t = useTranslations('widgets.news');
    // 추출기의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는 패턴"만 본다 — 아래
    // `tLabel(ACTION_LABEL_KEY[...])` 직접 호출이 있어야 `shared.enumLabel`이 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    const locale = useResolvedLocale();

    return (
        <li
            className={cn(
                SURFACE_CARD,
                'flex flex-wrap items-start gap-3 p-3 text-sm',
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
                {formatGradeDate(event.date, locale)}
            </time>
        </li>
    );
}
