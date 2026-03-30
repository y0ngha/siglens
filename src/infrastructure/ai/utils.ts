const MARKDOWN_CODE_BLOCK_PATTERN = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;

export const AI_SYSTEM_PROMPT =
    'You are a financial analysis assistant. Always respond with pure JSON only. Do not wrap the response in markdown code blocks or any other formatting.';

export function stripMarkdownCodeBlock(text: string): string {
    const match = MARKDOWN_CODE_BLOCK_PATTERN.exec(text.trim());
    return match ? match[1].trim() : text.trim();
}
