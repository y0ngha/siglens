import 'server-only';
import {
    SEC_BODY_IDLE_TIMEOUT_MS,
    SEC_HEADER_TIMEOUT_MS,
    SEC_INFO_TABLE_BODY_BUDGET_MS,
    SEC_MAX_INFO_TABLE_BYTES,
    SEC_MAX_RETRIES,
    SEC_MIN_REQUEST_INTERVAL_MS,
    SEC_REQUEST_TIMEOUT_MS,
    SEC_RETRY_AFTER_CAP_MS,
    SEC_RETRY_BACKOFF_BUDGET_MS,
    SEC_SUBMISSIONS_BUDGET_MS,
    SEC_USER_AGENT_DEFAULT,
} from '@/shared/config/investorFlows';
import { sleep } from '@/shared/lib/sleep';
import { withRetry } from '@/shared/lib/withRetry';

const SEC_ARCHIVES_BASE = 'https://www.sec.gov/Archives/edgar';
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;
const SEC_RETRY_BASE_DELAY_MS = 1_000;

/** S3가 없는 객체에 돌려주는 본문. SEC Archives는 없는 daily index에 404가 아니라 이 403을 준다. */
const ACCESS_DENIED_MARKER = '<Code>AccessDenied</Code>';

/**
 * SEC가 요청을 거절했다(속도 제한·차단). 배치는 이 오류를 보면 **더 두드리지 말고 멈춘다** —
 * SEC는 한도를 넘긴 IP를 10분간 막고, 계속 두드리면 더 길어진다. 429는 재시도하지 않는다.
 */
export class SecHttpError extends Error {
    readonly status: number;
    readonly retryAfterSeconds: number | null;

    constructor(url: string, status: number, retryAfterSeconds: number | null) {
        super(`SEC ${status} ${url}`);
        this.name = 'SecHttpError';
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

/** 본문 수신이 멈췄거나(`idle`) 전체 예산을 넘겼다(`budget`). */
export class SecBodyTimeoutError extends Error {
    readonly kind: 'idle' | 'budget';

    constructor(kind: 'idle' | 'budget') {
        super(`SEC body ${kind} timeout`);
        this.name = 'SecBodyTimeoutError';
        this.kind = kind;
    }
}

/** 요청 슬롯 대기가 호출자의 예산을 넘길 것이다(예약하지 않고 즉시 실패). */
export class SecSlotTimeoutError extends Error {
    constructor() {
        super('SEC slot wait exceeds budget');
        this.name = 'SecSlotTimeoutError';
    }
}

function secUserAgent(): string {
    const fromEnv = process.env.SEC_USER_AGENT?.trim();
    return fromEnv ? fromEnv : SEC_USER_AGENT_DEFAULT;
}

/**
 * 프로세스 전역 요청 게이트. 호출 시점에 다음 슬롯을 **동기적으로** 예약하므로 동시 호출자들이
 * 도착 순서대로 `SEC_MIN_REQUEST_INTERVAL_MS` 간격으로 줄을 선다 — 동시성을 몇으로 두든
 * 초당 요청 수는 이 값이 정한다. `maxWaitMs`를 넘길 대기면 예약 없이 `SecSlotTimeoutError`.
 */
let nextSlotAtMs = 0;

async function waitForSlot(maxWaitMs?: number): Promise<void> {
    const now = Date.now();
    const start = Math.max(now, nextSlotAtMs);
    if (maxWaitMs !== undefined && start - now > maxWaitMs) {
        throw new SecSlotTimeoutError();
    }
    nextSlotAtMs = start + SEC_MIN_REQUEST_INTERVAL_MS;
    if (start > now) await sleep(start - now);
}

/** 테스트 격리용 — 게이트를 초기 상태로 되돌린다. */
export function __resetSecThrottleForTests(): void {
    nextSlotAtMs = 0;
}

/** 재시도할 일시 오류: 5xx·네트워크·타임아웃. **429·403은 아니다**(차단 — 두드리지 않는다). */
function isTransient(error: unknown): boolean {
    if (error instanceof SecHttpError) {
        return error.status >= HTTP_SERVER_ERROR_MIN;
    }
    return error instanceof TypeError || error instanceof DOMException;
}

function parseRetryAfter(header: string | null): number | null {
    if (header === null) return null;
    const seconds = Number(header);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/**
 * `withRetry`의 백오프 예산은 **첫 시도 시작부터** 재는데 시도 자신의 시간도 포함한다 — 시도가 타임아웃까지 간 뒤에도
 * 한 번 재시도하려면 예산이 `시도 타임아웃 + 백오프 대기`여야 한다.
 */
const retryOptions = (timeoutMs: number, maxRetries: number) => ({
    maxRetries,
    baseDelayMs: SEC_RETRY_BASE_DELAY_MS,
    backoffBudgetMs: timeoutMs + SEC_RETRY_BACKOFF_BUDGET_MS,
    isRetryable: isTransient,
    getRetryDelayMs: (error: unknown): number | null =>
        error instanceof SecHttpError && error.retryAfterSeconds !== null
            ? Math.min(error.retryAfterSeconds * 1_000, SEC_RETRY_AFTER_CAP_MS)
            : null,
});

/** 응답 상태 분류: 정상은 `true`, 없는 문서(404·S3 AccessDenied 403)는 `false`, 그 밖은 던진다. */
async function acceptStatus(res: Response, url: string): Promise<boolean> {
    if (res.ok) return true;
    if (res.status === HTTP_NOT_FOUND) return false;
    if (res.status === HTTP_FORBIDDEN) {
        const body = await res.text().catch(() => '');
        if (body.includes(ACCESS_DENIED_MARKER)) return false;
    }
    throw new SecHttpError(
        url,
        res.status,
        res.status === HTTP_TOO_MANY_REQUESTS
            ? null
            : parseRetryAfter(res.headers.get('retry-after'))
    );
}

interface DocumentOptions {
    maxRetries: number;
    /** 요청 전체(슬롯 대기 제외 — `slotBudgetMs`가 있으면 슬롯 대기까지 합쳐) 상한. */
    timeoutMs: number;
    /** 있으면 슬롯 대기 + 요청 + 본문 **전체**가 이 안에 끝나야 한다(렌더 경로). */
    totalBudgetMs?: number;
}

const DOCUMENT_OPTIONS: DocumentOptions = {
    maxRetries: SEC_MAX_RETRIES,
    timeoutMs: SEC_REQUEST_TIMEOUT_MS,
};

/**
 * 작은 문서 하나를 받아 `read`로 읽는다. **요청 전체(헤더 + 본문)**가 한 타임아웃 아래에 있다 — 본문 읽기가
 * 멈춰도 끊긴다. 없는 문서는 `null`. 일시 오류만 재시도한다(재시도도 게이트를 지난다).
 */
async function secGetDocument<T>(
    url: string,
    read: (res: Response) => Promise<T>,
    options: DocumentOptions = DOCUMENT_OPTIONS
): Promise<T | null> {
    return withRetry(
        async () => {
            const startedAt = Date.now();
            await waitForSlot(options.totalBudgetMs);
            const timeoutMs =
                options.totalBudgetMs === undefined
                    ? options.timeoutMs
                    : Math.max(
                          options.totalBudgetMs - (Date.now() - startedAt),
                          1
                      );
            // AbortController + clearable timer(= `AbortSignal.timeout`과 같은 효과, 끝나면 타이머를 치운다).
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, {
                    headers: { 'User-Agent': secUserAgent(), Accept: '*/*' },
                    cache: 'no-store',
                    signal: controller.signal,
                });
                if (!(await acceptStatus(res, url))) return null;
                return await read(res);
            } finally {
                clearTimeout(timer);
            }
        },
        retryOptions(options.timeoutMs, options.maxRetries)
    );
}

/** `YYYY-MM-DD` → daily index URL(`.../daily-index/YYYY/QTRn/form.YYYYMMDD.idx`). */
export function dailyFormIndexUrl(date: string): string {
    const [year, month, day] = date.split('-');
    const quarter = Math.ceil(Number(month) / 3);
    return `${SEC_ARCHIVES_BASE}/daily-index/${year}/QTR${quarter}/form.${year}${month}${day}.idx`;
}

/** 제출 폴더 URL — `accession`은 대시 포함(`0001234567-26-000001`), `cik`는 선행 0 무관. */
export function filingFolderUrl(cik: string, accession: string): string {
    return `${SEC_ARCHIVES_BASE}/data/${Number(cik)}/${accession.replaceAll('-', '')}`;
}

/** 그날의 form 형식 daily index 텍스트. 아직 없거나(주말·휴일·미공개) 없는 날이면 `null`. */
export function fetchDailyFormIndex(date: string): Promise<string | null> {
    return secGetDocument(dailyFormIndexUrl(date), res => res.text());
}

/** 제출 폴더의 `index.json`. 없으면 `null`. */
export function fetchFilingIndexJson(
    cik: string,
    accession: string
): Promise<unknown | null> {
    return secGetDocument(
        `${filingFolderUrl(cik, accession)}/index.json`,
        res => res.json() as Promise<unknown>
    );
}

/** 제출 폴더 안 문서 하나의 텍스트(작은 primary_doc.xml용). 없으면 `null`. */
export function fetchFilingDocumentText(
    cik: string,
    accession: string,
    fileName: string
): Promise<string | null> {
    return secGetDocument(
        `${filingFolderUrl(cik, accession)}/${encodeURIComponent(fileName)}`,
        res => res.text()
    );
}

/** 본문 스트림 한도. */
export interface BodyLimits {
    maxBytes: number;
    /** 청크 사이 무소식 상한(ms) — 느려도 바이트가 오가면 통과한다. */
    idleMs: number;
    /** 본문 전체 상한(ms). */
    totalMs: number;
    /** 타임아웃으로 끊을 때 원 요청도 중단한다. */
    onAbort?: () => void;
}

const INFO_TABLE_LIMITS: Omit<BodyLimits, 'onAbort'> = {
    maxBytes: SEC_MAX_INFO_TABLE_BYTES,
    idleMs: SEC_BODY_IDLE_TIMEOUT_MS,
    totalMs: SEC_INFO_TABLE_BODY_BUDGET_MS,
};

function readWithTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    ms: number,
    kind: 'idle' | 'budget'
): Promise<ReadableStreamReadResult<Uint8Array>> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new SecBodyTimeoutError(kind)),
            ms
        );
        reader.read().then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

/**
 * 본문을 청크 단위로 흘리며 세 가지를 지킨다: ① 누적 바이트 `maxBytes` ② 청크 사이 정체 `idleMs`
 * ③ 본문 전체 `totalMs`. 정체·예산 초과면 `SecBodyTimeoutError`로 끊고 `onAbort`로 원 요청도 중단한다.
 * 고정 전체 타임아웃과 달리 **느리지만 진행 중인** 대용량 본문은 끝까지 받는다.
 */
export async function* streamWithLimits(
    body: ReadableStream<Uint8Array>,
    limits: BodyLimits
): AsyncGenerator<Uint8Array> {
    const reader = body.getReader();
    const startedAt = Date.now();
    let received = 0;
    try {
        for (;;) {
            const remaining = limits.totalMs - (Date.now() - startedAt);
            if (remaining <= 0) throw new SecBodyTimeoutError('budget');
            const useIdle = limits.idleMs <= remaining;
            // 청크는 순서대로 하나씩 읽는다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const { done, value } = await readWithTimeout(
                reader,
                useIdle ? limits.idleMs : remaining,
                useIdle ? 'idle' : 'budget'
            );
            if (done) return;
            received += value.byteLength;
            if (received > limits.maxBytes) {
                throw new Error(
                    `SEC document exceeds ${limits.maxBytes} bytes`
                );
            }
            yield value;
        }
    } catch (error) {
        limits.onAbort?.();
        throw error;
    } finally {
        reader.cancel().catch(() => undefined);
    }
}

/**
 * 제출 폴더 안 큰 문서(information table)를 청크 단위로 흘려 준다. **헤더까지만** `SEC_HEADER_TIMEOUT_MS`,
 * 본문은 `INFO_TABLE_LIMITS`(정체·전체·200MB). 없으면 `null`. 헤더 단계의 일시 오류는 재시도한다.
 */
export async function fetchFilingDocumentStream(
    cik: string,
    accession: string,
    fileName: string
): Promise<AsyncIterable<Uint8Array> | null> {
    const url = `${filingFolderUrl(cik, accession)}/${encodeURIComponent(fileName)}`;
    const opened = await withRetry(
        async () => {
            await waitForSlot();
            const controller = new AbortController();
            const headerTimer = setTimeout(
                () => controller.abort(),
                SEC_HEADER_TIMEOUT_MS
            );
            try {
                const res = await fetch(url, {
                    headers: { 'User-Agent': secUserAgent(), Accept: '*/*' },
                    cache: 'no-store',
                    signal: controller.signal,
                });
                if (!(await acceptStatus(res, url))) return null;
                return { res, controller };
            } finally {
                // 헤더가 왔으면 헤더 타임아웃은 역할을 다했다 — 본문은 아래 한도가 지킨다.
                clearTimeout(headerTimer);
            }
        },
        retryOptions(SEC_HEADER_TIMEOUT_MS, SEC_MAX_RETRIES)
    );
    if (opened === null || opened.res.body === null) return null;
    return streamWithLimits(opened.res.body, {
        ...INFO_TABLE_LIMITS,
        onAbort: () => opened.controller.abort(),
    });
}

/** `CIK##########.json` — 제출 목록 파일명(CIK는 10자리 0 패딩). */
export function submissionsFileName(cik: string): string {
    return `CIK${cik.replace(/\D/g, '').padStart(10, '0')}.json`;
}

/**
 * `data.sec.gov/submissions/<fileName>` — 회사의 제출 목록(`filings.recent`)이나 그 보조 파일
 * (`filings.files[].name`). 같은 전역 게이트·User-Agent를 쓴다. 없으면 `null`.
 *
 * 렌더 경로에서 불리므로 **슬롯 대기 + 요청 + 본문 전체**가 `SEC_SUBMISSIONS_BUDGET_MS` 안이다(재시도 없음,
 * SERVER.md#SA-14). 넘으면 `SecSlotTimeoutError`/`DOMException`으로 던지고 호출부가 degrade한다.
 */
export function fetchSubmissionsJson(
    fileName: string
): Promise<unknown | null> {
    return secGetDocument(
        `https://data.sec.gov/submissions/${fileName}`,
        res => res.json() as Promise<unknown>,
        {
            maxRetries: 0,
            timeoutMs: SEC_SUBMISSIONS_BUDGET_MS,
            totalBudgetMs: SEC_SUBMISSIONS_BUDGET_MS,
        }
    );
}
