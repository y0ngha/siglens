/**
 * Markdown-fence-stripping JSON parser shared by AI/LLM call sites.
 *
 * These helpers (`stripMarkdownCodeBlock`, `parseJsonResponse`) originate in
 * `@y0ngha/siglens-core` (`src/domain/utils.ts`) but are not part of core's
 * public API surface, so consumers cannot import them. Until core exposes them,
 * siglens keeps a local copy here and call sites should reuse from this module
 * rather than re-duplicating the implementation.
 *
 * Sync obligation: if the core helpers change, mirror the update here.
 */

const MARKDOWN_CODE_BLOCK_PATTERN = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;

/** Strip a single ```json fenced code block wrapper if present, returning the trimmed inner text. */
export function stripMarkdownCodeBlock(text: string): string {
    const match = MARKDOWN_CODE_BLOCK_PATTERN.exec(text.trim());
    return match ? match[1].trim() : text.trim();
}

/**
 * Parse a JSON response from an LLM call, transparently stripping a markdown
 * code-fence wrapper if the model returned ```json ... ```.
 *
 * @param text - Raw LLM response text.
 * @param source - Caller name used in the error message for easier debugging.
 * @throws When the (un-fenced) text is not valid JSON.
 */
export function parseJsonResponse(text: string, source: string): unknown {
    try {
        return JSON.parse(stripMarkdownCodeBlock(text));
    } catch (error) {
        throw new Error(`Failed to parse ${source} response as JSON`, {
            cause: error,
        });
    }
}
