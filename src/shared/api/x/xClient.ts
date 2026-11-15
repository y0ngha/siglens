import 'server-only';
import { isRecord } from '@/shared/lib/isRecord';

const X_API_BASE = 'https://api.x.com/2';
/**
 * 사용자 조회 한 번의 타임아웃. 도구 전체 예산은 `entities/x-posts/server/getXPosts.ts`가 합산한다.
 * 호출자의 취소 신호는 받지 않는다 — 결과가 캐시로 공유되므로(같은 키의 동시 호출이 한 요청을 나눠 쓴다) 한 턴의
 * 취소가 다른 턴의 읽기를 끊으면 안 되고, 요청은 이 타임아웃으로 스스로 끝난다.
 */
const X_USER_LOOKUP_TIMEOUT_MS = 4_000;
/** 타임라인 한 페이지의 타임아웃. */
const X_TIMELINE_TIMEOUT_MS = 5_000;
/** X가 한 번의 사용자 조회에 받는 핸들 수. */
const X_USERNAMES_PER_REQUEST = 100;
/** X 핸들: 영숫자·밑줄 1~15자. 이 모양이 아닌 값은 URL·SPARQL 결과에서 쓰지 않는다. */
export const X_HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
const X_HANDLE = X_HANDLE_PATTERN;
/** X 사용자·글 ID: 숫자열. */
const X_NUMERIC_ID = /^\d{1,25}$/;

/**
 * X 요청의 결과가 과금됐는지. 하루 예산 환불이 이 값으로 정한다.
 * - `none`: 요청을 보내지 않았거나 X가 HTTP 오류로 답했다 — 아무것도 읽지 않았다.
 * - `unknown`: 타임아웃·연결 실패, 또는 200인데 본문을 쓸 수 없다 — X가 처리했는지 알 수 없다.
 */
type XBilling = 'none' | 'unknown';

/** X API 호출 실패. 토큰·응답 본문은 싣지 않는다 — 상태 코드와 과금 여부만. */
export class XApiError extends Error {
    readonly status: number | null;
    readonly billing: XBilling;

    constructor(message: string, status: number | null, billing: XBilling) {
        super(message);
        this.name = 'XApiError';
        this.status = status;
        this.billing = billing;
    }
}

interface XUser {
    id: string;
    username: string;
    name: string;
    followers: number;
}

interface XTimelinePost {
    id: string;
    /** 긴 글(`note_tweet`)이면 전문, 아니면 본문. HTML 엔티티는 그대로다(호출부가 푼다). */
    text: string;
    /** ISO 8601 (UTC). */
    createdAt: string;
    likes: number;
    reposts: number;
}

interface XTimelinePage {
    posts: XTimelinePost[];
    /** 응답에 다음 페이지 토큰이 있었는가 — 요청한 기간 안에 읽지 않은 더 오래된 항목이 남았다. */
    hasMore: boolean;
    /** X가 돌려준 항목 수(모양이 틀려 버린 것 포함) — X가 과금하는 단위다. */
    billedItems: number;
}

interface XUsersLookup {
    users: XUser[];
    /** X가 돌려준 사용자 수(모양이 틀려 버린 것 포함). */
    billedItems: number;
}

/** `X_BEARER_TOKEN`. 없으면 `null` — 호출부가 도구를 노출하지 않는다. */
export function xBearerToken(): string | null {
    const token = process.env.X_BEARER_TOKEN;
    return token !== undefined && token !== '' ? token : null;
}

function nonNegativeInt(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.trunc(value)
        : 0;
}

async function xGet(
    path: string,
    params: Record<string, string>,
    timeoutMs: number
): Promise<unknown> {
    const token = xBearerToken();
    if (token === null)
        throw new XApiError('x bearer token missing', null, 'none');
    const url = new URL(`${X_API_BASE}${path}`);
    for (const [key, value] of Object.entries(params))
        url.searchParams.set(key, value);
    let response: Response;
    try {
        response = await fetch(url, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        // fetch의 오류 메시지에는 URL이 들어갈 수 있다 — 이름만 옮긴다.
        throw new XApiError(
            `x request failed: ${error instanceof Error ? error.name : 'unknown'}`,
            null,
            'unknown'
        );
    }
    if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new XApiError(
            `x responded ${response.status}`,
            response.status,
            'none'
        );
    }
    try {
        const json: unknown = await response.json();
        return json;
    } catch {
        throw new XApiError(
            'x response was not json',
            response.status,
            'unknown'
        );
    }
}

function toXUser(raw: unknown): XUser | null {
    if (!isRecord(raw)) return null;
    const { id, username, name, public_metrics: metrics } = raw;
    if (typeof id !== 'string' || !X_NUMERIC_ID.test(id)) return null;
    if (typeof username !== 'string' || !X_HANDLE.test(username)) return null;
    return {
        id,
        username,
        name: typeof name === 'string' && name.trim() !== '' ? name : username,
        followers: nonNegativeInt(
            isRecord(metrics) ? metrics.followers_count : undefined
        ),
    };
}

/**
 * 핸들로 사용자(ID·표시 이름·팔로워 수)를 조회한다. 모양이 틀린 핸들은 요청에 넣지 않고, X가 모르는 핸들은
 * 결과에서 빠진다(오류가 아니다). 한 요청에 최대 {@link X_USERNAMES_PER_REQUEST}개 — 넘는 입력은 호출부가 자른다.
 * X는 조회한 사용자 수만큼 과금한다.
 */
export async function fetchXUsersByUsernames(
    usernames: readonly string[]
): Promise<XUsersLookup> {
    const valid = usernames
        .filter(name => X_HANDLE.test(name))
        .slice(0, X_USERNAMES_PER_REQUEST);
    if (valid.length === 0) return { users: [], billedItems: 0 };
    const json = await xGet(
        '/users/by',
        { usernames: valid.join(','), 'user.fields': 'name,public_metrics' },
        X_USER_LOOKUP_TIMEOUT_MS
    );
    // 모르는 핸들은 `errors`에 오고 `data`에서 빠진다 — 오류가 아니다.
    const data = isRecord(json) ? json.data : undefined;
    if (!Array.isArray(data)) return { users: [], billedItems: 0 };
    return {
        users: data.flatMap(raw => {
            const user = toXUser(raw);
            return user === null ? [] : [user];
        }),
        billedItems: data.length,
    };
}

function toTimelinePost(raw: unknown): XTimelinePost | null {
    if (!isRecord(raw)) return null;
    const { id, text, created_at: createdAt, public_metrics: metrics } = raw;
    if (typeof id !== 'string' || !X_NUMERIC_ID.test(id)) return null;
    if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt)))
        return null;
    const note = isRecord(raw.note_tweet) ? raw.note_tweet.text : undefined;
    const body = typeof note === 'string' && note !== '' ? note : text;
    if (typeof body !== 'string' || body.trim() === '') return null;
    return {
        id,
        text: body,
        createdAt,
        likes: nonNegativeInt(
            isRecord(metrics) ? metrics.like_count : undefined
        ),
        reposts: nonNegativeInt(
            isRecord(metrics) ? metrics.retweet_count : undefined
        ),
    };
}

/**
 * 한 계정 타임라인의 최신 한 페이지(답글·리포스트 제외, `startTime` 이후). 다음 페이지는 읽지 않는다 —
 * X는 돌려준 글 수만큼 과금하므로 한 호출의 비용이 `pageSize`로 묶인다.
 *
 * 글이 없으면 `posts: []`(X는 `data` 없이 `meta.result_count: 0`을 준다). `data` 없이 `errors`만 오면(정지·비공개·삭제된
 * 계정 — HTTP는 200이다) 빈 페이지가 아니라 읽기 실패로 던진다: 빈 페이지로 바꾸면 "기간 안에 글이 없다"로 읽힌다.
 */
export async function fetchXTimelinePage(
    userId: string,
    options: { startTime: Date; pageSize: number }
): Promise<XTimelinePage> {
    if (!X_NUMERIC_ID.test(userId))
        throw new XApiError('x user id malformed', null, 'none');
    const json = await xGet(
        `/users/${userId}/tweets`,
        {
            max_results: String(options.pageSize),
            exclude: 'replies,retweets',
            // X 문서가 정한 형식(`YYYY-MM-DDTHH:mm:ssZ`, 초 단위)으로 보낸다.
            start_time: `${options.startTime.toISOString().slice(0, 19)}Z`,
            'tweet.fields': 'created_at,public_metrics,note_tweet',
        },
        X_TIMELINE_TIMEOUT_MS
    );
    if (!isRecord(json))
        throw new XApiError('x timeline malformed', 200, 'unknown');
    const { data, meta, errors } = json;
    if (!Array.isArray(data) && Array.isArray(errors) && errors.length > 0)
        throw new XApiError('x timeline unavailable', 200, 'none');
    const posts = Array.isArray(data)
        ? data.flatMap(raw => {
              const post = toTimelinePost(raw);
              return post === null ? [] : [post];
          })
        : [];
    const nextToken = isRecord(meta) ? meta.next_token : undefined;
    return {
        posts,
        hasMore: typeof nextToken === 'string' && nextToken !== '',
        billedItems: Array.isArray(data) ? data.length : 0,
    };
}
