import { MS_PER_DAY } from '@/shared/config/time';
import type { KrReportCode } from '../model';

/**
 * 지금 읽어 볼 정기보고서 후보 — 결산 기간이 끝났고 **공시 창이 열린** 보고서를 최신순으로 최대 `limit`개.
 *
 * 12월 결산 법인 기준이다. 공시 마감(1분기 5/15, 반기 8/14, 3분기 11/14, 사업보고서 다음 해 3/31) 3주 전부터 그 보고서를 후보로 올린다.
 * 기간 말 직후부터 올리면 아직 아무도 내지 않은 보고서를 매일 한 번씩 묻게 된다(분기 보고서는 마감까지 45일, 회사 수천 곳이 같은
 * 질문에 `013`을 받는다). 대신 창이 열리기 전에 일찍 낸 회사는 창이 열릴 때까지 직전 보고서로 계산한다 — 네이버도 공시 뒤
 * 며칠~몇 주 늦게 갱신하므로 화면 기준이 크게 어긋나지 않는다.
 *
 * `today`는 KST 날짜(`YYYY-MM-DD`)다. 기간 말 당일에는 보고서가 있을 수 없어 기간 말 **다음 날**부터 후보다.
 */
export interface KrReportCandidate {
    year: number;
    reportCode: KrReportCode;
    /** 결산 기간 말(`YYYY-MM-DD`). */
    periodEnd: string;
    /** 공시 마감일(`YYYY-MM-DD`). */
    deadline: string;
}

/** 마감 며칠 전부터 후보로 올리는가. 마감 직전 2주에 대부분의 회사가 낸다. */
const WINDOW_OPENS_DAYS_BEFORE_DEADLINE = 21;

/** `deadlineYearOffset`: 사업보고서는 결산 다음 해 3월 말이 마감이다. */
const PERIODS: readonly {
    reportCode: KrReportCode;
    periodMonthDay: string;
    deadlineMonthDay: string;
    deadlineYearOffset: number;
}[] = [
    {
        reportCode: '11011',
        periodMonthDay: '12-31',
        deadlineMonthDay: '03-31',
        deadlineYearOffset: 1,
    },
    {
        reportCode: '11014',
        periodMonthDay: '09-30',
        deadlineMonthDay: '11-14',
        deadlineYearOffset: 0,
    },
    {
        reportCode: '11012',
        periodMonthDay: '06-30',
        deadlineMonthDay: '08-14',
        deadlineYearOffset: 0,
    },
    {
        reportCode: '11013',
        periodMonthDay: '03-31',
        deadlineMonthDay: '05-15',
        deadlineYearOffset: 0,
    },
];

const periodOf = (reportCode: KrReportCode) =>
    PERIODS.find(period => period.reportCode === reportCode) ?? PERIODS[0];

/** 12월 결산 법인의 보고서 기간 말. */
export function reportPeriodEnd(
    year: number,
    reportCode: KrReportCode
): string {
    return `${year}-${periodOf(reportCode).periodMonthDay}`;
}

const shiftDays = (isoDate: string, days: number): string =>
    new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * MS_PER_DAY)
        .toISOString()
        .slice(0, 10);

export function krReportCandidates(
    today: string,
    limit = 3
): KrReportCandidate[] {
    const thisYear = Number(today.slice(0, 4));
    return [thisYear, thisYear - 1, thisYear - 2]
        .flatMap(year =>
            PERIODS.map(period => ({
                year,
                reportCode: period.reportCode,
                periodEnd: `${year}-${period.periodMonthDay}`,
                deadline: `${year + period.deadlineYearOffset}-${period.deadlineMonthDay}`,
            }))
        )
        .filter(
            candidate =>
                candidate.periodEnd < today &&
                shiftDays(
                    candidate.deadline,
                    -WINDOW_OPENS_DAYS_BEFORE_DEADLINE
                ) <= today
        )
        .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
        .slice(0, limit);
}
