/**
 * 전략 요약의 `**라벨**: 값` 줄을 구조화 섹션으로 파싱한다.
 */
const STRUCTURED_SUMMARY_REGEX = /^\*\*(.+?)\*\*:\s*(.+)$/;

export const MIN_STRUCTURED_SUMMARY_SECTIONS = 3;

export interface SkillSummarySection {
    label: string;
    value: string;
}

/**
 * 요약을 줄 단위로 파싱해 `**라벨**: 값` 형식인 줄만 섹션으로 모은다. 섹션이
 * `MIN_STRUCTURED_SUMMARY_SECTIONS` 미만이면 구조화 요약이 아니라고 보고 `null`.
 */
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
