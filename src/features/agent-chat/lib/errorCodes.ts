import type { AgentErrorCode } from '@y0ngha/siglens-core';

/**
 * HTTP-stage codes `POST /api/ai/chat/stream` returns before a turn ever
 * starts (`{ error: <code> }` JSON body, see `stream/route.ts`). Not part of
 * core's `AgentErrorCode` — that union is turn-stage only.
 */
export const HTTP_STAGE_CODES = [
    'invalid_body',
    'unauthenticated',
    'bot',
    'not_found',
    'conversation_limit',
    'conversation_full',
    'disabled',
] as const;
export type HttpStageCode = (typeof HTTP_STAGE_CODES)[number];

/**
 * Every `AgentErrorCode` core can emit in the `error` SSE frame
 * (`{ code, message }`, spec §8). Written as a `Record` with every key
 * required — same pattern as `route.ts`'s `persistedStatusFor` — so adding a
 * new `AgentErrorCode` in core fails `tsc` here instead of silently shipping
 * a turn failure with no UI copy.
 */
const TURN_STAGE_CODE_MAP: Record<AgentErrorCode, true> = {
    turn_limit: true,
    premium_turn_limit: true,
    rate_limited: true,
    server_busy: true,
    server_error: true,
    deadline: true,
    aborted: true,
};
export const TURN_STAGE_CODES = Object.keys(
    TURN_STAGE_CODE_MAP
) as AgentErrorCode[];

/** `server_busy` is returned at both stages (409/503 HTTP, and the turn gate) — de-duplicated here. */
export const AGENT_ERROR_CODES: readonly string[] = [
    ...new Set<string>([...HTTP_STAGE_CODES, ...TURN_STAGE_CODES]),
];

export type AgentClientErrorCode = HttpStageCode | AgentErrorCode;
