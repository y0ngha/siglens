import type { AgentClientErrorCode } from '@/features/agent-chat';

/**
 * Which error codes get a retry button in `ChatShell` — `false` for
 * outcomes a retry cannot fix (quota, ownership, malformed request, bot
 * block, disabled). Not user-visible text, so it lives outside the i18n
 * catalog (unlike the messages themselves, built in `ChatShell.tsx` so the
 * extraction codemod can find them as real `t()` calls).
 *
 * `Record<AgentClientErrorCode, boolean>` (every key required) — a new code
 * landing in either union fails `tsc` on this literal instead of silently
 * defaulting to retryable or not.
 */
export const AGENT_ERROR_RETRYABLE: Record<AgentClientErrorCode, boolean> = {
    invalid_body: false,
    unauthenticated: false,
    bot: false,
    not_found: false,
    conversation_limit: false,
    conversation_full: false,
    disabled: false,
    server_busy: true,
    turn_limit: false,
    premium_turn_limit: false,
    rate_limited: true,
    server_error: true,
    deadline: true,
    aborted: true,
};
