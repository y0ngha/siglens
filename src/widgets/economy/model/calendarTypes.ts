/**
 * 경제 캘린더 그리드의 표시 모델 — 입력 이벤트, KST 일자 그룹, 월 그리드 칸/주.
 */
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import type { EconomicCalendarEventWithAnalysis } from '@/entities/economy/model';

/**
 * 그리드 입력 — SP-A `EconomicCalendarEvent` + (선택) SP-D 분석 필드. 분석 필드를
 * optional로 둬 SP-A 호출부(분석 없는 이벤트 리터럴)도 그대로 컴파일된다. DB reader
 * (`getCalendarFromDb`)는 항상 세 필드를 채워 넘기므로 런타임엔 항상 존재(또는 null).
 * `analyzedAt`은 여기서 역참조되지 않아 제외했다 — 타입에만 남겨두면 페이지가 계속
 * 넘겨도 아무도 못 알아채고, 그대로 flight에 실린다(`Date` 1개당 28자 × 66건).
 */
export type CalendarGridEvent = EconomicCalendarEvent &
    Partial<
        Pick<
            EconomicCalendarEventWithAnalysis,
            | 'sentiment'
            | 'summaryKo'
            | 'interpretationKo'
            | 'summaryLocalized'
            | 'interpretationLocalized'
        >
    >;

export interface KstEvent {
    /** UTC ISO-8601 문자열 — `<time dateTime>` 용 */
    iso: string;
    /** 상세 패널용 KST 시각(로케일 12시간제). */
    kstTimeLabel: string;
    /** 월 셀 인라인 표기 — 오전/오후 없음. */
    inlineTimeLabel: string;
    original: CalendarGridEvent;
}

export interface DayGroup {
    /** KST 기준 날짜 키 'YYYY-MM-DD' */
    dateKey: string;
    /** KST 날짜의 요일 (0=일 … 6=토) */
    dayOfWeek: number;
    /** KST 연도 */
    year: number;
    /** KST 월 (0-indexed, 0=1월) */
    month: number;
    /** KST 일 */
    day: number;
    events: KstEvent[];
}

export interface MonthGrid {
    year: number;
    /** 0-indexed */
    month: number;
}

/** 월 그리드의 한 칸 — 이벤트가 없는 날도 날짜는 있다. */
export interface MonthDay {
    dateKey: string;
    day: number;
    /** 그날 이벤트. 없으면 `null`(버튼 대신 숫자만 그린다). */
    group: DayGroup | null;
}

/** 7칸짜리 주 한 줄. `null`은 그 달 밖의 앞뒤 패딩. */
export type MonthWeekCells = (MonthDay | null)[];

export interface MonthWeek {
    cells: MonthWeekCells;
    /** 지난 주 — "지난 일정 보기"를 누르기 전까지 `hidden`(DOM에는 남는다). */
    isPast: boolean;
}

/** 한 달 표시 단위 — 연·월과 주 목록. */
export interface MonthView extends MonthGrid {
    weeks: MonthWeek[];
}
