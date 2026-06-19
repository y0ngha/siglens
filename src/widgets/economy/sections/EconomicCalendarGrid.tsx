'use client';

import { useState } from 'react';
import type {
    CalendarImpact,
    EconomicCalendarEvent,
} from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';
import { formatNum } from '@/shared/lib/formatNum';
import { etDateTimeToKst } from '@/shared/lib/etTimeUtils';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const IMPACT_LABELS: Record<CalendarImpact, string> = {
    High: '높음',
    Medium: '보통',
    Low: '낮음',
};

const IMPACT_BADGE: Record<CalendarImpact, string> = {
    High: 'bg-ui-danger/20 text-ui-danger-text',
    Medium: 'bg-ui-warning/20 text-ui-warning-text',
    Low: 'bg-secondary-700 text-secondary-200',
};

/** 임팩트 점 색상 — 장식용(aria-hidden) */
const IMPACT_DOT: Record<CalendarImpact, string> = {
    High: 'bg-ui-danger',
    Medium: 'bg-ui-warning',
    Low: 'bg-secondary-400',
};

/** 7열 그리드 요일 헤더 (일요일 시작) */
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 한국어 월 레이블 ('1월' … '12월') */
const MONTH_LABELS = [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
] as const;

/** 인라인 이벤트 미리보기 최대 표시 건수 (sm 이상 화면) */
const INLINE_EVENT_MAX = 2;

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface KstEvent {
    /** ET ISO-8601 문자열 — `<time dateTime>` 용 */
    iso: string;
    /** 한국시간 레이블 '오전/오후 H:mm' */
    kstTimeLabel: string;
    original: EconomicCalendarEvent;
}

interface DayGroup {
    /** KST 기준 날짜 키 'YYYY-MM-DD' */
    dateKey: string;
    /** KST 날짜의 Date.getDay() (0=일 … 6=토) */
    dayOfWeek: number;
    /** KST 연도 */
    year: number;
    /** KST 월 (0-indexed, 0=1월) */
    month: number;
    /** KST 일 */
    day: number;
    events: KstEvent[];
}

interface MonthGrid {
    year: number;
    /** 0-indexed */
    month: number;
}

// ---------------------------------------------------------------------------
// 순수 유틸
// ---------------------------------------------------------------------------

/**
 * KST 날짜 키 'YYYY-MM-DD'에서 {year, month(0-idx), day}를 파싱한다.
 * `new Date(key)` 는 로컬 자정 기준이라 시스템 TZ에 의존하므로 직접 파싱한다.
 */
function parseDateKey(key: string): {
    year: number;
    month: number;
    day: number;
} {
    const [y, m, d] = key.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
}

/** 'YYYY-MM-DD' 기준 요일(0=일)을 구한다 — UTC 기반 Date.UTC로 계산. */
function dayOfWeekFromKey(key: string): number {
    const { year, month, day } = parseDateKey(key);
    return new Date(Date.UTC(year, month, day)).getUTCDay();
}

/** 해당 월의 마지막 일자를 반환한다. */
function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * EconomicCalendarEvent 배열을 KST 날짜 키 기준으로 그룹핑해
 * 날짜순으로 정렬된 DayGroup[] 를 반환한다.
 * 이벤트는 kstDateKey 오름차순 → kstTimeLabel 오름차순으로 정렬.
 */
function groupEventsByKstDay(
    events: readonly EconomicCalendarEvent[]
): DayGroup[] {
    const map = new Map<string, KstEvent[]>();

    for (const ev of events) {
        const { iso, kstDateKey, kstTimeLabel } = etDateTimeToKst(ev.date);
        const kst: KstEvent = { iso, kstTimeLabel, original: ev };
        const existing = map.get(kstDateKey);
        if (existing !== undefined) {
            existing.push(kst);
        } else {
            map.set(kstDateKey, [kst]);
        }
    }

    return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, evList]) => {
            const { year, month, day } = parseDateKey(dateKey);
            const dayOfWeek = dayOfWeekFromKey(dateKey);
            // 시각 레이블 오름차순 정렬 ('오전' < '오후' 사전 순이 대체로 맞지만
            // iso 기준 정렬이 더 정확하다)
            const sorted = evList
                .slice()
                .sort((a, b) => a.iso.localeCompare(b.iso));
            return { dateKey, dayOfWeek, year, month, day, events: sorted };
        });
}

/**
 * DayGroup 배열에서 스패닝하는 KST 월 목록을 반환한다 (연·월 중복 제거).
 */
function spannedMonths(groups: DayGroup[]): MonthGrid[] {
    const seen = new Set<string>();
    const result: MonthGrid[] = [];
    for (const g of groups) {
        const key = `${g.year}-${g.month}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push({ year: g.year, month: g.month });
        }
    }
    return result;
}

/**
 * KST 날짜 키 'YYYY-MM-DD'를 한국어 요일 레이블로 변환.
 * ('일' | '월' | '화' | '수' | '목' | '금' | '토')
 */
function kstDayOfWeekLabel(dateKey: string): string {
    return WEEKDAY_LABELS[dayOfWeekFromKey(dateKey)];
}

// ---------------------------------------------------------------------------
// 하위 컴포넌트 — 이벤트 상세 패널
// ---------------------------------------------------------------------------

interface DayDetailPanelProps {
    group: DayGroup;
    isSelected: boolean;
}

function DayDetailPanel({ group, isSelected }: DayDetailPanelProps) {
    const { month, day, dateKey } = group;
    const dowLabel = kstDayOfWeekLabel(dateKey);

    return (
        /**
         * SSR 크롤러 접근성: 모든 패널을 DOM에 렌더하되, 선택되지 않은 패널에만
         * `hidden` 속성을 부여한다. `hidden`은 `display:none`과 달리 HTML 사양상
         * 콘텐츠를 DOM에 유지하므로 크롤러가 모든 이벤트를 색인할 수 있다.
         */
        <div
            role="tabpanel"
            id={`panel-${dateKey}`}
            aria-labelledby={`day-btn-${dateKey}`}
            hidden={!isSelected}
            className={cn(
                'space-y-3 transition-opacity motion-reduce:transition-none',
                isSelected ? 'opacity-100' : 'opacity-0'
            )}
        >
            <h3 className="text-secondary-100 font-semibold">
                {month + 1}월 {day}일 ({dowLabel})
            </h3>
            <ul className="space-y-2">
                {group.events.map(ev => (
                    <li
                        key={`${ev.iso}:${ev.original.event}:${ev.original.actual ?? ''}`}
                        className="border-secondary-700 bg-secondary-800/50 rounded-lg border p-3"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="mb-0.5 flex items-center gap-2">
                                    <time
                                        dateTime={ev.iso}
                                        className="text-secondary-300 shrink-0 text-xs tabular-nums"
                                    >
                                        {ev.kstTimeLabel}
                                    </time>
                                </div>
                                <p className="text-secondary-100 text-sm font-medium">
                                    {ev.original.event}
                                </p>
                                <p className="text-secondary-400 mt-0.5 text-xs">
                                    예상{' '}
                                    {formatNum(
                                        ev.original.estimate,
                                        ev.original.unit
                                    )}{' '}
                                    · 이전{' '}
                                    {formatNum(
                                        ev.original.previous,
                                        ev.original.unit
                                    )}
                                    {ev.original.actual !== null && (
                                        <>
                                            {' '}
                                            · 실제{' '}
                                            {formatNum(
                                                ev.original.actual,
                                                ev.original.unit
                                            )}
                                        </>
                                    )}
                                </p>
                            </div>
                            <span
                                className={cn(
                                    'shrink-0 rounded px-2 py-0.5 text-xs font-medium',
                                    IMPACT_BADGE[ev.original.impact]
                                )}
                            >
                                {IMPACT_LABELS[ev.original.impact]}
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 하위 컴포넌트 — 날짜 셀
// ---------------------------------------------------------------------------

interface DayCellProps {
    /** null이면 선행/후행 공백 셀 */
    group: DayGroup | null;
    isSelected: boolean;
    onSelect: (dateKey: string) => void;
}

function DayCell({ group, isSelected, onSelect }: DayCellProps) {
    if (group === null) {
        return <td aria-hidden="true" />;
    }

    const { day, month, events, dateKey } = group;
    const count = events.length;

    /**
     * 임팩트 종류 집합 — 점 렌더 순서(High → Medium → Low)를 위해 순서 유지.
     * 동일 날짜에 High가 여러 건이어도 점은 1개만 표시한다(시각적 노이즈 감소).
     */
    const impactSet = new Set(events.map(e => e.original.impact));
    const impactOrder: CalendarImpact[] = ['High', 'Medium', 'Low'];
    const dots = impactOrder.filter(i => impactSet.has(i));

    return (
        <td className="p-0.5 align-top">
            <button
                id={`day-btn-${dateKey}`}
                type="button"
                aria-label={`${month + 1}월 ${day}일, 이벤트 ${count}건`}
                aria-pressed={isSelected}
                aria-controls={`panel-${dateKey}`}
                onClick={() => onSelect(dateKey)}
                className={cn(
                    'relative min-h-[4rem] w-full rounded-lg p-1 text-left text-xs transition-colors',
                    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
                    'motion-reduce:transition-none',
                    isSelected
                        ? 'bg-primary-900/30 ring-primary-500 ring-2'
                        : 'hover:bg-secondary-700/40'
                )}
            >
                {/* 일 숫자 */}
                <span
                    className={cn(
                        'block text-right text-[11px] leading-none tabular-nums',
                        isSelected
                            ? 'text-primary-400 font-semibold'
                            : 'text-secondary-200 font-medium'
                    )}
                >
                    {day}
                </span>

                {/* 임팩트 점 — 장식용 */}
                <span
                    aria-hidden="true"
                    className="mt-1 flex flex-wrap gap-0.5"
                >
                    {dots.map(impact => (
                        <span
                            key={impact}
                            className={cn(
                                'inline-block h-1.5 w-1.5 rounded-full',
                                IMPACT_DOT[impact]
                            )}
                        />
                    ))}
                </span>

                {/* 이벤트 건수 */}
                <span className="text-secondary-300 mt-0.5 block text-[10px] tabular-nums">
                    {count}건
                </span>

                {/* sm 이상: 인라인 이벤트 미리보기 (최대 2건) */}
                <span className="mt-1 hidden space-y-0.5 sm:block">
                    {events.slice(0, INLINE_EVENT_MAX).map(ev => (
                        <span
                            key={`${ev.iso}:${ev.original.event}`}
                            className="text-secondary-400 block min-w-0 truncate text-[10px] leading-tight"
                        >
                            {ev.kstTimeLabel
                                .replace('오전 ', '')
                                .replace('오후 ', '')}{' '}
                            {ev.original.event}
                        </span>
                    ))}
                    {count > INLINE_EVENT_MAX && (
                        <span className="text-secondary-500 block text-[10px]">
                            +{count - INLINE_EVENT_MAX}
                        </span>
                    )}
                </span>
            </button>
        </td>
    );
}

// ---------------------------------------------------------------------------
// 하위 컴포넌트 — 월 그리드 테이블
// ---------------------------------------------------------------------------

interface MonthCalendarProps {
    year: number;
    /** 0-indexed */
    month: number;
    groupMap: Map<string, DayGroup>;
    selectedDateKey: string;
    onSelect: (dateKey: string) => void;
}

function MonthCalendar({
    year,
    month,
    groupMap,
    selectedDateKey,
    onSelect,
}: MonthCalendarProps) {
    const totalDays = daysInMonth(year, month);
    /** 1일의 요일 (0=일 … 6=토) */
    const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();

    // 달력 셀 배열 생성 — 7열 기준 선행 빈 셀 + 날짜 + 후행 빈 셀
    // 행(week) 단위로 잘라 <tr>로 렌더한다.
    const cells: (DayGroup | null)[] = [
        ...Array.from<null>({ length: firstDow }).fill(null),
        ...Array.from({ length: totalDays }, (_, i) => {
            const d = i + 1;
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            return groupMap.get(key) ?? null;
        }),
    ];

    // 7의 배수로 패딩
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (DayGroup | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }

    const captionText = `${year}년 ${MONTH_LABELS[month]} 경제 캘린더`;

    return (
        <div>
            <p
                className="text-secondary-300 mb-2 text-sm font-medium"
                aria-hidden="true"
            >
                {year}년 {MONTH_LABELS[month]}
            </p>
            <table className="w-full table-fixed border-collapse" role="grid">
                <caption className="sr-only">{captionText}</caption>
                <thead>
                    <tr>
                        {WEEKDAY_LABELS.map(label => (
                            <th
                                key={label}
                                scope="col"
                                className="text-secondary-400 py-1 text-center text-[11px] font-medium"
                            >
                                {label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {weeks.map((week, wi) => (
                        <tr key={wi}>
                            {week.map((cell, ci) =>
                                cell !== null ? (
                                    <DayCell
                                        key={cell.dateKey}
                                        group={cell}
                                        isSelected={
                                            selectedDateKey === cell.dateKey
                                        }
                                        onSelect={onSelect}
                                    />
                                ) : (
                                    <td
                                        key={`empty-${wi}-${ci}`}
                                        aria-hidden="true"
                                        className="p-0.5"
                                    />
                                )
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

interface EconomicCalendarGridProps {
    events: readonly EconomicCalendarEvent[];
}

/**
 * 경제 캘린더 — 월 그리드 레이아웃(한국시간 기준).
 *
 * 구조:
 * 1. EconomicCalendarEvent[]를 KST 날짜 키로 그룹핑.
 * 2. 스패닝하는 KST 월별 `<table>` 그리드 렌더.
 * 3. 날짜 셀 클릭 → 상세 패널 표시(useState).
 * 4. 모든 날짜의 상세 패널을 DOM에 렌더하고(`hidden` 속성으로 비선택 숨김)
 *    SSR 크롤러가 전체 이벤트 텍스트를 색인할 수 있도록 보장한다.
 *
 * ISR 안전: `Date.now()` / `new Date()` (무인수) 호출 없음.
 * 기본 선택 날짜 = 이벤트가 있는 가장 이른 KST 날짜(결정론적).
 */
export function EconomicCalendarGrid({ events }: EconomicCalendarGridProps) {
    const groups = groupEventsByKstDay(events);

    /**
     * 기본 선택 날짜: 그룹 중 가장 이른 날짜키 (이미 오름차순 정렬됨).
     * Date.now() 미사용 — ISR 정적 생성 환경에서도 결정론적.
     */
    const defaultDateKey = groups.length > 0 ? groups[0].dateKey : '';
    const [selectedDateKey, setSelectedDateKey] = useState(defaultDateKey);

    if (events.length === 0) {
        return (
            <section aria-labelledby="economy-calendar-heading">
                <h2
                    id="economy-calendar-heading"
                    className="text-secondary-100 mb-3 text-lg font-semibold"
                >
                    경제 캘린더{' '}
                    <span className="text-secondary-400 text-sm font-normal">
                        (한국시간)
                    </span>
                </h2>
                <p className="text-secondary-400 text-sm">
                    다가오는 미국 경제 발표 일정이 아직 없어요.
                </p>
            </section>
        );
    }

    const groupMap = new Map<string, DayGroup>(groups.map(g => [g.dateKey, g]));
    const months = spannedMonths(groups);

    return (
        <section aria-labelledby="economy-calendar-heading">
            <h2
                id="economy-calendar-heading"
                className="text-secondary-100 mb-4 text-lg font-semibold"
            >
                경제 캘린더{' '}
                <span className="text-secondary-400 text-sm font-normal">
                    (한국시간)
                </span>
            </h2>

            {/* 월별 그리드 — 스패닝 월이 2개이면 두 테이블 수직 스택 */}
            <div className="border-secondary-700 space-y-6 rounded-xl border p-3 sm:p-4">
                {months.map(({ year, month }) => (
                    <MonthCalendar
                        key={`${year}-${month}`}
                        year={year}
                        month={month}
                        groupMap={groupMap}
                        selectedDateKey={selectedDateKey}
                        onSelect={setSelectedDateKey}
                    />
                ))}
            </div>

            {/* 선택된 날짜 상세 패널 영역 — 모든 패널 DOM에 유지(SSR 크롤러용) */}
            <div
                className="mt-4 space-y-0"
                aria-live="polite"
                aria-atomic="true"
            >
                {groups.map(group => (
                    <DayDetailPanel
                        key={group.dateKey}
                        group={group}
                        isSelected={group.dateKey === selectedDateKey}
                    />
                ))}
            </div>
        </section>
    );
}
