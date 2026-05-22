const ANALYZED_AT_DISPLAY_LENGTH = 16;

export function formatAnalyzedAt(iso: string): string {
    return iso.replace('T', ' ').slice(0, ANALYZED_AT_DISPLAY_LENGTH);
}
