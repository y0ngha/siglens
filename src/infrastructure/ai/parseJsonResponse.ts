// Local mirror of `@y0ngha/siglens-core` JSON helpers (not yet exported by core's public API).

const MARKDOWN_CODE_BLOCK_PATTERN = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;

/** Strip a single ```json fenced code block wrapper if present, returning the trimmed inner text. */
export function stripMarkdownCodeBlock(text: string): string {
    const match = MARKDOWN_CODE_BLOCK_PATTERN.exec(text.trim());
    return match ? match[1].trim() : text.trim();
}

/** Parse a JSON LLM response, transparently stripping a ```json``` markdown fence if present. */
export function parseJsonResponse(text: string, source: string): unknown {
    try {
        return JSON.parse(stripMarkdownCodeBlock(text));
    } catch (error) {
        throw new Error(`Failed to parse ${source} response as JSON`, {
            cause: error,
        });
    }
}
