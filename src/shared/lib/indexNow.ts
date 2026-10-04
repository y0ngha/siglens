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
import { SITE_HOST, SITE_URL } from '@/shared/lib/seo';

export interface IndexNowResult {
    /** 보낸 URL 수. 꺼져 있거나 보낼 URL이 없으면 0. */
    readonly submitted: number;
    /** 200/202로 답한 엔드포인트 수. */
    readonly ok: number;
    /** 실패했거나 타임아웃된 엔드포인트 수. */
    readonly failed: number;
}

export interface SubmitIndexNowOptions {
    /** 테스트가 청크 분할을 작은 값으로 확인하려고 주입한다. 운영은 기본값. */
    readonly maxUrlsPerRequest?: number;
}

const DISABLED_RESULT: IndexNowResult = { submitted: 0, ok: 0, failed: 0 };

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

const { HTTP_STATUS_OK, HTTP_STATUS_ACCEPTED } = constants;

function isAccepted(status: number): boolean {
    return status === HTTP_STATUS_OK || status === HTTP_STATUS_ACCEPTED;
}

/**
 * 엔드포인트 하나에 모든 청크를 순서대로 보낸다. 성공 여부만 돌려준다.
 *
 * 타임아웃 신호를 **엔드포인트당 하나**로 공유한다 — 청크마다 새로 만들면 청크 수에
 * 비례해 상한이 늘어, "이 제출은 5초 안에 끝난다"는 크론 쪽 전제가 깨진다.
 * 첫 실패에서 멈춘다: 같은 엔드포인트의 나머지 청크도 같은 이유로 실패할 가능성이
 * 높고, 계속 보내 봐야 크론 락만 더 붙든다.
 */
async function postToEndpoint(
    endpoint: string,
    chunks: readonly (readonly string[])[]
): Promise<boolean> {
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
                return false;
            }
        } catch (error) {
            console.error('[indexnow] submit failed', { endpoint, error });
            return false;
        }
    }
    return true;
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
    if (submittable.length === 0) return DISABLED_RESULT;

    const { maxUrlsPerRequest = INDEXNOW_MAX_URLS_PER_REQUEST } = options;
    const chunks = chunk(submittable, maxUrlsPerRequest);

    const outcomes = await Promise.allSettled(
        INDEXNOW_ENDPOINTS.map(endpoint => postToEndpoint(endpoint, chunks))
    );
    // `postToEndpoint`는 던지지 않지만, 미래 수정이 던지게 만들어도 거절된 약속을
    // 실패로 세어 이 함수의 "던지지 않는다" 계약이 유지되게 한다.
    const ok = outcomes.filter(
        outcome => outcome.status === 'fulfilled' && outcome.value
    ).length;
    return {
        submitted: submittable.length,
        ok,
        failed: outcomes.length - ok,
    };
}
