/**
 * Client-side parser for the `event: <name>\ndata: <json>\n\n` frames our SSE
 * routes write — `agentEventStream`'s `frame()` (`src/app/api/ai/chat/agentEventStream.ts`)
 * and `heartbeatStream` (`./heartbeatStream.ts`). Shared by `useAgentStream`
 * (agent chat) and `runAnalysisStream` (`shared/lib/sse/runAnalysisStream.ts`)
 * so both get the same CRLF-tolerant framing — the analysis copy once split on
 * a literal `\n\n` and hung behind CRLF-normalizing proxies.
 */
export interface SseFrame {
    event: string;
    data: Record<string, unknown> | null;
}

/**
 * Splits a growing buffer on the blank-line frame delimiter, keeping the
 * trailing partial frame for the next chunk.
 *
 * Matches `\r?\n\r?\n` rather than a literal `\n\n` — a CRLF-normalizing
 * intermediary (some proxies, or `TextDecoderStream` behind certain
 * transports) can rewrite the server's `\n\n` to `\r\n\r\n`. A literal-only
 * split would then never find a delimiter, so `frames` stays `[]` forever
 * and `rest` grows without bound while the screen shows nothing.
 */
export function splitFrames(buffer: string): {
    frames: string[];
    rest: string;
} {
    const parts = buffer.split(/\r?\n\r?\n/);
    const rest = parts.pop() ?? '';
    return { frames: parts.filter(Boolean), rest };
}

/**
 * Parses one frame's `event:`/`data:` lines. Malformed JSON yields
 * `data: null` so the caller can skip it instead of throwing mid-stream.
 *
 * Multiple `data:` lines in one frame are joined with `\n` (per the SSE
 * spec) rather than concatenated raw — a value that itself spans lines
 * would otherwise lose its line breaks. Only a single leading space after
 * `data:` is stripped per line (the SSE-spec convention), not the whole
 * line trimmed, so meaningful leading/trailing whitespace inside a line
 * survives.
 */
export function parseSseFrame(frame: string): SseFrame {
    const lines = frame.split(/\r?\n/);
    // 같은 필드가 여러 번 오면 마지막 `event:`가 이긴다.
    const event =
        lines
            .findLast(line => line.startsWith('event:'))
            ?.slice(6)
            .trim() ?? '';
    const raw = lines
        .filter(line => line.startsWith('data:'))
        .map(line => {
            const value = line.slice(5);
            return value.startsWith(' ') ? value.slice(1) : value;
        })
        .join('\n');
    try {
        return {
            event,
            data: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
        };
    } catch {
        return { event, data: null };
    }
}
