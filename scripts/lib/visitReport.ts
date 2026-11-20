import { GUEST_RETURN_WINDOWS } from '@/entities/visitor/lib/visitHistory';
import type {
    EntrySourceSiteTally,
    ReturnWindowRow,
    VisitDaysTally,
} from '@/entities/visitor/types';
import { kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';
import { formatRate, type ReportRange } from './funnelReport';

/** 아직 창이 닫히지 않아 비율을 낼 수 없다. `funnel-report.ts`의 같은 이름과 같은 문구다. */
export const UNSETTLED = '미확정';

/** 출처 없음(직접 방문·같은 사이트 이동·도입 전 행). */
export const NO_SOURCE_LABEL = '(없음)';
/** 사이트를 모르는 행(도입 전 행, Referer 없음). */
export const UNKNOWN_SITE_LABEL = '(미상)';

/** 출처 × 사이트 표의 한 줄 — 첫 진입 출처별 방문 행 수와 재방문 비율. */
export interface EntrySourcePivotRow {
    readonly source: string;
    readonly main: number;
    readonly ai: number;
    readonly unknown: number;
    readonly total: number;
    /** `재방문 / (새 방문 + 재방문)`. 구간값이 있는 행만 분모에 든다. 분모가 0이면 `-`. */
    readonly returningShare: string;
}

interface PivotAccumulator {
    main: number;
    ai: number;
    unknown: number;
    newVisitors: number;
    returning: number;
}

function emptyAccumulator(): PivotAccumulator {
    return { main: 0, ai: 0, unknown: 0, newVisitors: 0, returning: 0 };
}

function addToSite(
    acc: PivotAccumulator,
    site: string | null,
    count: number
): PivotAccumulator {
    if (site === 'main') return { ...acc, main: acc.main + count };
    if (site === 'ai') return { ...acc, ai: acc.ai + count };
    return { ...acc, unknown: acc.unknown + count };
}

/**
 * (사이트, 출처) 칸을 출처 한 줄로 접는다. 열은 `main`·`ai`·`(미상)`·합계·재방문 비율이고 합계가 큰
 * 출처가 먼저, 같으면 이름순이다. 출처 없음은 `(없음)` 줄로 모은다.
 */
export function pivotEntrySources(
    rows: readonly EntrySourceSiteTally[]
): EntrySourcePivotRow[] {
    const bySource = rows.reduce((acc, row) => {
        const source = row.entrySource ?? NO_SOURCE_LABEL;
        const current = acc.get(source) ?? emptyAccumulator();
        return new Map(acc).set(source, {
            ...addToSite(current, row.site, row.count),
            newVisitors: current.newVisitors + row.newVisitors,
            returning: current.returning + row.returning,
        });
    }, new Map<string, PivotAccumulator>());
    return [...bySource.entries()]
        .map(([source, acc]) => ({
            source,
            main: acc.main,
            ai: acc.ai,
            unknown: acc.unknown,
            total: acc.main + acc.ai + acc.unknown,
            returningShare: formatRate(
                acc.returning,
                acc.newVisitors + acc.returning
            ),
        }))
        .sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));
}

/** 방문 날 수 분포의 한 줄 — 사이트별 구간 건수와 `n1`(하루만 온 브라우저) 비중. */
export interface VisitDaysRow {
    readonly site: string;
    readonly buckets: ReadonlyMap<string, number>;
    readonly total: number;
    readonly n1Share: string;
}

/** (사이트, 구간) 건수를 사이트 한 줄로 접는다. 사이트 이름순, 미상이 마지막이다. */
export function pivotVisitDays(
    rows: readonly VisitDaysTally[]
): VisitDaysRow[] {
    const bySite = rows.reduce((acc, { site, bucket, count }) => {
        const label = site ?? UNKNOWN_SITE_LABEL;
        const buckets = new Map(acc.get(label) ?? []);
        return new Map(acc).set(
            label,
            buckets.set(bucket, (buckets.get(bucket) ?? 0) + count)
        );
    }, new Map<string, Map<string, number>>());
    return [...bySite.entries()]
        .map(([site, buckets]) => {
            const total = [...buckets.values()].reduce((sum, v) => sum + v, 0);
            return {
                site,
                buckets,
                total,
                n1Share: formatRate(buckets.get('n1') ?? 0, total),
            };
        })
        .sort(
            (a, b) =>
                Number(a.site === UNKNOWN_SITE_LABEL) -
                    Number(b.site === UNKNOWN_SITE_LABEL) ||
                a.site.localeCompare(b.site)
        );
}

/** 사이트별 브라우저 재방문 표의 한 줄. 숫자 칸은 문자열이다(`미확정` 포함). */
export interface ReturnRateRow {
    readonly site: string;
    readonly newVisitors: string;
    readonly d1: string;
    readonly d1Rate: string;
    readonly d7: string;
    readonly d7Rate: string;
    readonly d30: string;
    readonly d30Rate: string;
}

/**
 * 창이 닫혔는가 — 구간의 **마지막** 첫 방문자의 창 끝(`to + endDay`)이 어제까지 지나야 한다
 * (`창 끝 < 오늘`, 모두 KST 날짜). 덜 닫힌 창은 재방문율이 낮게 보인다.
 */
function isSettled(
    to: string,
    window: { endDay: number },
    todayKst: string
): boolean {
    return kstDateKeyDaysBefore(to, -window.endDay) < todayKst;
}

/**
 * `returnWindowCounts` 행을 사이트별 D1·D7·D30 건수와 비율로 바꾼다. 비율은 `건수 / 새 방문`이고 창이
 * 아직 닫히지 않았으면 건수와 비율 모두 `미확정`이다. D1은 정확하고 D7·D30은 코호트 경계 ±3일의
 * 추정치다(`DrizzleVisitorRepository.returnWindowCounts`).
 */
export function returnRateRows(
    rows: readonly ReturnWindowRow[],
    range: ReportRange,
    todayKst: string
): ReturnRateRow[] {
    const { d1, d7, d30 } = GUEST_RETURN_WINDOWS;
    const settled = {
        d1: isSettled(range.to, d1, todayKst),
        d7: isSettled(range.to, d7, todayKst),
        d30: isSettled(range.to, d30, todayKst),
    };
    const cell = (ok: boolean, hits: number, base: number): [string, string] =>
        ok
            ? [hits.toLocaleString('ko-KR'), formatRate(hits, base)]
            : [UNSETTLED, UNSETTLED];
    return rows.map(row => {
        const [d1Count, d1Rate] = cell(settled.d1, row.d1, row.newVisitors);
        const [d7Count, d7Rate] = cell(settled.d7, row.d7, row.newVisitors);
        const [d30Count, d30Rate] = cell(settled.d30, row.d30, row.newVisitors);
        return {
            site: row.site ?? UNKNOWN_SITE_LABEL,
            newVisitors: row.newVisitors.toLocaleString('ko-KR'),
            d1: d1Count,
            d1Rate,
            d7: d7Count,
            d7Rate,
            d30: d30Count,
            d30Rate,
        };
    });
}
