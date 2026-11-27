import { constants } from 'node:http2';
import 'server-only';
import {
    CounterStoreUnavailableError,
    hashClientIp,
    type Tier,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { getClientIp } from '@/shared/api/getClientIp';
import { readGuestId } from '@/shared/api/guestId';
import { CHAT_REQUEST_MAX_BYTES } from '@/shared/config/chatImages';
import { isBot } from '@/shared/api/isBot';
import { AGENT_TIME_ZONE_HEADER } from '@/shared/i18n/locales';
import { localeFromRequestHeader } from '@/shared/lib/localeFromRequestHeader';
import {
    BoundedBodyTooLargeError,
    readBoundedBody,
} from '@/shared/lib/readBoundedBody';
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import { AGENT_BUSY_LOG } from '../busyLog';
import {
    createGuestIpBackstopCounter,
    GUEST_IP_TURNS_PER_DAY,
} from '../counters';
import { guestSubject } from '../guestSubject';
import { resolveAgentTier } from '../resolveAgentTier';
import { acquireTurnLock } from '../turnLock';
import { agentTurnStream } from './_lib/agentTurnStream';
import { normalizeBodyImages } from './_lib/normalizeBodyImages';
import { parseBody } from './_lib/parseBody';
import { guestTurn, prepareMemberTurn } from './_lib/prepareTurn';
import {
    acquireTurnSlot,
    getActiveAgentTurns,
    getQueuedAgentTurns,
    MAX_ACTIVE_AGENT_TURNS,
} from './_lib/turnSlots';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

const {
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_CONFLICT,
    HTTP_STATUS_FORBIDDEN,
    HTTP_STATUS_PAYLOAD_TOO_LARGE,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
    HTTP_STATUS_SERVICE_UNAVAILABLE,
    HTTP_STATUS_TOO_MANY_REQUESTS,
    HTTP_STATUS_UNAUTHORIZED,
} = constants;

/** nginx 관례의 "클라이언트가 먼저 끊음" — 줄에서 기다리다 끊긴 요청에 돌려줄 응답은 없다. */
const HTTP_STATUS_CLIENT_CLOSED = 499;

export const dynamic = 'force-dynamic';

/**
 * A browser always sends `Origin` on a same-origin POST from a page it
 * rendered; only that page can hold the `siglens_guest`/session cookies this
 * route relies on. Checking it blocks cross-site calls and naive scripts that
 * skip the browser entirely — it is not authentication (the cookie checks
 * below are), just the cheapest filter before spending any quota/DB work.
 */
const AI_ORIGIN = new URL(AI_SITE_URL).origin;

const SSE_HEADERS: HeadersInit = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'X-Accel-Buffering': 'no',
};

const json = (status: number, body: unknown, headers?: HeadersInit): Response =>
    Response.json(body, { status, headers });

type JsonBodyRead =
    | { kind: 'ok'; value: unknown }
    | { kind: 'too_large' }
    | { kind: 'invalid' };

/** 본문을 상한까지만 읽어 JSON으로 파싱한다. 본문 없음·읽기 실패·JSON 아님은 `invalid`(→ 기존 400 경로). */
async function readJsonBody(
    request: Request,
    maxBytes: number
): Promise<JsonBodyRead> {
    try {
        const bytes = await readBoundedBody(request, maxBytes);
        return {
            kind: 'ok',
            value: JSON.parse(new TextDecoder().decode(bytes)),
        };
    } catch (error) {
        return error instanceof BoundedBodyTooLargeError
            ? { kind: 'too_large' }
            : { kind: 'invalid' };
    }
}

export async function POST(request: Request): Promise<Response> {
    if (process.env.AGENT_CHAT_DISABLED === '1')
        return json(
            HTTP_STATUS_SERVICE_UNAVAILABLE,
            { error: 'disabled' },
            { 'Retry-After': '600' }
        );

    const user = await getCurrentUser();
    if (isBot(request.headers))
        return json(HTTP_STATUS_FORBIDDEN, { error: 'bot' });
    if (request.headers.get('Origin') !== AI_ORIGIN)
        return json(HTTP_STATUS_FORBIDDEN, { error: 'bot' });

    // 이미지(base64)가 실려 본문이 커질 수 있다. `readBoundedBody`가 선언된 `content-length`는 읽기 전에, 선언이 없거나
    // 거짓인 요청(chunked 등)은 읽는 바이트를 세어 상한을 넘기는 즉시 끊는다. `parseBody`는 그 뒤 장수·장당 크기를 잰다.
    const read = await readJsonBody(request, CHAT_REQUEST_MAX_BYTES);
    if (read.kind === 'too_large')
        return json(HTTP_STATUS_PAYLOAD_TOO_LARGE, { error: 'too_large' });
    const body = parseBody(read.kind === 'ok' ? read.value : null);
    if (body === null)
        return json(HTTP_STATUS_BAD_REQUEST, { error: 'invalid_body' });
    /**
     * Guests can ask (tier `free`: a few turns a day, counted per IP) but own no
     * stored conversation — so anything that names one, or rewrites stored rows
     * (`regenerate`/`edit`), still needs a session. That is also the path a
     * member whose session expired on `/c/<id>` takes, and the client turns this
     * 401 into the login handoff.
     */
    if (
        user === null &&
        (body.conversationId !== null || body.action !== 'send')
    )
        return json(HTTP_STATUS_UNAUTHORIZED, { error: 'unauthenticated' });
    /**
     * A guest must already hold the `siglens_guest` cookie minted by a real
     * page view (`proxy.ts`'s `handleAiHost`) — `readGuestId` never mints one
     * itself. That closes the gap the Origin check above leaves open: a
     * request that forges `Origin` still can't manufacture a guest identity,
     * it can only reuse one issued by loading the page first. The client
     * already turns this 401 into the same login handoff as the check above.
     */
    let subject: string;
    if (user === null) {
        const guestId = await readGuestId();
        if (guestId === null)
            return json(HTTP_STATUS_UNAUTHORIZED, { error: 'unauthenticated' });
        subject = guestSubject(guestId);
    } else {
        subject = user.id;
    }

    const locale = localeFromRequestHeader(request);
    const tier: Tier = user ? await resolveAgentTier(user.id) : 'free';

    /**
     * Guest-only per-IP backstop, checked before anything else guest-specific
     * runs. The per-guest quota above is keyed by cookie, not IP, so without
     * this a cleared cookie would look like a brand-new guest with a fresh
     * quota — this caps how many guest turns one address can spend per day
     * regardless of how many cookies it churns through (`counters.ts`).
     * Not refunded if the turn later fails at the HTTP stage below; a spent
     * backstop unit on a request that never reached the model is an
     * acceptable loss for this pilot.
     */
    if (user === null) {
        try {
            const allowed = await createGuestIpBackstopCounter().consume(
                hashClientIp(await getClientIp()),
                GUEST_IP_TURNS_PER_DAY
            );
            if (!allowed)
                return json(HTTP_STATUS_TOO_MANY_REQUESTS, {
                    error: 'turn_limit',
                });
        } catch (error) {
            if (!(error instanceof CounterStoreUnavailableError)) throw error;
            return json(
                HTTP_STATUS_SERVICE_UNAVAILABLE,
                { error: 'server_busy' },
                { 'Retry-After': '30' }
            );
        }
    }

    // 자리가 없으면 줄에서 짧게(15초, 8명) 기다린다. 줄이 차면 기다리지 않고 거절한다.
    // 확인과 예약은 `acquireTurnSlot` 안에서 await 없이 이어진다. 슬롯은 게이트를 통과한 그 순간
    // 잡힌다 — tier 해석과 사전 DB 호출 뒤가 아니다(그 사이에 몰린 요청이 모두 같은 카운트를
    // 읽고 통과해 정원을 넘기던 경합). 여기서부터 모든 종료 경로(락 충돌, 검증 오류, 저장소
    // 예외, 턴 자체)는 슬롯을 정확히 한 번 반납해야 한다 — 락을 잡기 전은 `slot.release`,
    // 잡은 뒤는 `releaseOnce`.
    const acquired = await acquireTurnSlot({
        signal: request.signal,
        canAcceptStream: canAcceptAnalysisStream,
    });
    if (!acquired.ok) {
        const { reason: refusal, blockedBy, waitedMs } = acquired;
        // 줄에서 기다리다 클라이언트가 끊었다 — 응답을 받을 사람이 없다.
        if (refusal === 'aborted')
            return new Response(null, { status: HTTP_STATUS_CLIENT_CLOSED });
        // Capacity refusal — alarmed (`siglens-agent-busy`). The per-user turn
        // lock's 409 below is NOT logged here: that is one person double-sending,
        // not the instance running out of room.
        console.warn(AGENT_BUSY_LOG, {
            reason: refusal,
            blockedBy,
            activeAgentTurns: getActiveAgentTurns(),
            cap: MAX_ACTIVE_AGENT_TURNS,
            queued: getQueuedAgentTurns(),
            waitedMs,
        });
        return json(
            HTTP_STATUS_SERVICE_UNAVAILABLE,
            { error: 'server_busy' },
            { 'Retry-After': '30' }
        );
    }
    const { slot, waitedMs: queuedMs } = acquired;
    const releaseSlot = slot.release;

    // Taken before any DB call (turnLock.ts doc) — the 720s TTL already
    // covers the deadline + pre-turn reads, and holding it any earlier
    // (before auth/body/tier checks) would waste it on requests that never
    // reach a turn.
    // A throw here (rather than the fail-closed `null`) would otherwise leak the slot
    // for the process lifetime — four of those and the instance answers 503 forever.
    let lock: Awaited<ReturnType<typeof acquireTurnLock>>;
    try {
        lock = await acquireTurnLock(subject);
    } catch (error) {
        releaseSlot();
        throw error;
    }
    if (lock === null) {
        releaseSlot();
        return json(HTTP_STATUS_CONFLICT, { error: 'server_busy' });
    }

    let released = false;
    const releaseOnce = async (): Promise<void> => {
        if (released) return;
        released = true;
        releaseSlot();
        await lock.release();
    };

    try {
        // 이미지는 슬롯·락을 잡은 뒤에 정규화한다 — sharp 작업의 동시 수가 턴 슬롯 수로 묶인다.
        const images = await normalizeBodyImages(body.images);
        if (images === null) {
            await releaseOnce();
            return json(HTTP_STATUS_BAD_REQUEST, { error: 'invalid_image' });
        }
        const prepared =
            user === null
                ? guestTurn(body, images)
                : await prepareMemberTurn(user.id, body, tier, locale, images);
        if ('error' in prepared) {
            await releaseOnce();
            return json(prepared.status, { error: prepared.error });
        }
        const stream = agentTurnStream({
            turn: prepared,
            subject,
            guest: user === null,
            tier,
            locale,
            timeZone: request.headers.get(AGENT_TIME_ZONE_HEADER) ?? undefined,
            release: releaseOnce,
            slot,
            queuedMs,
        });
        return new Response(stream, { headers: SSE_HEADERS });
    } catch (error) {
        await releaseOnce();
        console.error('[agent-stream] failed:', redactDbErrorForLog(error));
        return json(HTTP_STATUS_INTERNAL_SERVER_ERROR, {
            error: 'server_error',
        });
    }
}
