import type { LlmsDocument, LlmsLink } from '@/app/api/llms/_lib/model';

function renderLink(item: LlmsLink): string {
    const head = `- [${item.title}](${item.url})`;
    return item.note === undefined ? head : `${head}: ${item.note}`;
}

/**
 * llms.txt 규격 마크다운: H1, 인용문, 문단, `## ` 섹션과 링크 목록. 줄 끝은 `\n`, 파일 끝은 정확히 한 번의
 * `\n`이고 `\r`와 줄 끝 공백은 없다.
 */
export function renderLlmsTxt(document: LlmsDocument): string {
    const blocks = [
        `# ${document.title}`,
        `> ${document.summary}`,
        ...document.paragraphs,
        ...document.sections
            .filter(section => section.links.length > 0)
            .map(
                section =>
                    `## ${section.heading}\n\n${section.links.map(renderLink).join('\n')}`
            ),
    ];
    return `${blocks.join('\n\n')}\n`;
}
