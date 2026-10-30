import type { EarningsReportUpsertInput } from '../model';

/**
 * 프로바이더 응답 중 `today` 이후의 **실적 미발표** 행 날짜.
 *
 * 비어 있지 않으면 이 응답이 "지금의 예정일"을 들고 있다는 뜻이라, DB에 남은 다른
 * 미래 미발표 행은 옛 예정일(회사가 날짜를 옮기기 전 값)로 본다
 * (`pruneSupersededUpcoming`). 비어 있으면(과거 행만 왔거나 빈 응답) 대체할 일정이
 * 없으므로 아무것도 지우지 않는다 — 프로바이더가 일시적으로 일정을 빠뜨린 것과
 * 일정이 옮겨진 것을 구별할 수 없다.
 */
export function upcomingUnreportedDates(
    reports: readonly EarningsReportUpsertInput[],
    today: string
): string[] {
    return reports
        .filter(
            r =>
                r.earningsDate >= today &&
                r.epsActual === null &&
                r.revenueActual === null
        )
        .map(r => r.earningsDate);
}

/**
 * 한 번의 INSERT ... ON CONFLICT에 같은 `(symbol, earningsDate)`가 두 번 들어가면 Postgres가
 * 거부하므로, 키별로 더 최신(`lastUpdated`) · 더 채워진 입력 하나만 남긴다.
 */
export function dedupeEarningsReportInputs(
    reports: EarningsReportUpsertInput[]
): EarningsReportUpsertInput[] {
    const uniqueByKey = new Map<string, EarningsReportUpsertInput>();

    for (const report of reports) {
        const key = toReportKey(report);
        const existing = uniqueByKey.get(key);
        if (
            existing === undefined ||
            shouldReplaceReportInput(existing, report)
        ) {
            uniqueByKey.set(key, report);
        }
    }

    return Array.from(uniqueByKey.values());
}

function toReportKey(report: EarningsReportUpsertInput): string {
    return `${report.symbol}:${report.earningsDate}`;
}

function shouldReplaceReportInput(
    existing: EarningsReportUpsertInput,
    candidate: EarningsReportUpsertInput
): boolean {
    if (candidate.lastUpdated !== existing.lastUpdated) {
        if (candidate.lastUpdated === null) return false;
        if (existing.lastUpdated === null) return true;
        return candidate.lastUpdated > existing.lastUpdated;
    }

    const candidatePopulatedFieldCount = countPopulatedInputFields(candidate);
    const existingPopulatedFieldCount = countPopulatedInputFields(existing);
    if (candidatePopulatedFieldCount !== existingPopulatedFieldCount) {
        return candidatePopulatedFieldCount > existingPopulatedFieldCount;
    }

    return true;
}

function countPopulatedInputFields(report: EarningsReportUpsertInput): number {
    return [
        report.epsActual,
        report.epsEstimated,
        report.revenueActual,
        report.revenueEstimated,
    ].filter(isPresent).length;
}

function isPresent(value: number | null): boolean {
    return value !== null;
}
