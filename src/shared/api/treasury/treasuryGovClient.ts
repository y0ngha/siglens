import 'server-only';
import type { TreasuryRateSnapshot } from '@y0ngha/siglens-core';
import { readBoundedBody } from '@/shared/lib/readBoundedBody';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { isRenderBudgetActive } from '@/shared/lib/renderBudget';
import {
    assertOnline,
    isBuildPhase,
    OFFLINE_BUILD_SERVICE,
} from '@/shared/api/offlineBuild';

/**
 * 미 재무부 공식 일간 국채 수익률(Daily Treasury Par Yield Curve) CSV.
 *
 * FMP `treasury-rates`는 재무부 공표보다 이틀 늦게 행이 붙는다(2026-10-23 실측: 재무부는
 * 10/22 4.96%까지 있는데 FMP 최신 행은 10/20 5.12%). 그 값이 SiglensAI `get_economy`에서
 * "가장 최근 10년물"로 나갔다. 재무부는 같은 날 저녁(ET)에 공표하므로 이쪽을 우선한다.
 * 재확인: `curl -s 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv' | head -2`
 *
 * 재시도는 하지 않는다. 실패하면 호출부(`OfficialTreasuryEconomyProvider`)가 FMP 값으로 답하므로, 재시도로
 * 기다리는 것보다 빨리 물러나는 편이 낫다. 대기 상한은 시도당 제한뿐이다(1월 순차 두 번이면 그 두 배).
 */

/** 시도 1회 제한. 응답은 실측 1초 안팎이다. */
export const TREASURY_GOV_REQUEST_TIMEOUT_MS = 5_000;
/** 렌더 예산(`runWithRenderBudget`)·`next build` 중에는 더 짧게 시도한다. FMP 렌더 예산과 같은 원칙이다(SA-14). */
export const TREASURY_GOV_RENDER_TIMEOUT_MS = 3_000;
/** 한 해 CSV는 실측(2026-10-23) 약 16KB다. 그 60배를 상한으로 둔다(SA-7). */
export const TREASURY_GOV_MAX_BODY_BYTES = 1024 * 1024;

const COLUMN_DATE = 'Date';
const COLUMN_2Y = '2 Yr';
const COLUMN_10Y = '10 Yr';
const ET_TIME_ZONE = 'America/New_York';
const JANUARY = '01';
const HTTP_NOT_FOUND = 404;

export class TreasuryGovHttpError extends Error {
    readonly status: number;

    constructor(status: number) {
        super(`treasury.gov ${status}`);
        this.name = 'TreasuryGovHttpError';
        this.status = status;
    }
}

export class TreasuryGovNotCsvError extends Error {
    constructor() {
        super('treasury.gov returned a non-CSV body');
        this.name = 'TreasuryGovNotCsvError';
    }
}

/** 그 해(`YYYY`)의 일간 수익률 CSV URL. 비밀값이 없다. */
export function treasuryGovCsvUrl(year: number): string {
    return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
}

const unquote = (cell: string): string => cell.trim().replace(/^"|"$/g, '');

function yieldOrNull(cell: string | undefined): number | null {
    if (cell === undefined || unquote(cell) === '') return null;
    const v = Number(unquote(cell));
    return Number.isFinite(v) ? v : null;
}

/** `MM/DD/YYYY` → `YYYY-MM-DD`. 형식이 다르면 `null`. */
function isoDate(cell: string): string | null {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(unquote(cell));
    return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

/**
 * CSV에서 가장 최근 날짜 행의 2년·10년물을 뽑는다. 열은 이름으로 찾는다(만기 열이 늘어도
 * 위치가 바뀌어도 맞게). 행 순서는 믿지 않고 날짜로 가장 최근 행을 고른다. 10년물이 빈 행은
 * 건너뛴다. 쓸 행이 없으면 `null`.
 */
export function parseTreasuryGovCsv(csv: string): TreasuryRateSnapshot | null {
    const [header, ...lines] = csv.trim().split(/\r?\n/);
    if (header === undefined) return null;
    const cols = header.split(',').map(unquote);
    const iDate = cols.indexOf(COLUMN_DATE);
    const i2 = cols.indexOf(COLUMN_2Y);
    const i10 = cols.indexOf(COLUMN_10Y);
    if (iDate < 0 || i10 < 0) return null;
    const rows = lines.flatMap((line): TreasuryRateSnapshot[] => {
        const cells = line.split(',');
        const date = isoDate(cells[iDate] ?? '');
        const year10 = yieldOrNull(cells[i10]);
        if (date === null || year10 === null) return [];
        return [
            { date, year2: i2 < 0 ? null : yieldOrNull(cells[i2]), year10 },
        ];
    });
    return rows.reduce<TreasuryRateSnapshot | null>(
        (latest, row) =>
            latest === null || row.date > latest.date ? row : latest,
        null
    );
}

async function fetchYearCsv(year: number): Promise<string> {
    assertOnline(OFFLINE_BUILD_SERVICE.TREASURY, 'treasury.gov');
    const attemptMs =
        isRenderBudgetActive() || isBuildPhase()
            ? TREASURY_GOV_RENDER_TIMEOUT_MS
            : TREASURY_GOV_REQUEST_TIMEOUT_MS;
    const res = await fetch(treasuryGovCsvUrl(year), {
        cache: 'no-store',
        signal: AbortSignal.timeout(attemptMs),
    });
    if (!res.ok) {
        // 읽지 않은 본문이 keep-alive 소켓을 붙잡지 않게 놓는다.
        await res.body?.cancel().catch(() => undefined);
        throw new TreasuryGovHttpError(res.status);
    }
    // 200이어도 CSV가 아니면(점검·차단 안내 HTML) 오류다 — "아직 공표 전"으로 읽어 1월 전년도 폴백이
    // 작년 값을 공식값으로 내지 않게 한다.
    if (!(res.headers.get('content-type') ?? '').includes('csv')) {
        await res.body?.cancel().catch(() => undefined);
        throw new TreasuryGovNotCsvError();
    }
    // 상한 초과는 `BoundedBodyTooLargeError` 그대로 올린다(메시지에 URL이 없고, 이름으로 원인이 남는다).
    return new TextDecoder('utf-8').decode(
        await readBoundedBody(res, TREASURY_GOV_MAX_BODY_BYTES)
    );
}

/** 그해 CSV의 최신 행. 연초에는 아직 행이 없거나(헤더만) 404일 수 있다 — `allowMissing`이면 둘 다 `null`. */
async function latestOfYear(
    year: number,
    allowMissing: boolean
): Promise<TreasuryRateSnapshot | null> {
    try {
        return parseTreasuryGovCsv(await fetchYearCsv(year));
    } catch (error) {
        if (
            allowMissing &&
            error instanceof TreasuryGovHttpError &&
            error.status === HTTP_NOT_FOUND
        ) {
            return null;
        }
        throw error;
    }
}

/**
 * 가장 최근 공표 행. 연도·월은 ET 날짜로 정한다(국채 캐시 키와 같은 `zonedDate`). 1월에 한해, 올해 CSV에
 * 행이 없으면(첫 공표 전) 전년도 CSV를 본다 — 다른 달에 올해 행이 없으면 형식이 바뀐 것이라 전년도 값으로
 * 가리지 않는다. HTTP·네트워크 오류와 시간 초과는 던진다 — 호출부가 FMP 값으로 물러난다.
 */
export async function fetchTreasuryGovSnapshot(
    now: Date
): Promise<TreasuryRateSnapshot | null> {
    const [yyyy, mm] = zonedDate(now, ET_TIME_ZONE).split('-');
    const year = Number(yyyy);
    const january = mm === JANUARY;
    const snapshot =
        (await latestOfYear(year, january)) ??
        (january ? await latestOfYear(year - 1, false) : null);
    if (snapshot !== null && snapshot.year2 === null) {
        // 10년물은 있는데 2년물이 비었다 — 열 이름이 바뀌면 장단기 스프레드가 조용히 사라진다.
        console.warn('[economy] treasury.gov row has no 2Y yield');
    }
    return snapshot;
}
