import { constants } from 'node:http2';
import 'server-only';
import type { AgentErrorCode, AgentMessage } from '@y0ngha/siglens-core';
import {
    AGENT_LIMITS,
    agentLimit,
    CounterStoreUnavailableError,
    hashClientIp,
    runAgentTurn,
    type Tier,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import {
    toAgentHistory,
    type NewChatMessage,
} from '@/entities/chat-conversation';
import { AGENT_MODEL, getAgentProvider } from '@/entities/llm-provider';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { getClientIp } from '@/shared/api/getClientIp';
import { getOrCreateGuestId } from '@/shared/api/guestId';
import { isBot } from '@/shared/api/isBot';
import { getDatabaseClient } from '@/shared/db/client';
import {
    ANALYSIS_LOCALE_HEADER,
    DEFAULT_LOCALE,
    isLocale,
    type Locale,
} from '@/shared/i18n/locales';
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import { AgentTurnError, agentEventStream } from '../agentEventStream';
import {
    createAgentCounters,
    createGuestIpBackstopCounter,
    GUEST_IP_TURNS_PER_DAY,
} from '../counters';
import { resolveAgentTier } from '../resolveAgentTier';
import { availableToolNames, createToolExecutor } from '../tools';
import { AGENT_BUSY_LOG } from '../busyLog';
import { guestSubject } from '../guestSubject';
import { acquireTurnLock } from '../turnLock';

const {
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_CONFLICT,
    HTTP_STATUS_FORBIDDEN,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
    HTTP_STATUS_NOT_FOUND,
    HTTP_STATUS_SERVICE_UNAVAILABLE,
    HTTP_STATUS_TOO_MANY_REQUESTS,
    HTTP_STATUS_UNAUTHORIZED,
} = constants;

export const dynamic = 'force-dynamic';

const SSE_HEADERS: HeadersInit = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'X-Accel-Buffering': 'no',
};
const MESSAGE_MAX_CHARS = 4_000;
/**
 * Answer length cap per provider call. Core's default (4,096) cut long
 * multi-symbol summaries mid-sentence; DeepSeek accepts far more, and a turn
 * rarely needs more than this.
 */
const AGENT_MAX_OUTPUT_TOKENS = 8_192;
/** Per-instance cap on concurrent agent turns (spec §6-3). */
const MAX_CONCURRENT_AGENT_TURNS = 4;
let activeAgentTurns = 0;

type Action = 'send' | 'regenerate' | 'edit';
interface Body {
    conversationId: string | null;
    message: string;
    action: Action;
    editSeq?: number;
    /** Guests only — ignored for members. The prior turns the browser still holds (nothing is stored for them). */
    history: AgentMessage[];
}

/**
 * A guest's transcript lives only in the browser, so the client sends it with
 * every turn. It is the caller's own text, so the only thing to guard is size:
 * the newest messages are kept and each is clipped (core's history window then
 * budgets tokens as it does for members). Only plain user/assistant text is
 * accepted — tool rows and tool calls never cross this boundary.
 */
const GUEST_HISTORY_MAX_MESSAGES = 20;
const GUEST_HISTORY_MESSAGE_MAX_CHARS = 8_000;

function isGuestHistoryItem(
    x: unknown
): x is { role: 'user' | 'assistant'; content: string } {
    if (typeof x !== 'object' || x === null) return false;
    const { role, content } = x as { role?: unknown; content?: unknown };
    return (
        (role === 'user' || role === 'assistant') && typeof content === 'string'
    );
}

function parseGuestHistory(raw: unknown): AgentMessage[] | null {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) return null;
    const recent = raw.slice(-GUEST_HISTORY_MAX_MESSAGES);
    if (!recent.every(isGuestHistoryItem)) return null;
    return recent
        .map(m => ({ role: m.role, content: m.content.trim() }))
        .filter(m => m.content !== '')
        .map(m => ({
            ...m,
            content: m.content.slice(0, GUEST_HISTORY_MESSAGE_MAX_CHARS),
        }));
}

/** Pilot: `model`/`analysisModel` from the client are ignored (spec R12). */
function parseBody(raw: unknown): Body | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const b = raw as Record<string, unknown>;
    // `action` is not part of the pilot's client-visible surface (send/regenerate/edit
    // are internal to the SSE contract); an unrecognized value is a client bug, not a
    // silent default — reject it instead of coercing to `send`.
    if (
        b.action !== undefined &&
        b.action !== 'send' &&
        b.action !== 'regenerate' &&
        b.action !== 'edit'
    )
        return null;
    const action: Action = (b.action as Action | undefined) ?? 'send';
    const message = typeof b.message === 'string' ? b.message.trim() : '';
    if (
        action !== 'regenerate' &&
        (message.length === 0 || message.length > MESSAGE_MAX_CHARS)
    )
        return null;
    // editSeq must be a positive integer — 0/negative would delete the whole
    // transcript in `deleteFromSeq` (`seq >= 0` matches every row).
    if (
        action === 'edit' &&
        (!Number.isInteger(b.editSeq) || (b.editSeq as number) <= 0)
    )
        return null;
    const history = parseGuestHistory(b.history);
    if (history === null) return null;
    return {
        conversationId:
            typeof b.conversationId === 'string' ? b.conversationId : null,
        message,
        action,
        ...(action === 'edit' ? { editSeq: b.editSeq as number } : {}),
        history,
    };
}

function requestLocale(request: Request): Locale {
    const raw = request.headers.get(ANALYSIS_LOCALE_HEADER) ?? '';
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

const json = (status: number, body: unknown, headers?: HeadersInit): Response =>
    Response.json(body, { status, headers });

/**
 * Postgres foreign-key violation on `chat_messages.conversation_id`.
 *
 * The member can delete the conversation from the sidebar (or a second tab) while
 * this turn is still running: the turn lock is per-USER, not per-conversation, so it
 * cannot prevent that, and `ON DELETE cascade` only removes rows that already exist
 * at delete time. The late append then hits the FK and the driver error would escape
 * as a generic `server_error`, discarding a finished (already billed) turn behind a
 * confusing message. `not_found` is the honest outcome — the transcript is gone.
 */
const FK_VIOLATION_CODE = '23503';

function isConversationGone(error: unknown): boolean {
    return (
        (error as { cause?: { code?: unknown } } | null)?.cause?.code ===
        FK_VIOLATION_CODE
    );
}

type PreparedTurn =
    | { status: number; error: HttpStageError }
    | {
          /** `null` for a guest — nothing is read from or written to the database. */
          repo: DrizzleChatConversationRepository | null;
          conversationId: string | null;
          title?: string;
          userMessage: string;
          userMessageId: string | null;
          userMessageSeq: number | null;
          history: AgentMessage[];
          portfolioSymbols: string[];
      };
type HttpStageError =
    | 'not_found'
    | 'invalid_body'
    | 'conversation_limit'
    | 'conversation_full';

/** A guest turn: the browser's transcript is the history, and nothing is stored. */
function guestTurn(body: Body): PreparedTurn {
    return {
        repo: null,
        conversationId: null,
        userMessage: body.message,
        userMessageId: null,
        userMessageSeq: null,
        history: body.history,
        portfolioSymbols: [],
    };
}

/**
 * A member turn: resolve/create the conversation, apply `edit`/`regenerate`,
 * store the user row and read the history back. Runs under the caller's turn
 * lock; an HTTP-stage refusal is returned (the caller releases the lock).
 */
async function prepareMemberTurn(
    userId: string,
    body: Body,
    tier: Tier,
    locale: Locale
): Promise<PreparedTurn> {
    const { db } = getDatabaseClient();
    const repo = new DrizzleChatConversationRepository(db);

    const conversation =
        body.conversationId === null
            ? null
            : await repo.findForUser(body.conversationId, userId);
    if (body.conversationId !== null && conversation === null) {
        return { status: HTTP_STATUS_NOT_FOUND, error: 'not_found' };
    }
    if (conversation === null && body.action !== 'send') {
        return { status: HTTP_STATUS_BAD_REQUEST, error: 'invalid_body' };
    }
    if (
        conversation === null &&
        (await repo.countForUser(userId)) >=
            agentLimit(tier, 'conversationsMax')
    ) {
        return { status: HTTP_STATUS_CONFLICT, error: 'conversation_limit' };
    }

    let conversationId = conversation?.id ?? '';
    let userMessage = body.message;
    let userMessageId: string | null = null;
    let userMessageSeq: number | null = null;
    let title: string | undefined;

    if (conversation === null) {
        const created = await repo.create({
            userId: userId,
            firstMessage: body.message,
            locale,
            modelId: AGENT_MODEL,
        });
        conversationId = created.id;
        title = created.title;
    }

    if (body.action === 'edit') {
        const rows = await repo.listMessages(conversationId);
        const target = rows.find(r => r.seq === body.editSeq);
        // Reject an editSeq that doesn't point at an existing USER row
        // owned by this conversation — an assistant/tool row would leave
        // two consecutive user rows after the append below.
        if (!target || target.role !== 'user') {
            return { status: HTTP_STATUS_BAD_REQUEST, error: 'invalid_body' };
        }
        await repo.deleteFromSeq(conversationId, body.editSeq!);
    } else if (body.action === 'regenerate') {
        if ((await repo.supersedeAfterLastUser(conversationId)) === null) {
            return { status: HTTP_STATUS_BAD_REQUEST, error: 'invalid_body' };
        }
    }

    const rows = await repo.listMessages(conversationId);
    if (rows.length >= AGENT_LIMITS.messagesPerConversation) {
        return { status: HTTP_STATUS_CONFLICT, error: 'conversation_full' };
    }

    // History = every prior turn. `send`/`edit` append the new user row AFTER this read, so the
    // whole transcript is history; `regenerate` reuses the last user row as `userMessage` and
    // drops it from history.
    let history: AgentMessage[] = toAgentHistory(rows);
    if (body.action === 'regenerate') {
        userMessage =
            [...rows].reverse().find(r => r.role === 'user')?.content ?? '';
        const lastUserIndex = history.map(m => m.role).lastIndexOf('user');
        history =
            lastUserIndex >= 0 ? history.slice(0, lastUserIndex) : history;
    } else {
        let saved;
        try {
            [saved] = await repo.appendMessages(conversationId, [
                { role: 'user', content: body.message },
            ]);
        } catch (error) {
            // Deleted between the ownership check and this insert. No stream exists
            // yet, so answer on the HTTP stage rather than as an SSE frame.
            if (!isConversationGone(error)) throw error;
            return { status: HTTP_STATUS_NOT_FOUND, error: 'not_found' };
        }
        userMessageId = saved?.id ?? null;
        userMessageSeq = saved?.seq ?? null;
    }

    const portfolioSymbols = (
        await new DrizzlePortfolioRepository(db).findByUser(userId)
    ).map(h => h.symbol);
    return {
        repo,
        conversationId,
        title,
        userMessage,
        userMessageId,
        userMessageSeq,
        history,
        portfolioSymbols,
    };
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

    const locale = requestLocale(request);
    /** Quota/lock subject: the member id, or the guest's cookie id (`shared/api/guestId.ts`). */
    const subject = user?.id ?? guestSubject(await getOrCreateGuestId());
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
    if (streamSlotsFull || activeAgentTurns >= MAX_CONCURRENT_AGENT_TURNS) {
        // Capacity refusal — alarmed (`siglens-agent-busy`). The per-user turn
        // lock's 409 below is NOT logged here: that is one person double-sending,
        // not the instance running out of room.
        console.warn(AGENT_BUSY_LOG, {
            reason: streamSlotsFull
                ? 'analysis_stream_slots'
                : 'agent_turn_slots',
            activeAgentTurns,
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
    activeAgentTurns += 1;
    let countedDown = false;
    const decrementOnce = (): void => {
        if (countedDown) return;
        countedDown = true;
        activeAgentTurns -= 1;
    };

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
        const {
            repo,
            conversationId,
            title,
            userMessage,
            userMessageId,
            userMessageSeq,
            history,
            portfolioSymbols,
        } = prepared;

        const controller = new AbortController();
        const executeTool = createToolExecutor({ analysisModel: AGENT_MODEL });
        const toolTimings: Array<{
            name: string;
            ms: number;
            status: string;
        }> = [];

        const stream = agentEventStream({
            meta: {
                conversationId,
                userMessageId,
                userMessageSeq,
                model: AGENT_MODEL,
                ...(title !== undefined ? { title } : {}),
            },
            onAbort: () => controller.abort(),
            work: async emit => {
                try {
                    const result = await runAgentTurn(
                        {
                            userId: subject,
                            tier,
                            model: AGENT_MODEL,
                            locale,
                            history,
                            userMessage,
                            availableTools: availableToolNames(),
                            portfolioSymbols,
                            signal: controller.signal,
                        },
                        {
                            callAgentProvider: getAgentProvider(),
                            executeTool,
                            counters: createAgentCounters(),
                            maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS,
                            onEvent: event => {
                                if (event.type === 'tool_end')
                                    toolTimings.push({
                                        name: event.name,
                                        ms: event.ms,
                                        status: event.status,
                                    });
                                emit(event);
                            },
                        }
                    );
                    if (!result.ok) {
                        const partial = result.partialText?.trim();
                        if (partial && repo && conversationId) {
                            try {
                                await repo.appendMessages(conversationId, [
                                    {
                                        role: 'assistant',
                                        content: partial,
                                        modelId: AGENT_MODEL,
                                        status: persistedStatusFor(
                                            result.error
                                        ),
                                    },
                                ]);
                            } catch (error) {
                                if (isConversationGone(error))
                                    throw new AgentTurnError('not_found');
                                throw error;
                            }
                        }
                        throw new AgentTurnError(result.error);
                    }
                    const rowsToSave: NewChatMessage[] = [
                        ...result.intermediate.map(m => ({
                            role: m.role,
                            content: m.content,
                            toolCalls: m.toolCalls,
                            toolCallId: m.toolCallId,
                            toolName: m.toolName,
                        })),
                        {
                            role: 'assistant',
                            content: result.assistant.content,
                            modelId: AGENT_MODEL,
                            usage: {
                                ...result.usage,
                                toolsUsed: result.toolsUsed,
                                promptVersion: result.promptVersion,
                            },
                        },
                    ];
                    let assistantMessageId = '';
                    if (repo && conversationId) {
                        try {
                            const saved = await repo.appendMessages(
                                conversationId,
                                rowsToSave
                            );
                            assistantMessageId = saved.at(-1)?.id ?? '';
                        } catch (error) {
                            if (isConversationGone(error))
                                throw new AgentTurnError('not_found');
                            throw error;
                        }
                    }
                    console.info(
                        '[Agent]',
                        JSON.stringify({
                            conversationId,
                            userId: subject,
                            guest: user === null,
                            model: AGENT_MODEL,
                            steps: result.usage.steps,
                            toolCalls: toolTimings,
                            promptVersion: result.promptVersion,
                            ms: result.usage.ms,
                            stopReason: result.stopReason,
                        })
                    );
                    emit({ type: 'usage', usage: result.usage });
                    return {
                        assistantMessageId,
                        remaining: result.remaining,
                        stopReason: result.stopReason,
                        ...(title !== undefined ? { title } : {}),
                    };
                } finally {
                    await releaseOnce();
                }
            },
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

/**
 * Persisted status for a partial assistant reply, keyed by every
 * `AgentErrorCode` explicitly. The `default` branch assigns `code` to a
 * `never`-typed binding — if core ever adds a new `AgentErrorCode`, this
 * fails `tsc` here instead of silently falling through to `'error'`.
 */
function persistedStatusFor(code: AgentErrorCode): 'aborted' | 'error' {
    switch (code) {
        case 'aborted':
        case 'deadline':
            return 'aborted';
        case 'turn_limit':
        case 'premium_turn_limit':
        case 'rate_limited':
        case 'server_busy':
        case 'server_error':
            return 'error';
        default: {
            const _never: never = code;
            throw new Error(`unhandled AgentErrorCode: ${String(_never)}`);
        }
    }
}
