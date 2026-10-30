import 'server-only';
import { readBoundedBody } from '@/shared/lib/readBoundedBody';
import { sleep } from '@/shared/lib/sleep';
import { withRetry } from '@/shared/lib/withRetry';
import {
    openQuotaBreaker,
    reserveCall,
    resetDartQuotaGuardForTests,
} from './dartQuotaGuard';

/**
 * 금융감독원 OpenDART 클라이언트 — 지분공시(`list.json`·`majorstock.json`·`elestock.json`)와 고유번호(`corpCode.xml`).
 * 개발가이드: https://opendart.fss.or.kr/guide/main.do (2026-10-16 확인).
 *
 * - **키**: `DART_API_KEY`(서버 전용, `crtfc_key` 쿼리 파라미터). 비어 있으면 `isDartEnabled()`가 거짓이고 호출부는 이
 *   모듈의 요청 함수를 부르지 않는다 — 불러도 HTTP 없이 `DartDisabledError`다. 키 없음은 프로세스당 한 번만 남긴다.
 * - **키를 로그에 남기지 않는다**: 요청 URL에 키가 들어가므로 이 모듈의 오류 메시지는 URL 대신 엔드포인트 이름만 담고,
 *   fetch가 던진 원 오류(메시지·`cause`)는 감싸서 버린다.
 * - **할당량**: 하루 약 2만 건(`020`). 실제 호출마다 Redis 일일 카운터(KST 날짜 키)를 올리고, 80%에 한 번 경고한다.
 *   `020`을 받으면 Redis 회로 차단 키를 **다음 KST 자정까지** 세워 그날 남은 호출을 HTTP 없이 막는다(인스턴스 공유).
 *   카운터가 `DART_DAILY_CALL_BUDGET`에 닿아도 같은 오류로 스스로 멈춘다 — 카운터는 Redis 장애 동안 덜 셀 수 있어
 *   DART 상한보다 낮게 잡는다.
 */

export const DART_API_BASE_URL = 'https://opendart.fss.or.kr/api';

/** JSON 엔드포인트 요청 하나(헤더 + 본문)의 상한. */
export const DART_REQUEST_TIMEOUT_MS = 30_000;
/** `corpCode.xml` zip 요청 하나의 상한 — 실측 크기는 ≈1.5MB지만 느린 구간을 넉넉히 받는다. */
export const DART_CORP_CODE_TIMEOUT_MS = 60_000;
export const DART_MAX_RETRIES = 1;
export const DART_RETRY_BASE_DELAY_MS = 1_000;
/**
 * 같은 프로세스 안 DART 요청 시작 사이의 최소 간격(ms) — 초당 ≈10건 아래. DART는 초당 한도를 문서화하지 않지만 짧은 시간에
 * 몰아치면 IP 차단을 겪는다는 보고가 있어 속도를 묶는다. 인스턴스 사이의 합산은 cron 공유 락(`dart`)이 한 번에 한 실행으로 묶는다.
 */
export const DART_MIN_REQUEST_INTERVAL_MS = 100;
/** JSON 본문 상한 — 이력이 긴 대기업(`elestock` 수천 행)도 수 MB다. 넘으면 형식이 바뀐 것으로 본다. */
export const DART_MAX_JSON_BYTES = 32 * 1024 * 1024;
/** `corpCode.xml` zip 상한(실측 ≈1.5MB). */
export const DART_MAX_ZIP_BYTES = 32 * 1024 * 1024;
/** `list.json`이 허용하는 페이지당 최대 건수. */
export const DART_LIST_PAGE_COUNT = 100;

const STATUS_OK = '000';
const STATUS_NO_DATA = '013';
const STATUS_QUOTA_EXCEEDED = '020';
const STATUS_IP_NOT_ALLOWED = '012';
/** 등록되지 않은 키 · 사용할 수 없는 키 · 개인정보 보유기간 만료 키. */
const AUTH_FAILURE_STATUSES: ReadonlySet<string> = new Set([
    '010',
    '011',
    '901',
]);
const STATUS_MAINTENANCE = '800';

const HTTP_SERVER_ERROR_MIN = 500;
/** zip 파일 서명(`PK\x03\x04`). `corpCode.xml`은 오류일 때 zip이 아니라 상태 XML을 준다. */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

export type DartEndpoint =
    | 'corpCode.xml'
    | 'list.json'
    | 'majorstock.json'
    | 'elestock.json'
    | 'alotMatter.json';

/** `list.json` 지분공시 상세 유형 — D001 대량보유, D002 임원·주요주주 소유, D005 임원·주요주주 거래계획. */
export type DartDisclosureDetailType = 'D001' | 'D002' | 'D005';

export interface DartListQuery {
    /** 검색 시작 접수일 `YYYY-MM-DD`(요청은 `YYYYMMDD`). */
    beginDate: string;
    endDate: string;
    detailType: DartDisclosureDetailType;
    pageNo: number;
}

/** DART 응답의 행 하나 — 필드 검증은 파서(`entities/investor-flows/lib/dartParsers.ts`)가 한다. */
export type DartRecord = Readonly<Record<string, unknown>>;

export interface DartListPage {
    pageNo: number;
    totalPage: number;
    totalCount: number;
    rows: DartRecord[];
}

/** 수집기가 주입받는 DART 접근 면. 실 구현(`realDartClient`)과 E2E·테스트용 가짜(`fakeDartClient.ts`)가 같은 모양이다. */
export interface DartClient {
    isEnabled(): boolean;
    fetchCorpCodeZip(): Promise<Uint8Array>;
    fetchDisclosureList(query: DartListQuery): Promise<DartListPage>;
    fetchMajorStock(corpCode: string): Promise<DartRecord[]>;
    fetchExecutiveStock(corpCode: string): Promise<DartRecord[]>;
}

/** DART 요청 실패. 메시지에는 엔드포인트·상태만 담는다(URL·키 없음). */
export class DartApiError extends Error {
    readonly endpoint: DartEndpoint;
    /** DART 상태 코드(`020` 등). HTTP·네트워크 오류면 null. */
    readonly dartStatus: string | null;
    /** HTTP 상태. DART 상태 오류·네트워크 오류면 null. */
    readonly httpStatus: number | null;

    constructor(
        endpoint: DartEndpoint,
        message: string,
        detail: { dartStatus?: string; httpStatus?: number } = {}
    ) {
        super(`DART ${endpoint}: ${message}`);
        this.name = 'DartApiError';
        this.endpoint = endpoint;
        this.dartStatus = detail.dartStatus ?? null;
        this.httpStatus = detail.httpStatus ?? null;
    }
}

/** 하루 할당량 소진(`020`, 또는 일일 카운터가 자체 예산에 닿음) — 다음 KST 자정까지 HTTP 없이 막힌다. */
export class DartQuotaError extends DartApiError {
    constructor(endpoint: DartEndpoint, message: string) {
        super(endpoint, message, { dartStatus: STATUS_QUOTA_EXCEEDED });
        this.name = 'DartQuotaError';
    }
}

/** 허용되지 않은 IP(`012`) — 키 설정에 IP 제한이 걸려 있다. 키 관리 화면에서 IP 제한을 풀어야 한다. */
export class DartIpNotAllowedError extends DartApiError {
    constructor(endpoint: DartEndpoint) {
        super(endpoint, 'IP not allowed (012)', {
            dartStatus: STATUS_IP_NOT_ALLOWED,
        });
        this.name = 'DartIpNotAllowedError';
    }
}

/** 키가 없다 — 요청을 만들지 않았다. */
export class DartDisabledError extends Error {
    constructor() {
        super('DART_API_KEY is not set');
        this.name = 'DartDisabledError';
    }
}

/** 그 실행의 DART 요청을 전부 멈추는 이유. */
export type DartFatalReason =
    | 'disabled'
    | 'quota_exhausted'
    | 'ip_not_allowed'
    | 'auth_failed'
    | 'maintenance';

/**
 * 그 실행의 DART 요청을 **전부** 멈출 오류면 그 이유 — 키 없음·할당량·IP·키 문제(`010`·`011`·`901`)·점검(`800`). 회사 하나의
 * 데이터 문제가 아니라 계속 두드려도 같은 답이 오는 경우다. 그 밖(`100` 잘못된 값, 5xx 재시도 소진, 본문 형식)은 그 요청만의
 * 실패라 null.
 */
export function dartFatalReason(error: unknown): DartFatalReason | null {
    if (error instanceof DartDisabledError) return 'disabled';
    if (error instanceof DartQuotaError) return 'quota_exhausted';
    if (error instanceof DartIpNotAllowedError) return 'ip_not_allowed';
    if (!(error instanceof DartApiError) || error.dartStatus === null) {
        return null;
    }
    if (AUTH_FAILURE_STATUSES.has(error.dartStatus)) return 'auth_failed';
    return error.dartStatus === STATUS_MAINTENANCE ? 'maintenance' : null;
}

let warnedMissingKey = false;

function dartApiKey(): string | null {
    const key = process.env.DART_API_KEY?.trim();
    return key ? key : null;
}

/** 키가 설정돼 있는가. 없으면 프로세스당 한 번 경고한다. */
export function isDartEnabled(): boolean {
    if (dartApiKey() !== null) return true;
    if (!warnedMissingKey) {
        warnedMissingKey = true;
        console.warn(
            '[dart] DART_API_KEY is not set — DART ingestion is disabled (no requests are made)'
        );
    }
    return false;
}

// ── 요청 ──────────────────────────────────────────────────────────────────────────────────────────

let nextSlotAtMs = 0;

/** 테스트 격리용 — 모듈 상태(경고 표식·할당량 가드 표식·속도 게이트)를 초기화한다. */
export function __resetDartClientForTests(): void {
    warnedMissingKey = false;
    resetDartQuotaGuardForTests();
    nextSlotAtMs = 0;
}

/** 프로세스 전역 요청 게이트 — 호출 시점에 다음 슬롯을 동기적으로 예약한다(`secClient`의 `waitForSlot`과 같은 방식). */
async function waitForSlot(): Promise<void> {
    const now = Date.now();
    const start = Math.max(now, nextSlotAtMs);
    nextSlotAtMs = start + DART_MIN_REQUEST_INTERVAL_MS;
    if (start > now) await sleep(start - now);
}

function isTransient(error: unknown): boolean {
    return (
        error instanceof DartApiError &&
        error.dartStatus === null &&
        (error.httpStatus === null || error.httpStatus >= HTTP_SERVER_ERROR_MIN)
    );
}

function requestUrl(
    endpoint: DartEndpoint,
    key: string,
    params: Record<string, string>
): string {
    // 키가 든 URL이라 이 값은 로그·오류 메시지에 넣지 않는다(`requestBytes`는 엔드포인트 이름만 남긴다).
    const query = new URLSearchParams({ crtfc_key: key, ...params });
    return `${DART_API_BASE_URL}/${endpoint}?${query.toString()}`;
}

/**
 * 요청 하나(재시도 포함)를 보내 본문 바이트를 돌려준다. 시도마다 할당량 가드(`reserveCall`)와 속도 게이트를 지난다.
 * 네트워크·타임아웃 오류는 원 오류를 버리고 `DartApiError`(httpStatus null)로 감싼다 — 원 오류의 메시지·`cause`에 요청 URL
 * (= 키)이 실릴 수 있다. 5xx·네트워크만 재시도한다.
 */
async function requestBytes(
    endpoint: DartEndpoint,
    params: Record<string, string>,
    options: { timeoutMs: number; maxBytes: number }
): Promise<Uint8Array> {
    const key = dartApiKey();
    if (key === null) throw new DartDisabledError();
    const url = requestUrl(endpoint, key, params);
    return withRetry(
        async () => {
            const blockedReason = await reserveCall();
            if (blockedReason !== null) {
                throw new DartQuotaError(endpoint, blockedReason);
            }
            await waitForSlot();
            let res: Response;
            try {
                res = await fetch(url, {
                    cache: 'no-store',
                    signal: AbortSignal.timeout(options.timeoutMs),
                });
            } catch (error) {
                throw new DartApiError(
                    endpoint,
                    `network error (${error instanceof Error ? error.name : 'unknown'})`
                );
            }
            if (!res.ok) {
                await res.body?.cancel().catch(() => undefined);
                throw new DartApiError(endpoint, `HTTP ${res.status}`, {
                    httpStatus: res.status,
                });
            }
            try {
                return await readBoundedBody(res, options.maxBytes);
            } catch (error) {
                throw new DartApiError(
                    endpoint,
                    `body read failed (${error instanceof Error ? error.name : 'unknown'})`
                );
            }
        },
        {
            maxRetries: DART_MAX_RETRIES,
            baseDelayMs: DART_RETRY_BASE_DELAY_MS,
            isRetryable: isTransient,
        }
    );
}

/**
 * DART 상태 코드 처리 — `000` 정상(true), `013` 데이터 없음(false), 나머지는 던진다. `020`은 회로 차단을 세운다.
 */
async function acceptDartStatus(
    endpoint: DartEndpoint,
    status: string,
    message: string
): Promise<boolean> {
    if (status === STATUS_OK) return true;
    if (status === STATUS_NO_DATA) return false;
    if (status === STATUS_QUOTA_EXCEEDED) {
        await openQuotaBreaker();
        throw new DartQuotaError(endpoint, 'quota exceeded (020)');
    }
    if (status === STATUS_IP_NOT_ALLOWED) {
        // 메트릭 필터 접두(`infra/aws/20-dart-crons.sh`). 조치: OpenDART 인증키 관리에서 IP 제한을 해제한다.
        console.error(
            '[dart] ip_not_allowed — DART returned 012; remove the IP restriction on the API key (OpenDART > 인증키 관리)'
        );
        throw new DartIpNotAllowedError(endpoint);
    }
    throw new DartApiError(
        endpoint,
        `status ${status} ${message.slice(0, 200)}`,
        { dartStatus: status }
    );
}

interface DartJsonEnvelope {
    status: string;
    message: string;
    list: DartRecord[];
    raw: Readonly<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

function parseEnvelope(
    endpoint: DartEndpoint,
    bytes: Uint8Array
): DartJsonEnvelope {
    let parsed: unknown;
    try {
        parsed = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch {
        throw new DartApiError(endpoint, 'response is not JSON');
    }
    if (!isRecord(parsed) || typeof parsed.status !== 'string') {
        throw new DartApiError(endpoint, 'response has no status');
    }
    const list = Array.isArray(parsed.list) ? parsed.list.filter(isRecord) : [];
    return {
        status: parsed.status,
        message: typeof parsed.message === 'string' ? parsed.message : '',
        list,
        raw: parsed,
    };
}

async function fetchJsonList(
    endpoint: Exclude<DartEndpoint, 'corpCode.xml'>,
    params: Record<string, string>
): Promise<DartJsonEnvelope | null> {
    const envelope = parseEnvelope(
        endpoint,
        await requestBytes(endpoint, params, {
            timeoutMs: DART_REQUEST_TIMEOUT_MS,
            maxBytes: DART_MAX_JSON_BYTES,
        })
    );
    return (await acceptDartStatus(endpoint, envelope.status, envelope.message))
        ? envelope
        : null;
}

const compactDate = (isoDate: string): string => isoDate.replaceAll('-', '');

const toCount = (value: unknown): number => {
    const n = typeof value === 'string' ? Number(value) : value;
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
};

/**
 * 공시검색(`list.json`) 한 페이지 — 지분공시의 상세 유형 하나. 데이터 없음(`013`)이면 빈 페이지.
 *
 * `pblntf_detail_ty`만 보낸다(`pblntf_ty`는 보내지 않는다). 실 API에 `pblntf_ty=D`를 함께 보내면 상세 유형 필터가 무시돼
 * D001·D002·D005가 모두 지분공시 전체(같은 행·같은 `total_count`)를 돌려줬고, 상세 유형만 보내면 그 유형의 보고서만 왔다
 * (2026-10-17 실데이터 리허설 프로브). 상세 유형 코드(`D005` 등)가 대분류를 이미 담는다.
 */
export async function fetchDisclosureList(
    query: DartListQuery
): Promise<DartListPage> {
    const envelope = await fetchJsonList('list.json', {
        bgn_de: compactDate(query.beginDate),
        end_de: compactDate(query.endDate),
        pblntf_detail_ty: query.detailType,
        page_no: String(query.pageNo),
        page_count: String(DART_LIST_PAGE_COUNT),
        // 오래된 순 — 페이지를 넘기는 사이 새 공시가 들어와도 끝에 붙어 앞 페이지가 밀리지 않는다(기본값 desc면 행이 밀려 경계의
        // 공시를 건너뛸 수 있다).
        sort: 'date',
        sort_mth: 'asc',
    });
    if (envelope === null) {
        return { pageNo: query.pageNo, totalPage: 0, totalCount: 0, rows: [] };
    }
    return {
        pageNo: toCount(envelope.raw.page_no) || query.pageNo,
        totalPage: toCount(envelope.raw.total_page),
        totalCount: toCount(envelope.raw.total_count),
        rows: envelope.list,
    };
}

/** 대량보유 상황보고(`majorstock.json`) — 회사의 전체 이력(날짜 필터 없음). 없으면 빈 배열. */
export async function fetchMajorStock(corpCode: string): Promise<DartRecord[]> {
    return (
        (await fetchJsonList('majorstock.json', { corp_code: corpCode }))
            ?.list ?? []
    );
}

/** 임원·주요주주 소유보고(`elestock.json`) — 회사의 전체 이력. 없으면 빈 배열. */
export async function fetchExecutiveStock(
    corpCode: string
): Promise<DartRecord[]> {
    return (
        (await fetchJsonList('elestock.json', { corp_code: corpCode }))?.list ??
        []
    );
}

/** 정기보고서 보고서 코드 — 사업보고서(연간). */
export const DART_ANNUAL_REPORT_CODE = '11011';

/**
 * 정기보고서 주요정보 "배당에 관한 사항"(`alotMatter.json`) — 한 회사·한 사업연도의 사업보고서 행들. 해당 연도 보고서가 없으면
 * (`013`) null — 빈 목록과 구분한다(호출부가 "그 연도는 아직/없음"으로 다음 연도를 시도한다).
 */
export async function fetchAlotMatter(
    corpCode: string,
    fiscalYear: number
): Promise<DartRecord[] | null> {
    const envelope = await fetchJsonList('alotMatter.json', {
        corp_code: corpCode,
        bsns_year: String(fiscalYear),
        reprt_code: DART_ANNUAL_REPORT_CODE,
    });
    return envelope === null ? null : envelope.list;
}

const isZip = (bytes: Uint8Array): boolean =>
    ZIP_MAGIC.every((byte, index) => bytes[index] === byte);

/**
 * 고유번호 파일(`corpCode.xml`) — 정상이면 zip 바이트(안에 `CORPCODE.xml` 하나). 오류면 zip이 아니라 상태 XML
 * (`<result><status>020</status>…`)이 오므로 그 상태로 같은 처리를 한다. 데이터 없음(`013`)도 실패다(빈 맵을 돌려주지 않는다).
 */
export async function fetchCorpCodeZip(): Promise<Uint8Array> {
    const endpoint = 'corpCode.xml';
    const bytes = await requestBytes(
        endpoint,
        {},
        { timeoutMs: DART_CORP_CODE_TIMEOUT_MS, maxBytes: DART_MAX_ZIP_BYTES }
    );
    if (isZip(bytes)) return bytes;
    const text = new TextDecoder('utf-8').decode(bytes.subarray(0, 4096));
    const status = /<status>\s*(\d{3})\s*<\/status>/.exec(text)?.[1];
    if (status === undefined) {
        throw new DartApiError(endpoint, 'response is neither zip nor status');
    }
    const message = /<message>([^<]*)<\/message>/.exec(text)?.[1] ?? '';
    await acceptDartStatus(endpoint, status, message);
    throw new DartApiError(endpoint, `status ${status} without a zip`, {
        dartStatus: status,
    });
}

/** 실 DART 접근 면 — cron의 `createDeps`가 주입한다. */
export const realDartClient: DartClient = {
    isEnabled: isDartEnabled,
    fetchCorpCodeZip,
    fetchDisclosureList,
    fetchMajorStock,
    fetchExecutiveStock,
};
