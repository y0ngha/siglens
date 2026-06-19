'use client';

import {
    useState,
    useMemo,
    useEffect,
    useEffectEvent,
    startTransition,
} from 'react';
import type {
    CalendarImpact,
    EconomicCalendarEvent,
} from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';
import { formatNum } from '@/shared/lib/formatNum';
import { etDateTimeToKst } from '@/shared/lib/etTimeUtils';
import { useEconomicCalendarTrigger } from '../hooks/useEconomicCalendarTrigger';

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

/** 임팩트 점 렌더 순서 — High → Medium → Low */
const IMPACT_ORDER: readonly CalendarImpact[] = ['High', 'Medium', 'Low'];

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

/** `parseDateKey` 반환 타입. */
interface ParsedDateKey {
    year: number;
    /** 0-indexed (0=1월) */
    month: number;
    day: number;
}

/**
 * KST 날짜 키 'YYYY-MM-DD'에서 {year, month(0-idx), day}를 파싱한다.
 * `new Date(key)` 는 로컬 자정 기준이라 시스템 TZ에 의존하므로 직접 파싱한다.
 */
function parseDateKey(key: string): ParsedDateKey {
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
        map.set(kstDateKey, [...(map.get(kstDateKey) ?? []), kst]);
    }

    return Array.from(map.entries())
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, evList]) => {
            const { year, month, day } = parseDateKey(dateKey);
            const dayOfWeek = dayOfWeekFromKey(dateKey);
            // 시각 레이블 오름차순 정렬 ('오전' < '오후' 사전 순이 대체로 맞지만
            // iso 기준 정렬이 더 정확하다)
            const sorted = evList.toSorted((a, b) =>
                a.iso.localeCompare(b.iso)
            );
            return { dateKey, dayOfWeek, year, month, day, events: sorted };
        });
}

/**
 * DayGroup 배열에서 스패닝하는 KST 월 목록을 반환한다 (연·월 중복 제거).
 * Map은 삽입 순서를 보장하므로 groups가 날짜순으로 이미 정렬된 경우 월 순서가 유지된다.
 */
function spannedMonths(groups: DayGroup[]): MonthGrid[] {
    const monthMap = new Map(
        groups.map(g => [
            `${g.year}-${g.month}`,
            { year: g.year, month: g.month },
        ])
    );
    return [...monthMap.values()];
}

/**
 * KST 날짜 키 'YYYY-MM-DD'를 한국어 요일 레이블로 변환.
 * ('일' | '월' | '화' | '수' | '목' | '금' | '토')
 */
function kstDayOfWeekLabel(dateKey: string): string {
    return WEEKDAY_LABELS[dayOfWeekFromKey(dateKey)];
}

interface DayDetailPanelProps {
    group: DayGroup;
    isSelected: boolean;
}

function DayDetailPanel({ group, isSelected }: DayDetailPanelProps) {
    const { month, day, dateKey } = group;
    const dowLabel = kstDayOfWeekLabel(dateKey);

    return (
        /**
         * SSR 크롤러 접근성: 모든 패널을 조건부 렌더(unmount) 대신 DOM에 항상 유지하고,
         * 비선택 패널에 `hidden` 속성을 부여한다. 조건부 렌더와 달리 비선택 패널도
         * HTML 소스에 남아 크롤러가 전체 이벤트를 색인할 수 있다.
         * `hidden` 속성은 요소를 a11y 트리에서 제거하므로 스크린 리더는 선택된 패널만 읽는다.
         *
         * ARIA 패턴: 토글 버튼(`aria-pressed`) + 레이블 연결(`aria-labelledby`).
         * `role="tabpanel"` 미사용 — `role="tab"` / `role="tablist"` 없이 단독으로
         * 쓰면 고아 ARIA 오류가 발생한다. 대신 각 버튼의 `id`를 `aria-labelledby`로
         * 참조해 버튼-패널 관계를 의미론적으로 연결한다.
         */
        <div
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

interface DayCellProps {
    group: DayGroup;
    isSelected: boolean;
    onSelect: (dateKey: string) => void;
}

function DayCell({ group, isSelected, onSelect }: DayCellProps) {
    const { day, month, events, dateKey } = group;
    const count = events.length;

    /**
     * 임팩트 종류 집합 — 점 렌더 순서(High → Medium → Low)를 위해 순서 유지.
     * 동일 날짜에 High가 여러 건이어도 점은 1개만 표시한다(시각적 노이즈 감소).
     */
    const impactSet = new Set(events.map(e => e.original.impact));
    const dots = IMPACT_ORDER.filter(i => impactSet.has(i));

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

                <span className="text-secondary-300 mt-0.5 block text-[10px] tabular-nums">
                    {count}건
                </span>

                <span className="mt-1 hidden space-y-0.5 sm:block">
                    {events.slice(0, INLINE_EVENT_MAX).map(ev => (
                        <span
                            key={`${ev.iso}:${ev.original.event}`}
                            className="text-secondary-400 block min-w-0 truncate text-[10px] leading-tight"
                        >
                            {ev.kstTimeLabel.replace(/^(오전|오후)\s*/, '')}{' '}
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
    const weeks = useMemo(() => {
        const totalDays = daysInMonth(year, month);
        /** 1일의 요일 (0=일 … 6=토) */
        const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();

        const rawCells: (DayGroup | null)[] = [
            ...Array<null>(firstDow).fill(null),
            ...Array.from({ length: totalDays }, (_, i) => {
                const d = i + 1;
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                return groupMap.get(key) ?? null;
            }),
        ];
        const padCount = (7 - (rawCells.length % 7)) % 7;
        const cells =
            padCount > 0
                ? [...rawCells, ...Array<null>(padCount).fill(null)]
                : rawCells;

        return Array.from({ length: cells.length / 7 }, (_, i) =>
            cells.slice(i * 7, i * 7 + 7)
        ) as (DayGroup | null)[][];
    }, [year, month, groupMap]);

    const captionText = `${year}년 ${MONTH_LABELS[month]} 경제 캘린더`;

    return (
        <div>
            <p
                className="text-secondary-300 mb-2 text-sm font-medium"
                aria-hidden="true"
            >
                {year}년 {MONTH_LABELS[month]}
            </p>
            <table className="w-full table-fixed border-collapse">
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

/**
 * 기본 선택 날짜 키를 결정한다 — 결정론적(렌더 중 `Date.now()` 금지).
 * `today`(KST 'YYYY-MM-DD', 서버 RSC가 ET-오늘에서 1회 계산해 주입)에 그룹이 있으면
 * 그날, 없으면 `today` 이상인 가장 가까운 미래 그룹, 그것도 없으면 가장 이른 그룹.
 * groups는 dateKey 오름차순 정렬돼 있다(`groupEventsByKstDay`).
 */
function pickDefaultDateKey(groups: DayGroup[], today: string): string {
    if (groups.length === 0) return '';
    const exact = groups.find(g => g.dateKey === today);
    if (exact !== undefined) return exact.dateKey;
    const upcoming = groups.find(g => g.dateKey >= today);
    if (upcoming !== undefined) return upcoming.dateKey;
    return groups[0].dateKey;
}

interface EconomicCalendarGridProps {
    events: readonly EconomicCalendarEvent[];
    /**
     * 기본 선택 기준일 — KST 'YYYY-MM-DD'. 서버 RSC가 ET-오늘 instant를
     * KST 날짜키로 1회 변환해 주입한다(ISR 안전: 클라에서 `Date.now()` 미사용).
     * 생략 시 가장 이른 그룹을 기본 선택(기존 동작 유지).
     */
    today?: string;
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
 * 기본 선택 날짜 = `today`(KST) → 가장 가까운 미래 → 가장 이른 그룹.
 */
export function EconomicCalendarGrid({
    events,
    today = '',
}: EconomicCalendarGridProps) {
    const [selectedDateKey, setSelectedDateKey] = useState('');
    useEconomicCalendarTrigger();
    const groups = useMemo(() => groupEventsByKstDay(events), [events]);
    const groupMap = useMemo(
        () => new Map<string, DayGroup>(groups.map(g => [g.dateKey, g])),
        [groups]
    );
    const months = useMemo(() => spannedMonths(groups), [groups]);

    /**
     * events/today가 바뀔 때 기본 선택 날짜를 재동기화한다(오늘 → 가장 가까운 미래 →
     * 가장 이른 그룹). useEffectEvent로 감싸 안정 참조를 만들고 startTransition으로
     * react-hooks/set-state-in-effect를 만족시킨다(기존 패턴 유지).
     */
    const syncDefault = useEffectEvent((): void => {
        startTransition(() => {
            setSelectedDateKey(pickDefaultDateKey(groups, today));
        });
    });
    useEffect(() => {
        syncDefault();
    }, [groups, today]);

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
