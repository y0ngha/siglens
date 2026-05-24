const STRUCTURED_SUMMARY_REGEX = /^\*\*(.+?)\*\*:\s*(.+)$/;

export const MIN_STRUCTURED_SUMMARY_SECTIONS = 3;

export interface SkillSummarySection {
    label: string;
    value: string;
}

export function parseStructuredSummary(
    summary: string
): SkillSummarySection[] | null {
    const sections = summary
        .split('\n')
        .filter(line => line.trim() !== '')
        .flatMap(line => {
            const match = STRUCTURED_SUMMARY_REGEX.exec(line);
            return match ? [{ label: match[1], value: match[2] }] : [];
        });
    return sections.length >= MIN_STRUCTURED_SUMMARY_SECTIONS ? sections : null;
}
