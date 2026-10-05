import 'server-only';
import { constants } from 'node:http2';
import { isE2E } from '@/shared/api/e2eEnv';
import {
    INDEXNOW_ENDPOINTS,
    INDEXNOW_KEY,
    INDEXNOW_KEY_LOCATION,
    INDEXNOW_MAX_URLS_PER_REQUEST,
    INDEXNOW_TIMEOUT_MS,
} from '@/shared/config/indexNow';
import { MS_PER_SECOND } from '@/shared/config/time';
import { SITE_HOST, SITE_URL } from '@/shared/lib/seo';

/**
 * 한 번의 제출이 **어떻게 끝났는가**. 호출부(`indexNowQueue`)가 대기열 멤버를 지울지,
 * 얼마나 쉴지, 그냥 두고 다음 tick에 다시 시도할지를 이것으로 정한다.
 *
 *  - `ok`: 모든 엔드포인트가 200/202.
 *  - `disabled`: 운영 호스트가 아니거나 E2E — 아무것도 보내지 않았다.
 *  - `empty`: 보낼 수 있는 URL이 하나도 없다(호스트 불일치·파싱 불가).
 *  - `rateLimited`: 429. `Retry-After`가 있으면 초 단위로 싣는다(없으면 `null`).
 *  - `rejected`: 그 밖의 4xx — 같은 요청을 다시 보내도 같은 답이다. 400·422는 **URL 자체가**
 *    잘못이라 대기열에서 지운다. 그 밖(403 = 키 검증 실패 등)은 URL이 아니라 설정·상대 쪽 문제라
 *    **지우지 않고** 1시간 쉰다. 이 정책의 판정은 `isUrlRejectionStatus` 한 곳이 소유한다 —
 *    대기열(`indexNowQueue`)은 그 함수만 부른다.
 *  - `transient`: 5xx·408·네트워크 오류·타임아웃. 다시 보내면 통할 수 있다(`status`는 없으면 `null`).
 */
export type IndexNowOutcome =
    | { readonly kind: 'ok' }
    | { readonly kind: 'disabled' }
    | { readonly kind: 'empty' }
    | {
          readonly kind: 'rateLimited';
          readonly retryAfterSeconds: number | null;
      }
    | { readonly kind: 'rejected'; readonly status: number }
    | { readonly kind: 'transient'; readonly status: number | null };

export interface IndexNowResult {
    /** 보낸 URL 수. 꺼져 있거나 보낼 URL이 없으면 0. */
    readonly submitted: number;
    /** 200/202로 답한 엔드포인트 수. */
    readonly ok: number;
    /** 실패했거나 타임아웃된 엔드포인트 수. */
    readonly failed: number;
    readonly outcome: IndexNowOutcome;
}

export interface SubmitIndexNowOptions {
    /** 테스트가 청크 분할을 작은 값으로 확인하려고 주입한다. 운영은 기본값. */
    readonly maxUrlsPerRequest?: number;
}

const DISABLED_RESULT: IndexNowResult = {
    submitted: 0,
    ok: 0,
    failed: 0,
    outcome: { kind: 'disabled' },
};

const EMPTY_RESULT: IndexNowResult = {
    submitted: 0,
    ok: 0,
    failed: 0,
    outcome: { kind: 'empty' },
};

/**
 * 운영 호스트에서만 켠다.
 *
 * 프리뷰·로컬·E2E에서 보낸 제출은 검색엔진에 **존재하지 않는 URL**을 알리거나,
 * `siglens.io`의 키 파일을 가리키는 요청이 다른 호스트에서 나가 거절(403)된다.
 * 어느 쪽이든 얻는 것이 없고 외부 호스트 호출만 늘어난다 — E2E는 외부 호스트
 * 요청 자체가 금지다(`shared/config/googleAds.ts`와 같은 가드).
 */
export function isIndexNowEnabled(): boolean {
    return (
        process.env.NODE_ENV === 'production' &&
        !isE2E() &&
        new URL(SITE_URL).host === SITE_HOST
    );
}

/** 중복을 없애고 운영 호스트의 URL만 남긴다. 입력 순서는 유지한다. */
function isSiteHostUrl(url: string): boolean {
    // 파싱되지 않는 값은 보낼 수 없다 — 조용히 버린다.
    return URL.canParse(url) && new URL(url).host === SITE_HOST;
}

function selectSubmittableUrls(urls: readonly string[]): string[] {
    return [...new Set(urls.filter(isSiteHostUrl))];
}

function chunk<T>(items: readonly T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
        items.slice(i * size, (i + 1) * size)
    );
}

const {
    HTTP_STATUS_OK,
    HTTP_STATUS_ACCEPTED,
    HTTP_STATUS_TOO_MANY_REQUESTS,
    HTTP_STATUS_REQUEST_TIMEOUT,
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_UNPROCESSABLE_ENTITY,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
} = constants;

/**
 * 이 거절 상태가 **URL 자체의 문제**인가(= 다시 보내도 같은 답이라 대기열에서 지운다).
 *
 * 400(형식 오류)·422(호스트 불일치)만이다. 403·그 밖의 4xx는 URL이 아니라 키·설정 문제라
 * 해당하지 않는다(`IndexNowOutcome`의 `rejected` 설명).
 */
export function isUrlRejectionStatus(status: number): boolean {
    return (
        status === HTTP_STATUS_BAD_REQUEST ||
        status === HTTP_STATUS_UNPROCESSABLE_ENTITY
    );
}

function isAccepted(status: number): boolean {
    return status === HTTP_STATUS_OK || status === HTTP_STATUS_ACCEPTED;
}

/**
 * `Retry-After`를 초로 읽는다 — 정수 초 또는 HTTP 날짜. 없거나 읽을 수 없으면 `null`.
 *
 * 과거 날짜는 0초로 접는다(음수 대기는 없다). `nowMs`는 테스트가 고정한다.
 */
export function parseRetryAfterSeconds(
    value: string | null,
    nowMs: number = Date.now()
): number | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    // HTTP 날짜는 요일·월 이름이 있다 — 숫자만 있는 이상한 값을 `Date.parse`가 날짜로 읽지 않게 한다.
    if (!/[A-Za-z]/.test(trimmed)) return null;
    const at = Date.parse(trimmed);
    if (Number.isNaN(at)) return null;
    return Math.max(0, Math.ceil((at - nowMs) / MS_PER_SECOND));
}

function classifyFailure(response: Response): IndexNowOutcome {
    const { status } = response;
    if (status === HTTP_STATUS_TOO_MANY_REQUESTS) {
        return {
            kind: 'rateLimited',
            retryAfterSeconds: parseRetryAfterSeconds(
                response.headers.get('retry-after')
            ),
        };
    }
    // 408은 4xx지만 "다시 보내면 된다"는 뜻이라 일시적 실패다.
    if (
        status >= HTTP_STATUS_BAD_REQUEST &&
        status < HTTP_STATUS_INTERNAL_SERVER_ERROR &&
        status !== HTTP_STATUS_REQUEST_TIMEOUT
    ) {
        return { kind: 'rejected', status };
    }
    return { kind: 'transient', status };
}

/**
 * 엔드포인트 하나에 모든 청크를 순서대로 보낸다. 결과 종류를 돌려준다.
 *
 * 타임아웃 신호를 **엔드포인트당 하나**로 공유한다 — 청크마다 새로 만들면 청크 수에
 * 비례해 상한이 늘어, "이 제출은 5초 안에 끝난다"는 크론 쪽 전제가 깨진다.
 * 첫 실패에서 멈춘다: 같은 엔드포인트의 나머지 청크도 같은 이유로 실패할 가능성이
 * 높고, 계속 보내 봐야 크론 락만 더 붙든다.
 */
async function postToEndpoint(
    endpoint: string,
    chunks: readonly (readonly string[])[]
): Promise<IndexNowOutcome> {
    const signal = AbortSignal.timeout(INDEXNOW_TIMEOUT_MS);
    for (const urlList of chunks) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                    host: SITE_HOST,
                    key: INDEXNOW_KEY,
                    keyLocation: INDEXNOW_KEY_LOCATION,
                    urlList,
                }),
                // 쓰기 요청이 Next fetch 캐시(ISR 캐시 핸들러)에 들어가면 안 된다.
                cache: 'no-store',
                signal,
            });
            if (!isAccepted(response.status)) {
                // URL 목록은 로그에 싣지 않는다 — 수백 건이 한 줄에 쏟아진다.
                console.error('[indexnow] submit failed', {
                    endpoint,
                    status: response.status,
                });
                return classifyFailure(response);
            }
        } catch (error) {
            console.error('[indexnow] submit failed', { endpoint, error });
            return { kind: 'transient', status: null };
        }
    }
    return { kind: 'ok' };
}

/**
 * 엔드포인트별 결과를 하나로 접는다. 더 **조치가 필요한** 쪽이 이긴다:
 * 속도 제한(쉬어야 한다) > 거절(다시 보내도 소용없다) > 일시 실패 > 성공.
 */
const OUTCOME_PRECEDENCE: readonly IndexNowOutcome['kind'][] = [
    'rateLimited',
    'rejected',
    'transient',
];

function foldOutcomes(outcomes: readonly IndexNowOutcome[]): IndexNowOutcome {
    const [mostActionable] = OUTCOME_PRECEDENCE.flatMap(kind =>
        outcomes.filter(outcome => outcome.kind === kind)
    );
    return mostActionable ?? { kind: 'ok' };
}

/**
 * 바뀐 URL을 Bing·Naver(IndexNow)에 알린다. **던지지 않는다.**
 *
 * 호출부는 프리웜 크론이다 — 이 제출이 실패해도 크론의 HTTP 상태와 락 해제에
 * 영향을 주면 안 되므로, 모든 실패는 엔드포인트별 로그 한 줄과 `failed` 카운트로만
 * 드러난다. Google은 IndexNow에 참여하지 않는다(`INDEXNOW_ENDPOINTS` 주석).
 */
export async function submitIndexNow(
    urls: readonly string[],
    options: SubmitIndexNowOptions = {}
): Promise<IndexNowResult> {
    if (!isIndexNowEnabled()) return DISABLED_RESULT;

    const submittable = selectSubmittableUrls(urls);
    if (submittable.length === 0) return EMPTY_RESULT;

    const { maxUrlsPerRequest = INDEXNOW_MAX_URLS_PER_REQUEST } = options;
    const chunks = chunk(submittable, maxUrlsPerRequest);

    const settled = await Promise.allSettled(
        INDEXNOW_ENDPOINTS.map(endpoint => postToEndpoint(endpoint, chunks))
    );
    // `postToEndpoint`는 던지지 않지만, 미래 수정이 던지게 만들어도 거절된 약속을
    // 일시 실패로 세어 이 함수의 "던지지 않는다" 계약이 유지되게 한다.
    const outcomes = settled.map((entry): IndexNowOutcome =>
        entry.status === 'fulfilled'
            ? entry.value
            : { kind: 'transient', status: null }
    );
    const ok = outcomes.filter(outcome => outcome.kind === 'ok').length;
    return {
        submitted: submittable.length,
        ok,
        failed: outcomes.length - ok,
        outcome: foldOutcomes(outcomes),
    };
}
