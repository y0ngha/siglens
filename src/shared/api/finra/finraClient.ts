import 'server-only';
import { withRetry } from '@/shared/lib/withRetry';

const FINRA_CDN_BASE = 'https://cdn.finra.org/equity';
export const FINRA_REQUEST_TIMEOUT_MS = 60_000;
export const FINRA_RETRY_BASE_DELAY_MS = 1_000;
export const FINRA_MAX_RETRIES = 2;
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;

/** CDN(S3)이 없는 객체에 주는 본문 — 404가 아니라 403이 온다. */
const ACCESS_DENIED_MARKER = '<Code>AccessDenied</Code>';

export class FinraHttpError extends Error {
    readonly status: number;

    constructor(url: string, status: number) {
        super(`FINRA ${status} ${url}`);
        this.name = 'FinraHttpError';
        this.status = status;
    }
}

function isTransient(error: unknown): boolean {
    if (error instanceof FinraHttpError) {
        return (
            error.status === HTTP_TOO_MANY_REQUESTS ||
            error.status >= HTTP_SERVER_ERROR_MIN
        );
    }
    return error instanceof TypeError || error instanceof DOMException;
}

/** 파일 텍스트. 아직 없으면(휴장일·미공개) `null`. 그 밖의 비정상 응답은 `FinraHttpError`. */
async function fetchFinraText(url: string): Promise<string | null> {
    return withRetry(
        async () => {
            const res = await fetch(url, {
                cache: 'no-store',
                signal: AbortSignal.timeout(FINRA_REQUEST_TIMEOUT_MS),
            });
            if (res.ok) return res.text();
            if (res.status === HTTP_FORBIDDEN) {
                const body = await res.text().catch(() => '');
                if (body.includes(ACCESS_DENIED_MARKER)) return null;
            } else {
                // 읽지 않은 본문이 재시도·다음 요청 동안 keep-alive 소켓을 붙잡지 않게 놓는다.
                await res.body?.cancel().catch(() => undefined);
            }
            if (res.status === HTTP_NOT_FOUND) return null;
            throw new FinraHttpError(url, res.status);
        },
        {
            maxRetries: FINRA_MAX_RETRIES,
            baseDelayMs: FINRA_RETRY_BASE_DELAY_MS,
            isRetryable: isTransient,
        }
    );
}

const compactDate = (isoDate: string): string => isoDate.replaceAll('-', '');

/** `YYYY-MM-DD`의 Reg SHO 일별 공매도 거래량(CNMS, 장외 TRF 보고분) 파일 URL. */
export function cnmsShortVolumeUrl(tradeDate: string): string {
    return `${FINRA_CDN_BASE}/regsho/daily/CNMSshvol${compactDate(tradeDate)}.txt`;
}

/** `YYYY-MM-DD` 결제일의 공매도 잔고(biweekly) 파일 URL. */
export function shortInterestUrl(settlementDate: string): string {
    return `${FINRA_CDN_BASE}/otcmarket/biweekly/shrt${compactDate(settlementDate)}.csv`;
}

export function fetchCnmsShortVolumeText(
    tradeDate: string
): Promise<string | null> {
    return fetchFinraText(cnmsShortVolumeUrl(tradeDate));
}

export function fetchShortInterestText(
    settlementDate: string
): Promise<string | null> {
    return fetchFinraText(shortInterestUrl(settlementDate));
}
