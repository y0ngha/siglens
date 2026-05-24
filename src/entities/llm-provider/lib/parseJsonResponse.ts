// Local mirror of `@y0ngha/siglens-core` JSON helpers (not yet exported by core's public API).

import { jsonrepair } from 'jsonrepair';

const MARKDOWN_CODE_BLOCK_PATTERN = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;

/** Strip a single ```json fenced code block wrapper if present, returning the trimmed inner text. */
export function stripMarkdownCodeBlock(text: string): string {
    const match = MARKDOWN_CODE_BLOCK_PATTERN.exec(text.trim());
    return match ? match[1].trim() : text.trim();
}

/**
 * `jsonrepair` is willing to wrap any text in quotes to produce valid JSON,
 * which would silently accept "not json at all" as a string. Restrict salvage
 * to candidates that already look JSON-shaped (start with `{` or `[`) so total
 * garbage still surfaces as an error to callers.
 */
function looksJsonShaped(text: string): boolean {
    const head = text.trimStart()[0];
    return head === '{' || head === '[';
}

/**
 * Parse a JSON LLM response, transparently stripping a ```json``` markdown fence
 * if present. On initial parse failure, retry once via `jsonrepair` (LLMs
 * occasionally produce truncated, trailing-comma, or unquoted-key JSON).
 */
export function parseJsonResponse(text: string, source: string): unknown {
    const candidate = stripMarkdownCodeBlock(text);
    try {
        return JSON.parse(candidate);
    } catch (error) {
        if (looksJsonShaped(candidate)) {
            try {
                return JSON.parse(jsonrepair(candidate));
            } catch {
                // Fall through to the labeled throw below.
            }
        }
        throw new Error(`Failed to parse ${source} response as JSON`, {
            cause: error,
        });
    }
}
