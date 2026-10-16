import 'server-only';
import {
    BoundedBodyTooLargeError,
    readBoundedBody,
} from '@/shared/lib/readBoundedBody';
import { withRetry } from '@/shared/lib/withRetry';

/**
 * Reg SHO 과열 목록을 게시하는 시장 5곳. Nasdaq·Cboe는 시장당 파일 하나, NYSE는 같은 API에 `market` 파라미터로 셋.
 * ⚠️ 비상업 전용 데이터 — 호출부는 `isRegShoThresholdDataEnabled()`가 꺼져 있으면 이 모듈을 부르지 않는다.
 */
export const REG_SHO_MARKETS = [
    'nasdaq',
    'nyse',
    'nyse_american',
    'nyse_arca',
    'cboe_bzx',
] as const;
export type RegShoMarket = (typeof REG_SHO_MARKETS)[number];

export const REG_SHO_REQUEST_TIMEOUT_MS = 30_000;
export const REG_SHO_MAX_RETRIES = 1;
export const REG_SHO_RETRY_BASE_DELAY_MS = 1_000;
/** 목록 파일 본문 상한(바이트) — 실측(2026-10-15) 파일은 많아야 수 KB다. 읽기 전·읽는 중에 이 크기로 끊는다(SA-7). */
export const REG_SHO_MAX_BODY_BYTES = 1024 * 1024;

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;
/**
 * S3가 없는 객체에 주는 본문. Cboe CDN은 파일이 없는 날(휴장일·미게시·미래)에 404 대신 이 403을 준다.
 * 재확인: `curl -s -o /dev/null -w '%{http_code}\n' https://cdn.cboe.com/resources/us/equities/market-statistics/reg-sho-threshold/bzx_equities_reg_sho_threshold_20251127.txt`(휴장일 → 403)
 */
const ACCESS_DENIED_MARKER = '<Code>AccessDenied</Code>';
const HTTP_REDIRECT_MIN = 300;
const HTTP_REDIRECT_MAX = 399;
const HTTP_SERVER_ERROR_MIN = 500;

/** NYSE threshold API의 `market` 값(요청 그대로). */
const NYSE_MARKET_PARAM: Record<
    Extract<RegShoMarket, 'nyse' | 'nyse_american' | 'nyse_arca'>,
    string
> = {
    nyse: 'NYSE',
    nyse_american: 'NYSE American',
    nyse_arca: 'NYSE Arca',
};

export class ExchangeHttpError extends Error {
    readonly status: number;

    constructor(url: string, status: number) {
        super(`exchange ${status} ${url}`);
        this.name = 'ExchangeHttpError';
        this.status = status;
    }
}

const compactDate = (isoDate: string): string => isoDate.replaceAll('-', '');

/** 시장·거래일(`YYYY-MM-DD`)의 과열 목록 URL. */
export function regShoThresholdUrl(market: RegShoMarket, date: string): string {
    switch (market) {
        case 'nasdaq':
            return `https://www.nasdaqtrader.com/dynamic/symdir/regsho/nasdaqth${compactDate(date)}.txt`;
        case 'cboe_bzx':
            return `https://cdn.cboe.com/resources/us/equities/market-statistics/reg-sho-threshold/bzx_equities_reg_sho_threshold_${compactDate(date)}.txt`;
        case 'nyse':
        case 'nyse_american':
        case 'nyse_arca':
            return `https://www.nyse.com/api/regulatory/threshold-securities/download?selectedDate=${date}&market=${encodeURIComponent(NYSE_MARKET_PARAM[market])}`;
    }
}

function isTransient(error: unknown): boolean {
    if (error instanceof ExchangeHttpError) {
        return error.status >= HTTP_SERVER_ERROR_MIN;
    }
    return error instanceof TypeError || error instanceof DOMException;
}

/**
 * 본문을 `maxBytes`까지만 읽어 텍스트로 — 상한 처리는 공용 `readBoundedBody`(`Content-Length` 선검사 + 읽는 중 차단)가 하고,
 * 이 클라이언트의 오류 계약(`exchange body too large: <url>`)으로 바꿔 던진다. 이 URL에는 비밀값이 없다.
 */
async function readBoundedText(
    res: Response,
    maxBytes: number,
    url: string
): Promise<string> {
    try {
        return new TextDecoder('utf-8').decode(
            await readBoundedBody(res, maxBytes)
        );
    } catch (error) {
        if (error instanceof BoundedBodyTooLargeError) {
            throw new Error(`exchange body too large: ${url}`);
        }
        throw error;
    }
}

/**
 * 그날 그 시장의 과열 목록 텍스트. 아직 없으면 `null`:
 *  - 404.
 *  - **3xx** — Nasdaq은 게시 전 날짜에 302로 HTML 안내 페이지로 보낸다(2026-10-16 실측). 리다이렉트를 따라가지 않는다.
 *  - **Cboe에 한해** 본문이 S3 `AccessDenied`인 403 — 파일이 없는 날(휴장일 20251127·20251225, 미래 20261230)에 이렇게
 *    오고 있는 날(20261014)은 200이다(2026-10-16 실측). 그 밖의 403(다른 시장, 마커 없는 Cboe 403)은 차단일 수 있어 던진다.
 * NYSE는 미래·미게시 날짜에도 헤더만 있는 200을 주므로 여기서는 "있음"이고, 푸터 날짜 검증은 파서가 한다
 * (`entities/investor-flows/lib/regShoParsers.ts`). 403·429 등 그 밖의 비정상 응답은 `ExchangeHttpError`(차단일 수 있어
 * "없음"으로 오인하지 않는다). 5xx·네트워크 오류만 한 번 재시도한다.
 */
export async function fetchRegShoThresholdText(
    market: RegShoMarket,
    date: string
): Promise<string | null> {
    const url = regShoThresholdUrl(market, date);
    return withRetry(
        async () => {
            const res = await fetch(url, {
                cache: 'no-store',
                redirect: 'manual',
                signal: AbortSignal.timeout(REG_SHO_REQUEST_TIMEOUT_MS),
            });
            if (
                res.status === HTTP_NOT_FOUND ||
                (res.status >= HTTP_REDIRECT_MIN &&
                    res.status <= HTTP_REDIRECT_MAX)
            ) {
                return null;
            }
            if (res.status === HTTP_FORBIDDEN && market === 'cboe_bzx') {
                const body = await res.text().catch(() => '');
                if (body.includes(ACCESS_DENIED_MARKER)) return null;
            }
            if (!res.ok) throw new ExchangeHttpError(url, res.status);
            return readBoundedText(res, REG_SHO_MAX_BODY_BYTES, url);
        },
        {
            maxRetries: REG_SHO_MAX_RETRIES,
            baseDelayMs: REG_SHO_RETRY_BASE_DELAY_MS,
            isRetryable: isTransient,
        }
    );
}
