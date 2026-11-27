import 'server-only';
import {
    extractPageExcerpt,
    findPublishedAt,
} from '@/features/agent-tools/lib/pageExcerptText';
import {
    isAllowedByRobots,
    isRobotsRuleList,
    parseRobots,
    type RobotsRule,
} from '@/shared/api/web/robotsTxt';
import { SafeFetchError, safeFetch } from '@/shared/api/web/safeFetch';
import type { WebSearchExcerptStatus } from '@/shared/api/web/webSearchResult';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * 검색 결과 페이지에서 질의와 관련 있는 문단을 발췌한다(`web_search`가 상위 결과에 붙인다).
 *
 * 가져올 URL은 검색 제공자가 돌려준 값이지 모델이 정한 값이 아니다. 그래도 서버가 외부 페이지를 받는 일이라
 * `safeFetch`(SSRF 방어, 홉별 재검증)를 거치고, 사이트의 robots.txt를 따른다. 정직한 UA를 쓰고 쿠키는 보내지
 * 않는다. 어떤 실패도 던지지 않고 이유를 상태로 돌려주며, 예외 메시지는 밖으로 내보내지 않는다.
 */
export const SIGLENS_AI_USER_AGENT =
    'Mozilla/5.0 (compatible; SiglensAI/1.0; +https://ai.siglens.io)';
/** robots.txt의 `User-agent:` 줄과 맞출 제품 토큰(소문자). */
const ROBOTS_TOKEN = 'siglensai';
const MAX_BODY_BYTES = 1_500_000;
const MAX_ROBOTS_BYTES = 512_000;
const ROBOTS_TIMEOUT_MS = 1_000;
const ROBOTS_CACHE_TTL_SECONDS = SECONDS_PER_DAY;
/** 헤더에 charset이 없을 때 `<meta charset>`을 찾는 앞부분 바이트 수. */
const CHARSET_SNIFF_BYTES = 4_096;

export type PageExcerptResult =
    | { ok: true; excerpt: string; publishedAt: string | null }
    | { ok: false; status: WebSearchExcerptStatus };

type RobotsFetch =
    | { kind: 'rules'; rules: RobotsRule[] }
    | { kind: 'unavailable' };

function classify(error: unknown): WebSearchExcerptStatus {
    if (error instanceof SafeFetchError)
        return error.code === 'blocked' ? 'blocked' : 'error';
    if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError')
    )
        return 'timeout';
    return 'error';
}

/** 본문을 `maxBytes`까지만 읽는다. 넘으면 읽기를 끊고 null. */
async function readCapped(
    response: Response,
    maxBytes: number
): Promise<Uint8Array | null> {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
        await response.body?.cancel().catch(() => undefined);
        return null;
    }
    const reader = response.body?.getReader();
    if (reader === undefined) return new Uint8Array();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            return null;
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    chunks.reduce((offset, chunk) => {
        bytes.set(chunk, offset);
        return offset + chunk.byteLength;
    }, 0);
    return bytes;
}

function charsetOf(contentType: string, head: string): string {
    const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1];
    const fromMeta = /<meta\b[^<>]*charset\s*=\s*["']?([\w-]+)/i.exec(
        head
    )?.[1];
    return (fromHeader ?? fromMeta ?? 'utf-8').toLowerCase();
}

/** 헤더·`<meta>`의 charset(한국 뉴스 사이트는 아직 `euc-kr`이 있다)으로 디코딩한다. 모르는 이름이면 UTF-8. */
function decodeHtml(bytes: Uint8Array, contentType: string): string {
    const head = new TextDecoder('latin1').decode(
        bytes.subarray(0, CHARSET_SNIFF_BYTES)
    );
    const charset = charsetOf(contentType, head);
    try {
        return new TextDecoder(charset).decode(bytes);
    } catch {
        return new TextDecoder('utf-8').decode(bytes);
    }
}

/**
 * robots.txt는 호스트 단위 24시간 캐시이고 in-flight 공유도 되므로, 이 요청에는 첫 호출자의 턴 신호를 걸지 않는다.
 * 그 턴이 중단되거나 예산이 끝났다고 같은 호스트를 기다리는 다른 호출자에게 "알 수 없음"이 돌아가면 안 된다.
 * 시간 상한은 {@link ROBOTS_TIMEOUT_MS} 하나다.
 */
async function fetchRobots(origin: string): Promise<RobotsFetch> {
    try {
        const response = await safeFetch(`${origin}/robots.txt`, {
            headers: {
                'User-Agent': SIGLENS_AI_USER_AGENT,
                Accept: 'text/plain',
            },
            signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
        });
        // 4xx: robots.txt가 없다는 뜻이다 — 제한이 없다.
        if (response.status >= 400 && response.status < 500) {
            await response.body?.cancel().catch(() => undefined);
            return { kind: 'rules', rules: [] };
        }
        if (response.status !== 200) {
            await response.body?.cancel().catch(() => undefined);
            return { kind: 'unavailable' };
        }
        const bytes = await readCapped(response, MAX_ROBOTS_BYTES);
        // 상한을 넘는 robots.txt는 끝까지 읽지 못한 것이므로 규칙을 알 수 없다.
        if (bytes === null) return { kind: 'unavailable' };
        const rules = parseRobots(
            new TextDecoder('utf-8').decode(bytes),
            ROBOTS_TOKEN
        );
        return { kind: 'rules', rules };
    } catch (error) {
        // SSRF 거부는 호출부가 상태로 바꿔야 하므로 다시 던진다.
        if (error instanceof SafeFetchError && error.code === 'blocked')
            throw error;
        // RFC 9309: 리다이렉트가 너무 많으면 robots.txt가 없는 것으로 본다.
        if (error instanceof SafeFetchError)
            return { kind: 'rules', rules: [] };
        // 5xx·1초 초과·연결 실패: 허용 여부를 알 수 없으니 가져가지 않는다.
        return { kind: 'unavailable' };
    }
}

async function robotsRules(origin: string): Promise<RobotsFetch> {
    const cached = await getOrSetCache<RobotsFetch>(
        `web:robots:v1:${origin}`,
        ROBOTS_CACHE_TTL_SECONDS,
        () => fetchRobots(origin),
        value => value.kind === 'rules'
    );
    // 저장된 값의 모양이 어긋나면(SA-18) 규칙이 없는 것으로 읽지 않고 알 수 없음으로 둔다.
    return cached.kind === 'rules' && !isRobotsRuleList(cached.rules)
        ? { kind: 'unavailable' }
        : cached;
}

/**
 * @param url 검색 제공자가 돌려준 결과 URL.
 * @param queryTerms `extractQueryTerms(query)`.
 * @param signal 턴 신호. 이 위에 `budgetMs`짜리 시간 상한을 더한다.
 * @param budgetMs robots.txt 확인과 본문 읽기를 합친 상한.
 */
export async function fetchPageExcerpt(
    url: string,
    queryTerms: readonly string[],
    signal: AbortSignal,
    budgetMs: number
): Promise<PageExcerptResult> {
    const budget = AbortSignal.any([signal, AbortSignal.timeout(budgetMs)]);
    try {
        const target = new URL(url);
        const robots = await robotsRules(target.origin);
        if (
            robots.kind === 'unavailable' ||
            !isAllowedByRobots(robots.rules, target.pathname + target.search)
        )
            return { ok: false, status: 'robots' };
        const response = await safeFetch(url, {
            headers: {
                'User-Agent': SIGLENS_AI_USER_AGENT,
                Accept: 'text/html,application/xhtml+xml',
            },
            signal: budget,
        });
        if (response.status !== 200) {
            await response.body?.cancel().catch(() => undefined);
            return { ok: false, status: 'error' };
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (!/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
            await response.body?.cancel().catch(() => undefined);
            return { ok: false, status: 'not_html' };
        }
        const bytes = await readCapped(response, MAX_BODY_BYTES);
        if (bytes === null) return { ok: false, status: 'too_large' };
        const html = decodeHtml(bytes, contentType);
        const excerpt = extractPageExcerpt(html, queryTerms);
        if (excerpt === '') return { ok: false, status: 'error' };
        return { ok: true, excerpt, publishedAt: findPublishedAt(html) };
    } catch (error) {
        const status = classify(error);
        // 예외 메시지에는 URL·내부 사정이 실릴 수 있어 이름만 로그에 남긴다. 예상된 실패(시간 초과, 차단)는
        // 텔레메트리의 `excerptFailures`가 세므로 여기서는 분류하지 못한 것만 남긴다.
        if (status === 'error')
            console.warn(
                '[AgentTool] web_search excerpt failed',
                error instanceof Error ? error.name : 'unknown'
            );
        return { ok: false, status };
    }
}
