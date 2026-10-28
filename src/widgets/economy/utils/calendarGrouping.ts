/**
 * 캘린더 이벤트 → KST 일자 그룹 → 월 그리드(주·칸) 변환과 기본 선택일·지난 주 접기 판정.
 * 모두 순수 함수다(렌더 중 시각 의존 없음 — ISR 안전).
 */
import type { CalendarImpact } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    fmpCalendarDateTimeToKst,
    kstDateKeyDaysBefore,
} from '@/shared/lib/etTimeUtils';
import type {
    CalendarGridEvent,
    DayGroup,
    KstEvent,
    MonthDay,
    MonthGrid,
    MonthView,
    MonthWeekCells,
} from '../model/calendarTypes';
import {
    dayOfWeekFromKey,
    daysInMonth,
    parseDateKey,
    toDateKey,
} from './calendarDateKeys';

/**
 * 이벤트를 KST 날짜 키로 묶어 날짜순 `DayGroup[]`을 만든다. 그룹 안은 시각순이다.
 *
 * 이벤트마다 날짜 문자열을 한 번만 파싱한다(상세·월 셀 두 시각 표기를 함께 받는다). UTC
 * 시각순 정렬은 KST 날짜순과 같아서, 정렬된 목록을 한 번 훑으며 날짜별 버킷에 넣으면
 * 그룹 순서·그룹 안 순서가 함께 맞는다.
 */
export function groupEventsByKstDay(
    events: readonly CalendarGridEvent[],
    locale: Locale
): DayGroup[] {
    const sorted = events
        .map(ev => {
            const { iso, kstDateKey, kstTimeLabel, kstCompactTimeLabel } =
                fmpCalendarDateTimeToKst(ev.date, locale);
            const kst: KstEvent = {
                iso,
                kstTimeLabel,
                // 월 셀은 한 줄 폭이라 오전/오후를 넣을 자리가 없다 — 포맷 단계에서 끈 표기.
                inlineTimeLabel: kstCompactTimeLabel,
                original: ev,
            };
            return { dateKey: kstDateKey, kst };
        })
        .toSorted((a, b) => a.kst.iso.localeCompare(b.kst.iso));

    // 함수 안 지역 버킷이라 push로 채운다 — 날마다 배열을 복사하면 O(n²)이다.
    const byDay = new Map<string, KstEvent[]>();
    sorted.forEach(({ dateKey, kst }) => {
        const bucket = byDay.get(dateKey);
        if (bucket === undefined) byDay.set(dateKey, [kst]);
        else bucket.push(kst);
    });

    // 날짜 키로도 한 번 더 정렬한다 — 파싱 실패로 ISO 형식이 다른 이벤트가 섞여도 날짜순을 지킨다.
    return [...byDay]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, dayEvents]) => ({
            dateKey,
            dayOfWeek: dayOfWeekFromKey(dateKey),
            ...parseDateKey(dateKey),
            events: dayEvents,
        }));
}

/** 그룹들이 걸친 KST 월 목록(연·월 중복 제거, 날짜순 유지). */
export function spannedMonths(groups: readonly DayGroup[]): MonthGrid[] {
    return [
        ...new Map(
            groups.map(g => [
                `${g.year}-${g.month}`,
                { year: g.year, month: g.month },
            ])
        ).values(),
    ];
}

function hasEvents(week: MonthWeekCells): boolean {
    return week.some(cell => cell?.group != null);
}

/**
 * 한 달을 7칸씩 끊은 주 목록. **모든 날짜**를 칸으로 만든다 — 이벤트 없는 날을 빼면 날짜가
 * 듬성듬성 건너뛰어 달력으로 읽히지 않는다. 이벤트가 하나도 없는 **앞뒤** 주는 뺀다(캘린더가
 * 과거 14일 ~ 미래 14일 창만 갖고 있어 창 밖의 첫·끝 주는 빈 줄일 뿐이다). 중간의 빈 주는
 * 달력의 연속성을 위해 남긴다.
 */
export function buildMonthWeeks(
    year: number,
    month: number,
    groupMap: ReadonlyMap<string, DayGroup>
): MonthWeekCells[] {
    const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const rawCells: MonthWeekCells = [
        ...Array<null>(firstDow).fill(null),
        ...Array.from(
            { length: daysInMonth(year, month) },
            (_, i): MonthDay => {
                const dateKey = toDateKey(year, month, i + 1);
                return {
                    dateKey,
                    day: i + 1,
                    group: groupMap.get(dateKey) ?? null,
                };
            }
        ),
    ];
    const padCount = (7 - (rawCells.length % 7)) % 7;
    const cells = [...rawCells, ...Array<null>(padCount).fill(null)];
    const weeks = Array.from({ length: cells.length / 7 }, (_, i) =>
        cells.slice(i * 7, i * 7 + 7)
    );
    const first = weeks.findIndex(hasEvents);
    const last = weeks.findLastIndex(hasEvents);
    return first === -1 ? [] : weeks.slice(first, last + 1);
}

/** 주의 마지막 실제 날짜 키(패딩 제외). */
function weekEndKey(week: MonthWeekCells): string {
    return week.findLast(cell => cell !== null)?.dateKey ?? '';
}

interface MonthViewsInput {
    monthWeeks: readonly {
        year: number;
        month: number;
        weeks: MonthWeekCells[];
    }[];
    groups: readonly DayGroup[];
    todayKey: string;
    selectedDateKey: string;
}

/**
 * 주마다 "지난 주" 여부를 붙인다. 기준은 오늘이 속한 주(일요일 시작)의 시작일 — 마지막 날이
 * 그 전인 주가 지난 주다. 앞으로 남은 이벤트가 없으면(전부 과거) 접으면 화면이 텅 비므로 접지
 * 않는다. 선택된 날이 든 주는 항상 보인다 — 선택한 칸이 사라지면 안 된다.
 */
export function buildMonthViews({
    monthWeeks,
    groups,
    todayKey,
    selectedDateKey,
}: MonthViewsInput): MonthView[] {
    const currentWeekStart =
        todayKey === ''
            ? ''
            : kstDateKeyDaysBefore(todayKey, dayOfWeekFromKey(todayKey));
    const collapsePast =
        currentWeekStart !== '' &&
        groups.some(g => g.dateKey >= currentWeekStart);
    return monthWeeks.map(({ year, month, weeks }) => ({
        year,
        month,
        weeks: weeks.map(cells => ({
            cells,
            isPast:
                collapsePast &&
                weekEndKey(cells) < currentWeekStart &&
                !cells.some(cell => cell?.dateKey === selectedDateKey),
        })),
    }));
}

/** 활성 중요도에 드는 그날 이벤트. */
export function visibleEventsOf(
    group: DayGroup,
    activeImpacts: ReadonlySet<CalendarImpact>
): KstEvent[] {
    return group.events.filter(e => activeImpacts.has(e.original.impact));
}

/**
 * 기본 선택 날짜 키 — 오늘 → 오늘 이후 가장 가까운 날 → 가장 이른 날 순으로 고른다.
 * 활성 중요도의 이벤트가 있는 날을 먼저 찾는다 — 기본으로 꺼진 Low만 있는 날을 고르면
 * 제목만 있고 목록이 빈 패널이 열린다. 그런 날이 없으면 전체에서 같은 순서로 고른다.
 * groups는 dateKey 오름차순이다(`groupEventsByKstDay`).
 */
export function pickDefaultDateKey(
    groups: readonly DayGroup[],
    today: string,
    activeImpacts: ReadonlySet<CalendarImpact>
): string {
    const withVisible = groups.filter(
        g => visibleEventsOf(g, activeImpacts).length > 0
    );
    const candidates = withVisible.length > 0 ? withVisible : groups;
    return (
        candidates.find(g => g.dateKey === today)?.dateKey ??
        candidates.find(g => g.dateKey >= today)?.dateKey ??
        candidates[0]?.dateKey ??
        ''
    );
}
