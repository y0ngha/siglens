'use client';

import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
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

import {
    CALENDAR_COUNTRY_LABEL_KEY,
    resolveCalendarInterpretation,
    resolveCalendarSummary,
    type CalendarCountry,
    type EconomicCalendarEventWithAnalysis,
} from '@/entities/economy';
import {
    SENTIMENT_LABEL_KEY,
    SENTIMENT_CLASS,
} from '@/shared/lib/sentimentDisplay';
import { cn } from '@/shared/lib/cn';
import { formatNum } from '@/shared/lib/formatNum';
import { etDateTimeToKst } from '@/shared/lib/etTimeUtils';
import { useEconomicCalendarTrigger } from '../hooks/useEconomicCalendarTrigger';
import { useIndicatorTranslationTrigger } from '../hooks/useIndicatorTranslationTrigger';
import { ImpactFilter } from './ImpactFilter';
import { IMPACT_LABEL_KEY, IMPACT_ORDER } from '../utils/impactMeta';

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

const WEEKDAY_LABEL_CACHE = new Map<Locale, readonly string[]>();

/**
 * 7열 그리드 요일 헤더 (일요일 시작).
 *
 * 예전에는 `['일','월',…]` 상수였다 — 캡션·헤더가 `2026 August`로 번역된
 * 바로 아래에서 요일 줄만 한국어로 남아 있었다. `monthLabel`과 같은
 * `Intl.DateTimeFormat` 경로로 파생한다.
 *
 * 기준일은 **일요일**이어야 한다: 2000-01-02는 일요일이다.
 */
function weekdayLabels(locale: Locale): readonly string[] {
    const cached = WEEKDAY_LABEL_CACHE.get(locale);
    if (cached !== undefined) return cached;
    const fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        weekday: 'short',
        timeZone: 'UTC',
    });
    const labels = Array.from({ length: 7 }, (_, i) =>
        fmt.format(new Date(Date.UTC(2000, 0, 2 + i)))
    );
    WEEKDAY_LABEL_CACHE.set(locale, labels);
    return labels;
}

/** 한국어 월 레이블 ('1월' … '12월') */
/**
 * 월 이름은 **`Intl`에서 얻는다** — 카탈로그 키 12개를 만들 이유가 없다.
 *
 * 예전에는 한국어 배열 상수였다. 감싸는 템플릿은 번역돼 있어서 `/en/economy`가
 * `2026 8월`, `/ja`가 `2026年8월`을 찍었다 — 번역된 템플릿에 한국어 값을 끼우는,
 * 이 브랜치에서 반복된 결함 계열이다.
 */
/**
 * 기본으로 켜 두는 영향도.
 *
 * 연간 Low 이벤트가 2,919건으로 대다수라 기본 노출 시 노이즈가 크다(스펙 SP-C).
 * 결정론적 초기값 — 렌더 중 시각/난수 의존 없음(ISR 안전).
 */
const DEFAULT_ACTIVE_IMPACTS: readonly CalendarImpact[] = ['High', 'Medium'];

/** 인라인 이벤트 미리보기 최대 표시 건수 (sm 이상 화면) */
const INLINE_EVENT_MAX = 2;

const MONTH_LABEL_CACHE = new Map<string, string>();

function monthLabel(locale: Locale, month: number): string {
    const key = `${locale}:${month}`;
    const cached = MONTH_LABEL_CACHE.get(key);
    if (cached !== undefined) return cached;
    const label = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        month: 'long',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(2000, month, 1)));
    MONTH_LABEL_CACHE.set(key, label);
    return label;
}

/**
 * 그리드 입력 — SP-A `EconomicCalendarEvent` + (선택) SP-D 분석 필드. 분석 필드를
 * optional로 둬 SP-A 호출부(분석 없는 이벤트 리터럴)도 그대로 컴파일된다. DB reader
 * (`getCalendarFromDb`)는 항상 세 필드를 채워 넘기므로 런타임엔 항상 존재(또는 null).
 * `analyzedAt`은 여기서 한 번도 역참조되지 않아 제외했다 — 타입에만 남겨두면 페이지가
 * 계속 넘겨도 아무도 못 알아채고, 그대로 flight에 실린다(`Date` 1개당 28자 × 66건).
 */
type CalendarGridEvent = EconomicCalendarEvent &
    Partial<
        Pick<
            EconomicCalendarEventWithAnalysis,
            'sentiment' | 'summaryKo' | 'interpretationKo'
        >
    >;

interface KstEvent {
    /** ET ISO-8601 문자열 — `<time dateTime>` 용 */
    iso: string;
    /** 한국시간 레이블 '오전/오후 H:mm' */
    kstTimeLabel: string;
    /** 월 셀 인라인 표기 — 오전/오후 없음. */
    inlineTimeLabel: string;
    original: CalendarGridEvent;
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
    events: readonly CalendarGridEvent[],
    locale: Locale
): DayGroup[] {
    const map = new Map<string, KstEvent[]>();

    for (const ev of events) {
        const { iso, kstDateKey, kstTimeLabel } = etDateTimeToKst(
            ev.date,
            locale
        );
        // 월 셀은 한 줄 폭이라 오전/오후를 넣을 자리가 없다. 문자열을 깎으면
        // 한국어에서만 동작하므로(`replace(/^(오전|오후)/)`), 포맷 단계에서 끈다.
        const { kstTimeLabel: inlineTimeLabel } = etDateTimeToKst(
            ev.date,
            locale,
            false
        );
        const kst: KstEvent = {
            iso,
            kstTimeLabel,
            inlineTimeLabel,
            original: ev,
        };
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

/** KST 날짜 키 'YYYY-MM-DD'를 로케일 요일 레이블로 변환. */
function kstDayOfWeekLabel(dateKey: string, locale: Locale): string {
    return weekdayLabels(locale)[dayOfWeekFromKey(dateKey)]!;
}

/**
 * `Object.hasOwn`으로 direct-property 여부를 확인해 prototype-pollution 방지
 * (rawEvent === "toString" 등이 Object.prototype 함수를 반환하는 크래시 차단).
 */
function displayEventLabel(
    rawEvent: string,
    labels: Record<string, string>
): string {
    return Object.hasOwn(labels, rawEvent) ? labels[rawEvent] : rawEvent;
}

interface DayDetailPanelProps {
    group: DayGroup;
    isSelected: boolean;
    activeImpacts: ReadonlySet<CalendarImpact>;
    labels: Record<string, string>;
}

function DayDetailPanel({
    group,
    isSelected,
    activeImpacts,
    labels,
}: DayDetailPanelProps) {
    const t = useTranslations('widgets.economy');
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는
    // 패턴"만 본다 — `SENTIMENT_LABEL_KEY[...]`를 그대로 `tLabel(...)`에
    // 넣어야 `shared.enumLabel`이 이 라우트의 클라이언트 번들에 실린다
    // (sentimentDisplay.ts의 SENTIMENT_LABEL_KEY export 주석 참고).
    const tLabel = useTranslations('shared.enumLabel');
    const locale = useCurrentLocale();
    const { month, day, dateKey } = group;
    const dowLabel = kstDayOfWeekLabel(dateKey, locale);

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
            <h3 className="font-semibold text-secondary-100">
                {/* 월은 숫자가 아니라 로케일 월 이름으로 넘긴다 — 번역된
                    템플릿에 `9`를 꽂으면 영어에서 `9 15 (Wed`가 된다. 닫는
                    괄호도 메시지 안에 있다(예전엔 JSX에 떨어져 있었다). */}
                {t('EconomicCalendarGrid.dc712b', {
                    v0: monthLabel(locale, month),
                    v1: day,
                    v2: dowLabel,
                })}
            </h3>
            <ul className="space-y-2">
                {group.events.map(ev => {
                    const hasSummaryContent =
                        (ev.original.summaryKo?.trim().length ?? 0) > 0;
                    return (
                        <li
                            key={`${ev.iso}:${ev.original.event}:${ev.original.actual ?? ''}`}
                            hidden={!activeImpacts.has(ev.original.impact)}
                            className="rounded-lg border border-secondary-700 bg-secondary-800/50 p-3"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="mb-0.5 flex items-center gap-2">
                                        <time
                                            dateTime={ev.iso}
                                            className="shrink-0 text-xs text-secondary-300 tabular-nums"
                                        >
                                            {ev.kstTimeLabel}
                                        </time>
                                    </div>
                                    <p className="text-sm font-medium text-secondary-100">
                                        {displayEventLabel(
                                            ev.original.event,
                                            labels
                                        )}
                                    </p>
                                    <p className="mt-0.5 text-xs text-secondary-400">
                                        {t('EconomicCalendarGrid.3ebd79', {
                                            v0: formatNum(
                                                ev.original.estimate,
                                                ev.original.unit
                                            ),
                                            v1: formatNum(
                                                ev.original.previous,
                                                ev.original.unit
                                            ),
                                        })}
                                        {ev.original.actual !== null && (
                                            <>
                                                {' '}
                                                {t(
                                                    'EconomicCalendarGrid.e1d376',
                                                    {
                                                        v0: formatNum(
                                                            ev.original.actual,
                                                            ev.original.unit
                                                        ),
                                                    }
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
                                    {tLabel(
                                        IMPACT_LABEL_KEY[ev.original.impact]
                                    )}
                                </span>
                            </div>
                            {ev.original.sentiment != null &&
                                hasSummaryContent && (
                                    <div className="mt-2 space-y-1 border-t border-secondary-700/60 pt-2">
                                        <span
                                            className={cn(
                                                'inline-block rounded px-2 py-0.5 text-xs font-medium',
                                                SENTIMENT_CLASS[
                                                    ev.original.sentiment
                                                ]
                                            )}
                                        >
                                            {tLabel(
                                                SENTIMENT_LABEL_KEY[
                                                    ev.original.sentiment
                                                ]
                                            )}
                                        </span>
                                        <p className="text-sm text-secondary-200">
                                            {resolveCalendarSummary(
                                                ev.original
                                            )}
                                        </p>
                                        {resolveCalendarInterpretation(
                                            ev.original
                                        ) !== null && (
                                            <p className="text-xs leading-relaxed text-secondary-400">
                                                {resolveCalendarInterpretation(
                                                    ev.original
                                                )}
                                            </p>
                                        )}
                                    </div>
                                )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

interface DayCellProps {
    group: DayGroup;
    isSelected: boolean;
    activeImpacts: ReadonlySet<CalendarImpact>;
    onSelect: (dateKey: string) => void;
    labels: Record<string, string>;
}

function DayCell({
    group,
    isSelected,
    activeImpacts,
    onSelect,
    labels,
}: DayCellProps) {
    const t = useTranslations('widgets.economy');
    const tMisc = useTranslations('shared.ui.misc');
    const { day, month, dateKey } = group;

    /**
     * 활성 impact만 남긴 이벤트 — 셀의 점·건수·인라인 미리보기에 사용.
     * 시각 필터(셀은 SEO 비핵심, 전체 텍스트는 상세 패널이 DOM에 보유).
     *
     * 임팩트 종류 집합 — 점 렌더 순서(High → Medium → Low)를 위해 순서 유지.
     * 동일 날짜에 High가 여러 건이어도 점은 1개만 표시한다(시각적 노이즈 감소).
     */
    const { visibleEvents, count, dots } = useMemo(() => {
        const visibleEvents = group.events.filter(e =>
            activeImpacts.has(e.original.impact)
        );
        const impactSet = new Set(visibleEvents.map(e => e.original.impact));
        return {
            visibleEvents,
            count: visibleEvents.length,
            dots: IMPACT_ORDER.filter(i => impactSet.has(i)),
        };
    }, [group.events, activeImpacts]);

    return (
        <td className="p-0.5 align-top">
            <button
                id={`day-btn-${dateKey}`}
                type="button"
                aria-label={tMisc('calendarDayAria', {
                    v0: month + 1,
                    v1: day,
                    v2: count,
                })}
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

                <span className="mt-0.5 block text-[10px] text-secondary-300 tabular-nums">
                    {t('EconomicCalendarGrid.703910', { v0: count })}
                </span>

                <span className="mt-1 hidden space-y-0.5 sm:block">
                    {visibleEvents.slice(0, INLINE_EVENT_MAX).map(ev => (
                        <span
                            key={`${ev.iso}:${ev.original.event}`}
                            className="block min-w-0 truncate text-[10px] leading-tight text-secondary-400"
                        >
                            {ev.inlineTimeLabel}{' '}
                            {displayEventLabel(ev.original.event, labels)}
                        </span>
                    ))}
                    {count > INLINE_EVENT_MAX && (
                        <span className="block text-[10px] text-secondary-500">
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
    activeImpacts: ReadonlySet<CalendarImpact>;
    onSelect: (dateKey: string) => void;
    labels: Record<string, string>;
}

function MonthCalendar({
    year,
    month,
    groupMap,
    selectedDateKey,
    activeImpacts,
    onSelect,
    labels,
}: MonthCalendarProps) {
    const t = useTranslations('widgets.economy');
    const locale = useCurrentLocale();
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

    const captionText = t('EconomicCalendarGrid.490b3a', {
        v0: year,
        v1: monthLabel(locale, month),
    });

    return (
        <div>
            <p
                className="mb-2 text-sm font-medium text-secondary-300"
                aria-hidden="true"
            >
                {t('EconomicCalendarGrid.490b3a', {
                    v0: year,
                    v1: monthLabel(locale, month),
                })}
            </p>
            <table className="w-full table-fixed border-collapse">
                <caption className="sr-only">{captionText}</caption>
                <thead>
                    <tr>
                        {weekdayLabels(locale).map(label => (
                            <th
                                key={label}
                                scope="col"
                                className="py-1 text-center text-[11px] font-medium text-secondary-400"
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
                                        activeImpacts={activeImpacts}
                                        onSelect={onSelect}
                                        labels={labels}
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
    events: readonly CalendarGridEvent[];
    /**
     * 기본 선택 기준일 — KST 'YYYY-MM-DD'. 서버 RSC가 ET-오늘 instant를
     * KST 날짜키로 1회 변환해 주입한다(ISR 안전: 클라에서 `Date.now()` 미사용).
     * 생략 시 가장 이른 그룹을 기본 선택(기존 동작 유지).
     */
    today?: string;
    /**
     * raw 이벤트명 → 표시 레이블(한국어 우선) 맵. 서버 RSC가 `resolveIndicatorLabels`로
     * 미리 해결해 주입한다. 생략 시 모든 이벤트가 영어 원문으로 표시된다(결정론적 fallback).
     */
    labels?: Record<string, string>;
    /**
     * 어느 나라 캘린더인가. 마운트 시 도는 인제스션 트리거가 이 값으로 갈린다 —
     * 기본값을 두지 않는 것은 의도다. 한국 라우트에서 빠뜨리면 미국 이벤트만
     * 계속 수집되고 한국 캘린더는 영원히 비는데, 화면에는 아무 표시가 없다.
     */
    country: CalendarCountry;
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
 * 5. 중요도 필터(ImpactFilter) — activeImpacts로 셀 건수·점·미리보기를 시각 한정.
 *    Low(연 2,919건)를 기본 OFF하여 노이즈 억제; 상세 패널 `<li>`는 DOM에 유지(크롤러).
 *
 * ISR 안전: `Date.now()` / `new Date()` (무인수) 호출 없음.
 * 기본 선택 날짜 = `today`(KST) → 가장 가까운 미래 → 가장 이른 그룹.
 */
export function EconomicCalendarGrid({
    events,
    today = '',
    labels = {},
    country,
}: EconomicCalendarGridProps) {
    const t = useTranslations('widgets.economy');
    const tCountry = useTranslations('entities.economy.calendarCountry');
    const locale = useCurrentLocale();
    const [selectedDateKey, setSelectedDateKey] = useState('');
    const [activeImpacts, setActiveImpacts] = useState<
        ReadonlySet<CalendarImpact>
    >(() => new Set(DEFAULT_ACTIVE_IMPACTS));
    useEconomicCalendarTrigger(country);
    useIndicatorTranslationTrigger(events, labels);
    const groups = useMemo(
        () => groupEventsByKstDay(events, locale),
        [events, locale]
    );
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

    function toggleImpact(impact: CalendarImpact): void {
        setActiveImpacts(prev => {
            const next = new Set(prev);
            if (next.has(impact)) {
                next.delete(impact);
            } else {
                next.add(impact);
            }
            return next;
        });
    }

    useEffect(() => {
        syncDefault();
    }, [groups, today]);

    if (events.length === 0) {
        return (
            <section aria-labelledby="economy-calendar-heading">
                <h2
                    id="economy-calendar-heading"
                    className="mb-3 text-lg font-semibold text-secondary-100"
                >
                    {t('EconomicCalendarGrid.596fce')}{' '}
                    <span className="text-sm font-normal text-secondary-400">
                        {t('EconomicCalendarGrid.4ccace')}
                    </span>
                </h2>
                <p className="text-sm text-secondary-400">
                    {t('EconomicCalendarGrid.f9d9dc', {
                        v0: tCountry(CALENDAR_COUNTRY_LABEL_KEY[country]),
                    })}
                </p>
            </section>
        );
    }

    return (
        <section aria-labelledby="economy-calendar-heading">
            <h2
                id="economy-calendar-heading"
                className="mb-4 text-lg font-semibold text-secondary-100"
            >
                {t('EconomicCalendarGrid.596fce')}{' '}
                <span className="text-sm font-normal text-secondary-400">
                    {t('EconomicCalendarGrid.4ccace')}
                </span>
            </h2>

            <div className="mb-3">
                <ImpactFilter value={activeImpacts} onToggle={toggleImpact} />
            </div>

            <div className="space-y-6 rounded-xl border border-secondary-700 p-3 sm:p-4">
                {months.map(({ year, month }) => (
                    <MonthCalendar
                        key={`${year}-${month}`}
                        year={year}
                        month={month}
                        groupMap={groupMap}
                        selectedDateKey={selectedDateKey}
                        activeImpacts={activeImpacts}
                        onSelect={setSelectedDateKey}
                        labels={labels}
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
                        activeImpacts={activeImpacts}
                        labels={labels}
                    />
                ))}
            </div>
        </section>
    );
}
