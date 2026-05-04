import { extractToc } from '@/lib/legal-toc';

describe('extractToc', () => {
    it('extracts h2 headings only (h3 ignored)', () => {
        const md = `## 1. 총칙\n\n내용\n\n### 1.1 세부\n\n## 2. 수집\n\n내용\n`;
        const toc = extractToc(md);
        expect(toc).toHaveLength(2);
        expect(toc[0].label).toBe('1. 총칙');
        expect(toc[1].label).toBe('2. 수집');
    });

    it('generates slug ids for korean headings', () => {
        const md = `## 1. 총칙\n\n본문\n`;
        const toc = extractToc(md);
        expect(toc[0].id).toBe('1-총칙');
    });

    it('handles parenthesized headings (제1조 형식)', () => {
        const md = `## 제1조 (목적)\n\n본문\n`;
        const toc = extractToc(md);
        expect(toc[0].label).toBe('제1조 (목적)');
        expect(toc[0].id).toBe('제1조-목적');
    });

    it('returns empty array when no h2 found', () => {
        expect(extractToc('단순 본문 텍스트')).toEqual([]);
    });
});
