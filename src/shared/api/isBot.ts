import { userAgent } from 'next/server';

const AI_BOT_RE =
    /GPTBot|ClaudeBot|Claude-User|Claude-SearchBot|Google-CloudVertexBot|Gemini-Deep-Research/i;

/**
 * Determines whether the incoming request is a bot/crawler based on the
 * `User-Agent` header. Wraps Next.js' official `userAgent` helper so call
 * sites stay simple and so the detection can be swapped out later if needed.
 *
 * Used by Server Actions to suppress Redis worker dispatch on crawler
 * traffic (see `submitAnalysisAction` and siblings).
 */
export function isBot(headers: Headers): boolean {
    const userAgentHeader = headers.get('user-agent') ?? '';
    const ua = userAgent({ headers });
    return Boolean(ua.isBot) || AI_BOT_RE.test(userAgentHeader);
}
