import 'server-only';
import type { TreasuryRateSnapshot } from '@y0ngha/siglens-core';
import {
    BoundedBodyTooLargeError,
    readBoundedBody,
} from '@/shared/lib/readBoundedBody';
import { withRetry } from '@/shared/lib/withRetry';
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
 */
export const TREASURY_GOV_REQUEST_TIMEOUT_MS = 15_000;
/**
 * 페이지 렌더(`runWithRenderBudget`)·`next build` 중에는 한 번만, 짧게 시도한다. /economy 스냅샷은
 * FMP와 이 값을 함께 기다리므로(`Promise.allSettled`) 여기가 느리면 렌더 시간이 그만큼 늘고,
 * prerender 제한(60초)에 닿을 수 있다. FMP의 렌더 예산(`fmpGet`)과 같은 원칙이다(SA-14).
 */
export const TREASURY_GOV_RENDER_TIMEOUT_MS = 3_000;
export const TREASURY_GOV_MAX_RETRIES = 1;
export const TREASURY_GOV_RETRY_BASE_DELAY_MS = 1_000;
/** 한 해 CSV는 실측(2026-10-23) 약 16KB다. 그 60배를 상한으로 둔다(SA-7). */
export const TREASURY_GOV_MAX_BODY_BYTES = 1024 * 1024;

const HTTP_SERVER_ERROR_MIN = 500;
const COLUMN_DATE = 'Date';
const COLUMN_2Y = '2 Yr';
const COLUMN_10Y = '10 Yr';

export class TreasuryGovHttpError extends Error {
    readonly status: number;

    constructor(status: number) {
        super(`treasury.gov ${status}`);
        this.name = 'TreasuryGovHttpError';
        this.status = status;
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
    let best: TreasuryRateSnapshot | null = null;
    for (const line of lines) {
        const cells = line.split(',');
        const date = isoDate(cells[iDate] ?? '');
        const year10 = yieldOrNull(cells[i10]);
        if (date === null || year10 === null) continue;
        if (best === null || date > best.date) {
            best = {
                date,
                year2: i2 < 0 ? null : yieldOrNull(cells[i2]),
                year10,
            };
        }
    }
    return best;
}

function isTransient(error: unknown): boolean {
    if (error instanceof TreasuryGovHttpError) {
        return error.status >= HTTP_SERVER_ERROR_MIN;
    }
    return error instanceof TypeError || error instanceof DOMException;
}

async function fetchYearCsv(year: number): Promise<string> {
    const url = treasuryGovCsvUrl(year);
    assertOnline(OFFLINE_BUILD_SERVICE.TREASURY, 'treasury.gov');
    const constrained = isRenderBudgetActive() || isBuildPhase();
    const timeoutMs = constrained
        ? TREASURY_GOV_RENDER_TIMEOUT_MS
        : TREASURY_GOV_REQUEST_TIMEOUT_MS;
    return withRetry(
        async () => {
            const res = await fetch(url, {
                cache: 'no-store',
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!res.ok) throw new TreasuryGovHttpError(res.status);
            try {
                return new TextDecoder('utf-8').decode(
                    await readBoundedBody(res, TREASURY_GOV_MAX_BODY_BYTES)
                );
            } catch (error) {
                if (error instanceof BoundedBodyTooLargeError) {
                    throw new Error('treasury.gov body too large');
                }
                throw error;
            }
        },
        {
            maxRetries: constrained ? 0 : TREASURY_GOV_MAX_RETRIES,
            baseDelayMs: TREASURY_GOV_RETRY_BASE_DELAY_MS,
            isRetryable: isTransient,
        }
    );
}

/**
 * 가장 최근 공표 행. `year`(ET 기준 올해)의 CSV에 행이 없으면(연초 첫 공표 전) 전년도 CSV를 본다.
 * HTTP·네트워크 오류는 던진다 — 호출부가 FMP 값으로 물러난다.
 */
export async function fetchTreasuryGovSnapshot(
    year: number
): Promise<TreasuryRateSnapshot | null> {
    return (
        parseTreasuryGovCsv(await fetchYearCsv(year)) ??
        parseTreasuryGovCsv(await fetchYearCsv(year - 1))
    );
}
