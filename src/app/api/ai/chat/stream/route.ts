import { constants } from 'node:http2';
import 'server-only';
import {
    CounterStoreUnavailableError,
    hashClientIp,
    type Tier,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { getClientIp } from '@/shared/api/getClientIp';
import { readGuestId } from '@/shared/api/guestId';
import { isBot } from '@/shared/api/isBot';
import { AGENT_TIME_ZONE_HEADER } from '@/shared/i18n/locales';
import { localeFromRequestHeader } from '@/shared/lib/localeFromRequestHeader';
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
import { parseBody } from './_lib/parseBody';
import { guestTurn, prepareMemberTurn } from './_lib/prepareTurn';
import {
    getActiveAgentTurns,
    hasFreeTurnSlot,
    MAX_CONCURRENT_AGENT_TURNS,
    reserveTurnSlot,
} from './_lib/turnSlots';

const {
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_CONFLICT,
    HTTP_STATUS_FORBIDDEN,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
    HTTP_STATUS_SERVICE_UNAVAILABLE,
    HTTP_STATUS_TOO_MANY_REQUESTS,
    HTTP_STATUS_UNAUTHORIZED,
} = constants;

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

    const body = parseBody(await request.json().catch(() => null));
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

    const streamSlotsFull = !canAcceptAnalysisStream();
    if (streamSlotsFull || !hasFreeTurnSlot()) {
        // Capacity refusal — alarmed (`siglens-agent-busy`). The per-user turn
        // lock's 409 below is NOT logged here: that is one person double-sending,
        // not the instance running out of room.
        console.warn(AGENT_BUSY_LOG, {
            reason: streamSlotsFull
                ? 'analysis_stream_slots'
                : 'agent_turn_slots',
            activeAgentTurns: getActiveAgentTurns(),
            cap: MAX_CONCURRENT_AGENT_TURNS,
        });
        return json(
            HTTP_STATUS_SERVICE_UNAVAILABLE,
            { error: 'server_busy' },
            { 'Retry-After': '30' }
        );
    }

    // Reserve a slot the instant the gate passes — not after tier resolution and every
    // pre-turn DB call, which was late enough that many requests arriving in that window
    // all read the same pre-increment count and all proceed, letting an instance exceed
    // `MAX_CONCURRENT_AGENT_TURNS`. Every exit path from here on (lock busy, validation
    // errors, repository throw, or the turn itself) must release this slot exactly once —
    // `decrementOnce` below, and `releaseOnce` after the lock exists.
    const decrementOnce = reserveTurnSlot();

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
        decrementOnce();
        throw error;
    }
    if (lock === null) {
        decrementOnce();
        return json(HTTP_STATUS_CONFLICT, { error: 'server_busy' });
    }

    let released = false;
    const releaseOnce = async (): Promise<void> => {
        if (released) return;
        released = true;
        decrementOnce();
        await lock.release();
    };

    try {
        const prepared =
            user === null
                ? guestTurn(body)
                : await prepareMemberTurn(user.id, body, tier, locale);
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
        });
        return new Response(stream, { headers: SSE_HEADERS });
    } catch (error) {
        await releaseOnce();
        console.error('[agent-stream] failed:', error);
        return json(HTTP_STATUS_INTERNAL_SERVER_ERROR, {
            error: 'server_error',
        });
    }
}
