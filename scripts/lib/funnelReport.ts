import type { FunnelKeyEventCount } from '@/entities/funnel/types';
import { RETENTION_WINDOWS } from '@/entities/funnel/retentionWindows';
import { MS_PER_DAY } from '@/shared/config/time';
import { kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';

/** 보고 구간 — KST `YYYY-MM-DD`, 양끝 포함. */
export interface ReportRange {
    from: string;
    to: string;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const USAGE = 'usage: yarn funnel:report --from YYYY-MM-DD --to YYYY-MM-DD';

function readFlag(argv: readonly string[], flag: string): string | undefined {
    const index = argv.indexOf(flag);
    if (index === -1) return undefined;
    const value = argv[index + 1];
    return value === undefined || value.startsWith('--') ? undefined : value;
}

export function parseReportArgs(argv: readonly string[]): ReportRange {
    const from = readFlag(argv, '--from');
    const to = readFlag(argv, '--to');
    if (
        from === undefined ||
        to === undefined ||
        !DATE_KEY_RE.test(from) ||
        !DATE_KEY_RE.test(to) ||
        from > to
    ) {
        throw new Error(USAGE);
    }
    return { from, to };
}

/** `[from 00:00 KST, to 다음날 00:00 KST)` — DB의 timestamptz 비교 경계. */
export function kstRangeBounds(range: ReportRange): {
    from: Date;
    toExclusive: Date;
} {
    const from = new Date(`${range.from}T00:00:00+09:00`);
    const toStart = new Date(`${range.to}T00:00:00+09:00`);
    return { from, toExclusive: new Date(toStart.getTime() + MS_PER_DAY) };
}

export interface GateTableRow {
    key: string;
    /** 잠긴 요소를 눌렀다(`gate_clicked`). */
    gateClicks: number;
    /** 모달을 봤다(`nudge_shown`). */
    shown: number;
    /** 모달의 주 CTA를 눌렀다(`nudge_clicked`). */
    ctaClicks: number;
    /** 이 키를 `lastGate`로 가진 가입. */
    signups: number;
}

type GateCountColumn = 'gateClicks' | 'shown' | 'ctaClicks' | 'signups';

/** 표에 오르는 이벤트와 그 열. 여기 없는 이벤트는 행만 만들고 건수는 세지 않는다. */
const GATE_TABLE_COLUMN_BY_EVENT: ReadonlyMap<string, GateCountColumn> =
    new Map([
        ['gate_clicked', 'gateClicks'],
        ['nudge_shown', 'shown'],
        ['nudge_clicked', 'ctaClicks'],
        ['signup_completed', 'signups'],
    ]);

function emptyGateRow(key: string): GateTableRow {
    return { key, gateClicks: 0, shown: 0, ctaClicks: 0, signups: 0 };
}

/**
 * (키, 이벤트) 건수를 키 한 줄로 접는다. 같은 키(예: `reasoning_toggle`)가 게이트로도
 * 넛지로도 쓰이므로 `gate_clicked`와 `nudge_clicked`는 **다른 열**이다.
 * 키가 없는 이벤트(관심종목·리포트)는 이 표 밖이다.
 */
export function buildGateTable(
    rows: readonly FunnelKeyEventCount[]
): GateTableRow[] {
    const byKey = rows.reduce((acc, { key, event, count }) => {
        if (key === null) return acc;
        const column = GATE_TABLE_COLUMN_BY_EVENT.get(event);
        const row = acc.get(key) ?? emptyGateRow(key);
        return new Map(acc).set(
            key,
            column === undefined
                ? row
                : { ...row, [column]: row[column] + count }
        );
    }, new Map<string, GateTableRow>());
    return [...byKey.values()].sort(
        (a, b) =>
            b.shown - a.shown ||
            b.gateClicks - a.gateClicks ||
            a.key.localeCompare(b.key)
    );
}

export function formatRate(numerator: number, denominator: number): string {
    if (denominator === 0) return '-';
    return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** 고정폭 표. 숫자 포맷은 호출부가 한다 — 여기는 문자열만 정렬한다. */
export function renderTable(
    headers: readonly string[],
    rows: readonly (readonly string[])[]
): string {
    if (rows.length === 0) return `${headers.join('  ')}\n(행 없음)`;
    const widths = headers.map((header, column) =>
        Math.max(header.length, ...rows.map(row => row[column]?.length ?? 0))
    );
    const line = (cells: readonly string[]): string =>
        cells
            .map((cell, column) => cell.padEnd(widths[column]))
            .join('  ')
            .trimEnd();
    return [line(headers), ...rows.map(line)].join('\n');
}

/** 한 주 코호트의 가장 늦은 가입일은 주 시작 + 6일이다. */
const WEEK_LAST_DAY_OFFSET = 6;

/**
 * 코호트 주의 D7·D30이 확정됐는지. 그 주의 **마지막 가입자**의 창이 어제까지 닫혀야
 * (`창 끝 < 오늘`, 모두 KST 날짜) 확정이다 — 덜 닫힌 창은 재방문율이 낮게 보인다.
 */
export function cohortMaturity(
    weekStartKst: string,
    todayKst: string
): { d7: boolean; d30: boolean } {
    const weekEnd = kstDateKeyDaysBefore(weekStartKst, -WEEK_LAST_DAY_OFFSET);
    return {
        d7:
            kstDateKeyDaysBefore(weekEnd, -RETENTION_WINDOWS.d7.endDay) <
            todayKst,
        d30:
            kstDateKeyDaysBefore(weekEnd, -RETENTION_WINDOWS.d30.endDay) <
            todayKst,
    };
}
